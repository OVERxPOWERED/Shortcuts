```typescript
import { MMKV } from 'react-native-mmkv';
import FloatingBubble from 'react-native-floating-bubble';
import { Platform, NativeModules } from 'react-native';
import {
  SystemHealthReport,
  HealthCheckResult,
  HealthCheckConfig,
  HealthCheckName,
  HealthStatus,
  StorageHealthMetrics,
  ShortcutsHealthMetrics,
  BubbleHealthMetrics,
  PerformanceHealthMetrics,
} from '../types/health';
import { storage } from './storage';
import { shortcutsService } from './shortcuts';

const NATIVE_MODULE_NAME = 'FloatingBubbleManager';

interface PeriodicCheckConfig {
  intervalMs: number;
  checks?: HealthCheckName[];
  onReport?: (report: SystemHealthReport) => void;
  onError?: (error: Error) => void;
}

export class HealthCheckService {
  private static instance: HealthCheckService;
  private periodicTimer: ReturnType<typeof setInterval> | null = null;
  private periodicConfig: PeriodicCheckConfig | null = null;
  private isRunning = false;
  private lastReport: SystemHealthReport | null = null;

  private constructor() {}

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  async runAllChecks(): Promise<SystemHealthReport> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];

    checks.push(await this.checkStorage());
    checks.push(await this.checkShortcuts());
    checks.push(await this.checkBubble());
    checks.push(await this.checkPerformance());
    checks.push(await this.checkNativeModules());

    const overallStatus = this.calculateOverallStatus(checks);
    const report: SystemHealthReport = {
      timestamp: new Date().toISOString(),
      overallStatus,
      checks,
      durationMs: Date.now() - startTime,
    };

    this.lastReport = report;
    return report;
  }

  async runSingleCheck(name: HealthCheckName): Promise<HealthCheckResult> {
    switch (name) {
      case 'storage':
        return this.checkStorage();
      case 'shortcuts':
        return this.checkShortcuts();
      case 'bubble':
        return this.checkBubble();
      case 'performance':
        return this.checkPerformance();
      case 'nativeModules':
        return this.checkNativeModules();
      default:
        return this.createErrorResult(name, `Unknown health check: ${name}`);
    }
  }

  private async checkStorage(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checkName: HealthCheckName = 'storage';

    try {
      const testKey = '__health_check_test__';
      const testValue = { timestamp: Date.now(), random: Math.random() };

      await storage.set(testKey, testValue);
      const retrieved = await storage.get(testKey);
      await storage.delete(testKey);

      const isValid = retrieved && retrieved.timestamp === testValue.timestamp;

      const metrics: StorageHealthMetrics = {
        readLatencyMs: Date.now() - startTime,
        writeLatencyMs: 0,
        availableSpaceBytes: await this.getStorageAvailableSpace(),
        totalKeys: await this.getStorageKeyCount(),
        encryptionEnabled: storage.isEncrypted(),
      };

      return {
        name: checkName,
        status: isValid ? 'healthy' : 'degraded',
        message: isValid ? 'Storage read/write operations successful' : 'Storage data integrity check failed',
        metrics,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return this.createErrorResult(checkName, `Storage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`, Date.now() - startTime);
    }
  }

  private async checkShortcuts(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checkName: HealthCheckName = 'shortcuts';

    try {
      const isAvailable = await shortcutsService.isAvailable();
      
      if (!isAvailable) {
        return {
          name: checkName,
          status: 'unhealthy',
          message: 'Shortcuts service not available on this platform',
          metrics: { available: false, responseTimeMs: 0, registeredShortcuts: 0, lastExecutionSuccess: false },
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        };
      }

      const registeredShortcuts = await shortcutsService.getRegisteredShortcuts();
      const testShortcut = registeredShortcuts[0];
      let lastExecutionSuccess = true;
      let executionTime = 0;

      if (testShortcut) {
        const execStart = Date.now();
        try {
          await shortcutsService.executeShortcut(testShortcut.id);
          executionTime = Date.now() - execStart;
        } catch {
          lastExecutionSuccess = false;
          executionTime = Date.now() - execStart;
        }
      }

      const metrics: ShortcutsHealthMetrics = {
        available: true,
        responseTimeMs: executionTime,
        registeredShortcuts: registeredShortcuts.length,
        lastExecutionSuccess,
      };

      const status: HealthStatus = lastExecutionSuccess ? 'healthy' : 'degraded';
      const message = lastExecutionSuccess 
        ? `Shortcuts service responsive (${registeredShortcuts.length} registered)`
        : 'Shortcuts service available but execution failed';

      return {
        name: checkName,
        status,
        message,
        metrics,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return this.createErrorResult(checkName, `Shortcuts check failed: ${error instanceof Error ? error.message : 'Unknown error'}`, Date.now() - startTime);
    }
  }

  private async checkBubble(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checkName: HealthCheckName = 'bubble';

    try {
      const nativeModule = NativeModules[NATIVE_MODULE_NAME];
      const isNativeModuleAvailable = !!nativeModule;
      const isJSModuleAvailable = !!FloatingBubble;

      let bubblePermissionStatus: 'granted' | 'denied' | 'unknown' = 'unknown';
      let canCreateBubble = false;

      if (Platform.OS === 'android' && nativeModule) {
        try {
          bubblePermissionStatus = await nativeModule.checkPermission?.() || 'unknown';
          canCreateBubble = bubblePermissionStatus === 'granted';
        } catch {
          bubblePermissionStatus = 'unknown';
        }
      } else if (Platform.OS === 'ios') {
        canCreateBubble = true;
        bubblePermissionStatus = 'granted';
      }

      const metrics: BubbleHealthMetrics = {
        nativeModuleAvailable: isNativeModuleAvailable,
        jsModuleAvailable: isJSModuleAvailable,
        permissionStatus: bubblePermissionStatus,
        canCreateBubble,
        activeBubbles: 0,
      };

      const allAvailable = isNativeModuleAvailable && isJSModuleAvailable && canCreateBubble;
      const status: HealthStatus = allAvailable ? 'healthy' : isNativeModuleAvailable ? 'degraded' : 'unhealthy';
      
      let message = 'Floating bubble module ';
      if (!isNativeModuleAvailable) {
        message += 'native module not linked';
      } else if (!isJSModuleAvailable) {