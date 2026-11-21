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

  private buildJestArgs(): string[] {
    const args = [
      '--json',
      '--coverage',
      '--testPathPattern=tests',
      '--passWithNoTests',
      '--no-cache',
      '--runInBand',
    ];

    if (fs.existsSync(this.jestConfigPath)) {
      args.push('--config', this.jestConfigPath);
    }

    return args;
  }

  private resolveJestCommand(): string {
    const localJest = path.join(this.projectRoot, 'node_modules', '.bin', 'jest');
    const localJestCmd = process.platform === 'win32' ? `${localJest}.cmd` : localJest;
    
    if (fs.existsSync(localJestCmd)) {
      return localJestCmd;
    }
    
    return 'npx';
  }

  private parseJestOutput(exitCode: number | null, signal: NodeJS.Signals | null, duration: number): VerificationResult {
    let jestOutput: JestAggregatedResult;

    try {
      const jsonStart = this.stdoutBuffer.indexOf('{');
      const jsonEnd = this.stdoutBuffer.lastIndexOf('}') + 1;
      
      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error('No JSON output found in Jest stdout');
      }

      const jsonOutput = this.stdoutBuffer.slice(jsonStart, jsonEnd);
      jestOutput = JSON.parse(jsonOutput);
    } catch (error) {
      throw new Error(`Failed to parse Jest JSON output: ${(error as Error).message}\nStdout: ${this.stdoutBuffer.slice(0, 500)}`);
    }

    const benchmarks = this.extractBenchmarks(jestOutput, duration);
    const failures = this.extractFailures(jestOutput);
    const status = this.determineStatus(exitCode, signal, jestOutput, failures.length);

    return {
      status,
      benchmarks,
      failures,
      timestamp: new Date(),
      jestVersion: this.getJestVersion(),
      nodeVersion: process.version,
    };
  }

  private extractBenchmarks(jestOutput: JestAggregatedResult, duration: number): BenchmarkMetrics {
    const totalTests = jestOutput.numTotalTests;
    const passedTests = jestOutput.numPassedTests;
    const failedTests = jestOutput.numFailedTests;
    const skippedTests = jestOutput.numPendingTests;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 100;

    let coverage = {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    };

    if (jestOutput.coverageMap) {
      coverage = this.calculateCoverage(jestOutput.coverageMap);
    }

    const memoryUsage = process.memoryUsage();

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      passRate: Math.round(passRate * 100) / 100,
      duration,
      coverage,
      memoryUsage: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
      },
    };
  }

  private calculateCoverage(coverageMap: JestAggregatedResult['coverageMap']): BenchmarkMetrics['coverage'] {
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

      const lineMap = this.extractLineCoverage(fileCoverage);
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

  private extractLineCoverage(fileCoverage: NonNullable<JestAggregatedResult['coverageMap']>[string]): Record<string, number> {
    const lineMap: Record<string, number> = {};
    
    for (const [statementId, count] of Object.entries(fileCoverage.s)) {
      const statement = fileCoverage.statementMap[statementId];
      if (statement) {
        const line = statement.start.line;
        lineMap[line] = (lineMap[line] || 0) + count;
      }
    }

    return lineMap;
  }

  private extractFailures(jestOutput: JestAggregatedResult): TestFailure[] {
    const failures: TestFailure[] = [];

    for (const testResult of jestOutput.testResults) {
      if (testResult.status === 'failed') {
        for (const failureMessage of testResult.failureMessages) {
          const parsed = this.parseFailureMessage(failureMessage, testResult);
          failures.push(parsed);
        }
      }
    }

    return failures;
  }

  private parseFailureMessage(message: string, testResult: JestAggregatedResult['testResults'][0]): TestFailure {
    const lines = message.split('\n');
    let testName = testResult.ancestorTitles.join(' > ') + ' > ' + (lines[0] || 'Unknown test');
    let file = 'unknown';
    let stack: string | undefined;

    const fileMatch = message.match(/at\s+(.+?):(\d+):(\d+)/);
    if (fileMatch) {
      file = fileMatch[1];
    }

    const stackStart = message.indexOf('\n    at ');
    if (stackStart !== -1) {
      stack = message.slice(stackStart + 1).trim();
    }

    return {
      testName: testName.trim(),
      file,
      message: lines[0] || 'Test failed',
      stack,
    };
  }

  private determineStatus(
    exitCode: number | null,
    signal: NodeJS.Signals | null,
    jestOutput: JestAggregatedResult,
    failureCount: number
  ): TestSuiteStatus {
    if (signal) {
      return 'error';
    }

    if (exitCode !== 0 && exitCode !== null) {
      return jestOutput.success ? 'passed' : 'failed';
    }

    return failureCount > 0 ? 'failed' : 'passed';
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
      },
      failures: [{
        testName: 'Parse Error',
        file: 'testSuiteVerificationService.ts',
        message: `Failed to parse Jest output: ${error.message}`,
        stack: error.stack,
      }],
      timestamp: new Date(),
      jestVersion: this.getJestVersion(),
      nodeVersion: process.version,
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
      // Ignore
    }
    return 'unknown';
  }

  private cleanup(): void {
    if (this.process) {
      this.process.removeAllListeners();
      if (!this.process.killed) {
        this.process.kill('SIGTERM');
      }
      this.process = null;
    }
  }

  async terminate(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process?.once('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

export const testSuiteVerificationService = new TestSuiteVerificationService();