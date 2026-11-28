import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

export type TestSuiteStatus = 'passed' | 'failed' | 'error' | 'running';

export interface BenchmarkMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  passRate: number;
  duration: number;
  coverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

export interface TestFailure {
  testName: string;
  file: string;
  message: string;
  stack?: string;
}

export interface VerificationResult {
  status: TestSuiteStatus;
  benchmarks: BenchmarkMetrics;
  failures: TestFailure[];
  timestamp: Date;
  jestVersion: string;
  nodeVersion: string;
}

interface JestTestResult {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  testResults: Array<{
    name: string;
    status: 'passed' | 'failed' | 'pending';
    duration: number;
    failureMessages: string[];
    ancestorTitles: string[];
  }>;
  coverageMap?: {
    [file: string]: {
      statementMap: Record<string, { start: { line: number; column: number }; end: { line: number; column: number } }>;
      branchMap: Record<string, { locations: Array<{ start: { line: number; column: number }; end: { line: number; column: number } }> }>;
      fnMap: Record<string, { name: string; decl: { start: { line: number; column: number }; end: { line: number; column: number } } }>;
      s: Record<string, number>;
      b: Record<string, number[]>;
      f: Record<string, number>;
    };
  };
}

interface JestAggregatedResult {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  startTime: number;
  success: boolean;
  testResults: JestTestResult['testResults'];
  coverageMap?: JestTestResult['coverageMap'];
}

export class TestSuiteVerificationService extends EventEmitter {
  private readonly projectRoot: string;
  private readonly testDirectory: string;
  private readonly jestConfigPath: string;
  private process: ChildProcess | null = null;
  private stdoutBuffer: string = '';
  private stderrBuffer: string = '';
  private startTime: number = 0;

  constructor(projectRoot: string = process.cwd()) {
    super();
    this.projectRoot = projectRoot;
    this.testDirectory = path.join(projectRoot, 'tests');
    this.jestConfigPath = path.join(projectRoot, 'jest.config.js');
  }

  async verify(): Promise<VerificationResult> {
    this.startTime = Date.now();
    this.stdoutBuffer = '';
    this.stderrBuffer = '';

    const jestArgs = this.buildJestArgs();
    const jestCommand = this.resolveJestCommand();

    this.emit('start', { command: jestCommand, args: jestArgs });

    return new Promise((resolve, reject) => {
      this.process = spawn(jestCommand, jestArgs, {
        cwd: this.projectRoot,
        env: { ...process.env, NODE_ENV: 'test', FORCE_COLOR: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.stdoutBuffer += data.toString('utf8');
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        this.stderrBuffer += data.toString('utf8');
        this.emit('stderr', data.toString('utf8'));
      });

      this.process.on('error', (error: Error) => {
        this.cleanup();
        const result = this.buildErrorResult(error);
        this.emit('complete', result);
        reject(result);
      });

      this.process.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        this.cleanup();
        const duration = Date.now() - this.startTime;

        try {
          const result = this.parseJestOutput(code, signal, duration);
          this.emit('complete', result);
          
          if (result.status === 'passed') {
            resolve(result);
          } else {
            reject(result);
          }
        } catch (parseError) {
          const errorResult = this.buildParseErrorResult(parseError as Error, duration);
          this.emit('complete', errorResult);
          reject(errorResult);
        }
      });
    });
  }

  static async runVerification(projectRoot?: string, outputPath?: string): Promise<VerificationResult> {
    const service = new TestSuiteVerificationService(projectRoot);
    const result = await service.verify();
    
    if (outputPath) {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
    }
    
    return result;
  }

  private buildJestArgs(): string[] {
    const args = [
      '--json',
      '--outputFile=/dev/stdout',
      '--testPathPattern=tests',
      '--coverage',
      '--coverageReporters=json',
      '--coverageDirectory=/tmp/coverage',
      '--no-cache',
      '--forceExit',
      '--detectOpenHandles',
    ];

    if (fs.existsSync(this.jestConfigPath)) {
      args.push('--config', this.jestConfigPath);
    }

    return args;
  }

  private resolveJestCommand(): string {
    const localJest = path.join(this.projectRoot, 'node_modules', '.bin', 'jest');
    if (fs.existsSync(localJest)) {
      return localJest;
    }
    return 'npx';
  }

  private parseJestOutput(code: number | null, signal: NodeJS.Signals | null, duration: number): VerificationResult {
    let aggregatedResult: JestAggregatedResult;
    
    try {
      const jsonStart = this.stdoutBuffer.indexOf('{');
      const jsonEnd = this.stdoutBuffer.lastIndexOf('}') + 1;
      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error('No JSON output found in Jest stdout');
      }
      const jsonOutput = this.stdoutBuffer.slice(jsonStart, jsonEnd);
      aggregatedResult = JSON.parse(jsonOutput);
    } catch (parseError) {
      throw new Error(`Failed to parse Jest JSON output: ${(parseError as Error).message}\nStdout: ${this.stdoutBuffer.slice(0, 500)}`);
    }

    const coverage = this.calculateCoverage(aggregatedResult.coverageMap);
    const failures = this.extractFailures(aggregatedResult.testResults);
    const memoryUsage = this.getMemoryUsage();

    const status: TestSuiteStatus = signal ? 'error' : (aggregatedResult.success ? 'passed' : 'failed');

    return {
      status,
      benchmarks: {
        totalTests: aggregatedResult.numTotalTests,
        passedTests: aggregatedResult.numPassedTests,
        failedTests: aggregatedResult.numFailedTests,
        skippedTests: aggregatedResult.numPendingTests,
        passRate: aggregatedResult.numTotalTests > 0 
          ? (aggregatedResult.numPassedTests / aggregatedResult.numTotalTests) * 100 
          : 100,
        duration,
        coverage,
        memoryUsage,
      },
      failures,
      timestamp: new Date(),
      jestVersion: this.getJestVersion(),
      nodeVersion: process.version,
    };
  }

  private calculateCoverage(coverageMap?: JestAggregatedResult['coverageMap']): BenchmarkMetrics['coverage'] {
    if (!coverageMap) {
      return { statements: 0, branches: 0, functions: 0, lines: 0 };
    }

    let totalStatements = 0;
    let coveredStatements = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalLines = 0;
    let coveredLines = 0;

    for (const fileCoverage of Object.values(coverageMap)) {
      for (const [, count] of Object.entries(fileCoverage.s)) {
        totalStatements++;
        if (count > 0) coveredStatements++;
      }

      for (const [, counts] of Object.entries(fileCoverage.b)) {
        for (const count of counts) {
          totalBranches++;
          if (count > 0) coveredBranches++;
        }
      }

      for (const [, count] of Object.entries(fileCoverage.f)) {
        totalFunctions++;
        if (count > 0) coveredFunctions++;
      }

      const lineMap = this.buildLineMap(fileCoverage);
      for (const [, count] of Object.entries(lineMap)) {
        totalLines++;
        if (count > 0) coveredLines++;
      }
    }

    return {
      statements: totalStatements > 0 ? Math.round((coveredStatements / totalStatements) * 10000) / 100 : 0,
      branches: totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 10000) / 100 : 0,
      functions: totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 10000) / 100 : 0,
      lines: totalLines > 0 ? Math.round((coveredLines / totalLines) * 10000) / 100 : 0,
    };
  }

  private buildLineMap(fileCoverage: NonNullable<JestAggregatedResult['coverageMap']>[string]): Record<string, number> {
    const lineMap: Record<string, number> = {};
    
    for (const [stmtId, count] of Object.entries(fileCoverage.s)) {
      const stmt = fileCoverage.statementMap[stmtId];
      if (stmt) {
        for (let line = stmt.start.line; line <= stmt.end.line; line++) {
          const key = `${line}`;
          lineMap[key] = (lineMap[key] || 0) + count;
        }
      }
    }
    
    return lineMap;
  }

  private extractFailures(testResults: JestAggregatedResult['testResults']): TestFailure[] {
    const failures: TestFailure[] = [];

    for (const testResult of testResults) {
      if (testResult.status === 'failed') {
        for (const failureMessage of testResult.failureMessages) {
          const fileMatch = failureMessage.match(/at\s+(.+?):(\d+):(\d+)/);
          const file = fileMatch ? fileMatch[1] : 'unknown';
          
          failures.push({
            testName: [...testResult.ancestorTitles, testResult.name].join(' > '),
            file,
            message: failureMessage.split('\n')[0],
            stack: failureMessage,
          });
        }
      }
    }

    return failures;
  }

  private getMemoryUsage(): BenchmarkMetrics['memoryUsage'] {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100,
    };
  }

  private getJestVersion(): string {
    try {
      const packageJsonPath = path.join(this.projectRoot, 'node_modules', 'jest', 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        return pkg.version;
      }
    } catch {
      // Ignore errors
    }
    return 'unknown';
  }

  private buildErrorResult(error: Error): VerificationResult {
    return {
      status: 'error',
      benchmarks: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        passRate: 0,
        duration: Date.now() - this.startTime,
        coverage: { statements: 0, branches: 0, functions: 0, lines: 0 },
        memoryUsage: this.getMemoryUsage(),
      },
      failures: [{
        testName: 'Process Error',
        file: 'testSuiteVerificationService.ts',
        message: error.message,
        stack: error.stack,
      }],
      timestamp: new Date(),
      jestVersion: this.getJestVersion(),
      nodeVersion: process.version,
    };
  }

  private buildParseErrorResult(error: Error, duration: number): VerificationResult {
    return {
      status: 'error',
      benchmarks: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        passRate: 0,
        duration,
        coverage: { statements: 0, branches: 0, functions: 0, lines: 0 },
        memoryUsage: this.getMemoryUsage(),
      },
      failures: [{
        testName: 'Parse Error',
        file: 'testSuiteVerificationService.ts',
        message: error.message,
        stack: error.stack,
      }],
      timestamp: new Date(),
      jestVersion: this.getJestVersion(),
      nodeVersion: process.version,
    };
  }

  private cleanup(): void {
    if (this.process) {
      this.process.removeAllListeners();
      this.process = null;
    }
  }

  kill(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }
  }
}

async function cliHandler(): Promise<void> {
  const args = process.argv.slice(2);
  const projectRoot = args.find(arg => arg.startsWith('--project-root='))?.split('=')[1] || process.cwd();
  const outputPath = args.find(arg => arg.startsWith('--output='))?.split('=')[1];
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Test Suite Verification Service - CLI

Usage:
  npx ts-node src/services/testSuiteVerificationService.ts [options]

Options:
  --project-root=<path>   Project root directory (default: current working directory)
  --output=<path>         Output JSON file path for benchmarks
  --help, -h              Show this help message

Examples:
  npx ts-node src/services/testSuiteVerificationService.ts
  npx ts-node src/services/testSuiteVerificationService.ts --project-root=/path/to/project --output=./benchmarks/verification.json
`);
    process.exit(0);
  }

  try {
    console.log(`[Verification] Starting test suite verification in ${projectRoot}`);
    const result = await TestSuiteVerificationService.runVerification(projectRoot, outputPath);
    
    console.log(`[Verification] Status: ${result.status.toUpperCase()}`);
    console.log(`[Verification] Tests: ${result.benchmarks.passedTests}/${result.benchmarks.totalTests} passed (${result.benchmarks.passRate.toFixed(2)}%)`);
    console.log(`[Verification] Duration: ${result.benchmarks.duration}ms`);
    console.log(`[Verification] Coverage: ${result.benchmarks.coverage.statements}% statements, ${result.benchmarks.coverage.branches}% branches, ${result.benchmarks.coverage.functions}% functions, ${result.benchmarks.coverage.lines}% lines`);
    
    if (result.failures.length > 0) {
      console.log(`[Verification] Failures: ${result.failures.length}`);
      for (const failure of result.failures) {
        console.error(`  - ${failure.testName} (${failure.file}): ${failure.message}`);
      }
    }

    if (outputPath) {
      console.log(`[Verification] Benchmarks written to ${outputPath}`);
    }

    process.exit(result.status === 'passed' ? 0 : 1);
  } catch (error) {
    console.error('[Verification] Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  cliHandler().catch((error) => {
    console.error('[Verification] Unhandled error:', error);
    process.exit(1);
  });
}

export { cliHandler };