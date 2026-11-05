import { jest } from '@jest/globals';
import { NativeModules } from 'react-native';

// Mock react-native-mmkv
const mockStorage = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn((key: string) => mockStorage.get(key) ?? undefined),
    set: jest.fn((key: string, value: string) => { mockStorage.set(key, value); }),
    delete: jest.fn((key: string) => { mockStorage.delete(key); }),
    clearAll: jest.fn(() => { mockStorage.clear(); }),
    getAllKeys: jest.fn(() => Array.from(mockStorage.keys())),
  })),
}));

// Mock react-native-floating-bubble
jest.mock('react-native-floating-bubble', () => ({
  FloatingBubble: {
    isPermissionGranted: jest.fn().mockResolvedValue(true),
    requestPermission: jest.fn().mockResolvedValue(true),
    show: jest.fn().mockResolvedValue(undefined),
    hide: jest.fn().mockResolvedValue(undefined),
    setPosition: jest.fn().mockResolvedValue(undefined),
    getPosition: jest.fn().mockResolvedValue({ x: 100, y: 100 }),
  },
}));

// Mock NativeModules
const mockHealthCheckModule = {
  runStorageCheck: jest.fn().mockResolvedValue({ available: true, freeSpace: 1024 * 1024 * 500, totalSpace: 1024 * 1024 * 1024 }),
  runShortcutsCheck: jest.fn().mockResolvedValue({ available: true, count: 5 }),
  runBubbleCheck: jest.fn().mockResolvedValue({ available: true, permissionGranted: true, position: { x: 100, y: 100 } }),
  runPerformanceCheck: jest.fn().mockResolvedValue({ available: true, memoryUsage: 45, cpuUsage: 12, fps: 58 }),
  getSystemInfo: jest.fn().mockResolvedValue({ platform: 'ios', version: '17.0', deviceId: 'test-device' }),
};

NativeModules.HealthCheckModule = mockHealthCheckModule;

// Import after mocks
import { HealthCheckService } from '../../src/services/HealthCheckService';
import { SystemHealthReport, HealthCheckName, HealthCheckResult, HealthStatus } from '../../src/types/health';

describe('HealthCheckService Integration Tests', () => {
  let service: HealthCheckService;
  let onReportMock: jest.Mock;
  let onErrorMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStorage.clear();
    
    onReportMock = jest.fn();
    onErrorMock = jest.fn();
    
    service = new HealthCheckService({
      intervalMs: 30000,
      onReport: onReportMock,
      onError: onErrorMock,
    });
  });

  afterEach(() => {
    service.stopPeriodicChecks();
    jest.useRealTimers();
  });

  describe('Periodic Checks Lifecycle', () => {
    it('should start periodic checks and run immediately', async () => {
      await service.startPeriodicChecks();
      
      expect(onReportMock).toHaveBeenCalledTimes(1);
      const report = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.checks).toBeDefined();
      expect(report.checks.storage).toBeDefined();
      expect(report.checks.shortcuts).toBeDefined();
      expect(report.checks.bubble).toBeDefined();
      expect(report.checks.performance).toBeDefined();
    });

    it('should run checks at configured interval', async () => {
      await service.startPeriodicChecks();
      expect(onReportMock).toHaveBeenCalledTimes(1);
      
      // Advance timers by interval
      jest.advanceTimersByTime(30000);
      await Promise.resolve(); // Allow microtasks to flush
      
      expect(onReportMock).toHaveBeenCalledTimes(2);
      
      // Advance again
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      
      expect(onReportMock).toHaveBeenCalledTimes(3);
    });

    it('should stop periodic checks and prevent further runs', async () => {
      await service.startPeriodicChecks();
      expect(onReportMock).toHaveBeenCalledTimes(1);
      
      service.stopPeriodicChecks();
      
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      
      expect(onReportMock).toHaveBeenCalledTimes(1);
    });

    it('should not start duplicate periodic checks', async () => {
      await service.startPeriodicChecks();
      await service.startPeriodicChecks(); // Second call should be no-op
      
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      
      expect(onReportMock).toHaveBeenCalledTimes(2); // Only initial + one interval
    });
  });

  describe('Native Module Failure Recovery', () => {
    it('should gracefully degrade when storage check throws', async () => {
      mockHealthCheckModule.runStorageCheck.mockRejectedValueOnce(new Error('Native module unavailable'));
      
      await service.startPeriodicChecks();
      
      const report = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(report.checks.storage.status).toBe(HealthStatus.UNHEALTHY);
      expect(report.checks.storage.error).toContain('Native module unavailable');
      expect(report.overallStatus).toBe(HealthStatus.DEGRADED);
    });

    it('should gracefully degrade when shortcuts check throws', async () => {
      mockHealthCheckModule.runShortcutsCheck.mockRejectedValueOnce(new Error('Shortcuts permission denied'));
      
      await service.startPeriodicChecks();
      
      const report = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(report.checks.shortcuts.status).toBe(HealthStatus.UNHEALTHY);
      expect(report.overallStatus).toBe(HealthStatus.DEGRADED);
    });

    it('should gracefully degrade when bubble check throws', async () => {
      mockHealthCheckModule.runBubbleCheck.mockRejectedValueOnce(new Error('Bubble permission revoked'));
      
      await service.startPeriodicChecks();
      
      const report = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(report.checks.bubble.status).toBe(HealthStatus.UNHEALTHY);
      expect(report.overallStatus).toBe(HealthStatus.DEGRADED);
    });

    it('should gracefully degrade when performance check throws', async () => {
      mockHealthCheckModule.runPerformanceCheck.mockRejectedValueOnce(new Error('Performance monitor crashed'));
      
      await service.startPeriodicChecks();
      
      const report = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(report.checks.performance.status).toBe(HealthStatus.UNHEALTHY);
      expect(report.overallStatus).toBe(HealthStatus.DEGRADED);
    });

    it('should recover when native module succeeds after failure', async () => {
      // First check fails
      mockHealthCheckModule.runStorageCheck.mockRejectedValueOnce(new Error('Temporary failure'));
      await service.startPeriodicChecks();
      
      let report = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(report.checks.storage.status).toBe(HealthStatus.UNHEALTHY);
      
      // Second check succeeds
      mockHealthCheckModule.runStorageCheck.mockResolvedValueOnce({ 
        available: true, 
        freeSpace: 1024 * 1024 * 500, 
        totalSpace: 1024 * 1024 * 1024 
      });
      
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      
      report = onReportMock.mock.calls[1][0] as SystemHealthReport;
      expect(report.checks.storage.status).toBe(HealthStatus.HEALTHY);
      expect(report.overallStatus).toBe(HealthStatus.HEALTHY);
    });

    it('should call onError callback when native module throws', async () => {
      const error = new Error('Critical native failure');
      mockHealthCheckModule.runStorageCheck.mockRejectedValueOnce(error);
      
      await service.startPeriodicChecks();
      
      expect(onErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          checkName: HealthCheckName.STORAGE,
          error: expect.any(Error),
        })
      );
    });

    it('should mark overall status UNHEALTHY when multiple checks fail', async () => {
      mockHealthCheckModule.runStorageCheck.mockRejectedValueOnce(new Error('Storage failed'));
      mockHealthCheckModule.runShortcutsCheck.mockRejectedValueOnce(new Error('Shortcuts failed'));
      mockHealthCheckModule.runBubbleCheck.mockRejectedValueOnce(new Error('Bubble failed'));
      
      await service.startPeriodicChecks();
      
      const report = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(report.overallStatus).toBe(HealthStatus.UNHEALTHY);
    });
  });

  describe('Storage Corruption Handling', () => {
    it('should report STORAGE_DEGRADED when MMKV returns invalid JSON', async () => {
      mockStorage.set('health_check_cache', 'invalid json {{{');
      
      await service.startPeriodicChecks();
      
      const report = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(report.checks.storage.status).toBe(HealthStatus.DEGRADED);
      expect(report.checks.storage.details?.corruptionDetected).toBe(true);
    });

    it('should report STORAGE_DEGRADED when MMKV returns malformed health data', async () => {
      mockStorage.set('health_check_cache', JSON.stringify({ invalid: 'structure' }));
      
      await service.startPeriodicChecks();
      
      const report = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(report.checks.storage.status).toBe(HealthStatus.DEGRADED);
      expect(report.checks.storage.details?.corruptionDetected).toBe(true);
    });

    it('should report STORAGE_DEGRADED when MMKV key contains null bytes', async () => {
      mockStorage.set('health_check_cache', 'valid\x00data');
      
      await service.startPeriodicChecks();
      
      const report = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(report.checks.storage.status).toBe(HealthStatus.DEGRADED);
    });

    it('should recover from corruption when valid data is written', async () => {
      // First: corrupted data
      mockStorage.set('health_check_cache', 'corrupted');
      await service.startPeriodicChecks();
      
      let report = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(report.checks.storage.status).toBe(HealthStatus.DEGRADED);
      
      // Second: valid data written by service
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      
      report = onReportMock.mock.calls[1][0] as SystemHealthReport;
      expect(report.checks.storage.status).toBe(HealthStatus.HEALTHY);
      expect(report.checks.storage.details?.corruptionDetected).toBe(false);
    });

    it('should handle MMKV getString throwing exception', async () => {
      // We need to mock the MMKV instance to throw on getString
      const { MMKV } = require('react-native-mmkv');
      const mockInstance = MMKV.mock.results[0]?.value;
      if (mockInstance) {
        mockInstance.getString.mockImplementationOnce(() => {
          throw new Error('MMKV read error');
        });
      }
      
      await service.startPeriodicChecks();
      
      const report = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(report.checks.storage.status).toBe(HealthStatus.UNHEALTHY);
      expect(report.checks.storage.error).toContain('MMKV read error');
    });

    it('should handle MMKV set throwing exception during write', async () => {
      const { MMKV } = require('react-native-mmkv');
      const mockInstance = MMKV.mock.results[0]?.value;
      if (mockInstance) {
        mockInstance.set.mockImplementationOnce(() => {
          throw new Error('MMKV write error');
        });
      }
      
      await service.startPeriodicChecks();
      
      const report = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(report.checks.storage.status).toBe(HealthStatus.DEGRADED);
      expect(report.checks.storage.error).toContain('MMKV write error');
    });
  });

  describe('Concurrent Periodic Checks', () => {
    it('should not race when startPeriodicChecks called concurrently', async () => {
      const startPromises = [
        service.startPeriodicChecks(),
        service.startPeriodicChecks(),
        service.startPeriodicChecks(),
      ];
      
      await Promise.all(startPromises);
      
      // Should only have run once initially
      expect(onReportMock).toHaveBeenCalledTimes(1);
      
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      
      // Should only run once per interval
      expect(onReportMock).toHaveBeenCalledTimes(2);
    });

    it('should maintain consistent lastReport under concurrent access', async () => {
      await service.startPeriodicChecks();
      
      const initialReport = onReportMock.mock.calls[0][0] as SystemHealthReport;
      const initialTimestamp = initialReport.timestamp;
      
      // Simulate concurrent check triggers by advancing timers rapidly
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      }
      
      // Advance to next interval
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      
      const secondReport = onReportMock.mock.calls[1][0] as SystemHealthReport;
      expect(secondReport.timestamp).toBeGreaterThan(initialTimestamp);
      
      // Verify no duplicate reports in same interval
      const timestamps = onReportMock.mock.calls.map(call => (call[0] as SystemHealthReport).timestamp);
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBe(timestamps.length);
    });

    it('should handle rapid start/stop cycles without leaking timers', async () => {
      for (let i = 0; i < 10; i++) {
        await service.startPeriodicChecks();
        service.stopPeriodicChecks();
      }
      
      // Should not have any pending timers
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
      
      // Only the last start should have produced a report (but it was stopped)
      // Actually each start produces immediate report, but stop prevents interval
      expect(onReportMock).toHaveBeenCalledTimes(10);
    });

    it('should serialize concurrent runCheck calls', async () => {
      await service.startPeriodicChecks();
      
      // Trigger multiple manual checks concurrently
      const checkPromises = [
        service.runCheck(HealthCheckName.STORAGE),
        service.runCheck(HealthCheckName.SHORTCUTS),
        service.runCheck(HealthCheckName.BUBBLE),
        service.runCheck(HealthCheckName.PERFORMANCE),
      ];
      
      const results = await Promise.all(checkPromises);
      
      // All should complete successfully
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.status).toBeDefined();
      });
      
      // Verify no duplicate native calls
      expect(mockHealthCheckModule.runStorageCheck).toHaveBeenCalledTimes(2); // Once from periodic, once from manual
      expect(mockHealthCheckModule.runShortcutsCheck).toHaveBeenCalledTimes(2);
      expect(mockHealthCheckModule.runBubbleCheck).toHaveBeenCalledTimes(2);
      expect(mockHealthCheckModule.runPerformanceCheck).toHaveBeenCalledTimes(2);
    });
  });

  describe('Report Generation Under Load', () => {
    it('should generate 100 reports rapidly with stable memory', async () => {
      const reports: SystemHealthReport[] = [];
      const originalOnReport = onReportMock;
      
      onReportMock.mockImplementation((report: SystemHealthReport) => {
        reports.push(report);
        originalOnReport(report);
      });
      
      await service.startPeriodicChecks();