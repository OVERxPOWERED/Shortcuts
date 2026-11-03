import { jest } from '@jest/globals';
import { NativeModules } from 'react-native';

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => {
  const mockStorage = new Map<string, string>();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: jest.fn((key: string) => mockStorage.get(key) ?? undefined),
      set: jest.fn((key: string, value: string) => { mockStorage.set(key, value); }),
      delete: jest.fn((key: string) => { mockStorage.delete(key); }),
      clearAll: jest.fn(() => { mockStorage.clear(); }),
      getAllKeys: jest.fn(() => Array.from(mockStorage.keys())),
    })),
  };
});

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
import { SystemHealthReport, HealthCheckName, HealthCheckResult } from '../../src/types/health';

describe('HealthCheckService Integration Tests', () => {
  let service: HealthCheckService;
  let onReportMock: jest.Mock;
  let onErrorMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    
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

    it('should not start duplicate intervals if already running', async () => {
      await service.startPeriodicChecks();
      await service.startPeriodicChecks(); // Call again
      
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      
      // Should only have run twice (initial + one interval), not 3 times
      expect(onReportMock).toHaveBeenCalledTimes(2);
    });

    it('should handle rapid start/stop cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await service.startPeriodicChecks();
        service.stopPeriodicChecks();
      }
      
      // Should not throw and should be in stopped state
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      
      expect(onReportMock).toHaveBeenCalledTimes(5); // Each start runs once
    });
  });

  describe('runChecks() Report Generation', () => {
    it('should return SystemHealthReport with all metrics', async () => {
      const report = await service.runChecks();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.deviceId).toBe('test-device');
      expect(report.platform).toBe('ios');
      expect(report.version).toBe('17.0');
      
      // Verify all check categories present
      expect(report.checks.storage).toBeDefined();
      expect(report.checks.shortcuts).toBeDefined();
      expect(report.checks.bubble).toBeDefined();
      expect(report.checks.performance).toBeDefined();
    });

    it('should include storage check with correct structure', async () => {
      const report = await service.runChecks();
      const storage = report.checks.storage;
      
      expect(storage.name).toBe(HealthCheckName.STORAGE);
      expect(storage.status).toBe('healthy');
      expect(storage.details).toBeDefined();
      expect(storage.details.available).toBe(true);
      expect(storage.details.freeSpace).toBe(1024 * 1024 * 500);
      expect(storage.details.totalSpace).toBe(1024 * 1024 * 1024);
      expect(storage.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include shortcuts check with correct structure', async () => {
      const report = await service.runChecks();
      const shortcuts = report.checks.shortcuts;
      
      expect(shortcuts.name).toBe(HealthCheckName.SHORTCUTS);
      expect(shortcuts.status).toBe('healthy');
      expect(shortcuts.details).toBeDefined();
      expect(shortcuts.details.available).toBe(true);
      expect(shortcuts.details.count).toBe(5);
      expect(shortcuts.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include bubble check with correct structure', async () => {
      const report = await service.runChecks();
      const bubble = report.checks.bubble;
      
      expect(bubble.name).toBe(HealthCheckName.BUBBLE);
      expect(bubble.status).toBe('healthy');
      expect(bubble.details).toBeDefined();
      expect(bubble.details.available).toBe(true);
      expect(bubble.details.permissionGranted).toBe(true);
      expect(bubble.details.position).toEqual({ x: 100, y: 100 });
      expect(bubble.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include performance check with correct structure', async () => {
      const report = await service.runChecks();
      const performance = report.checks.performance;
      
      expect(performance.name).toBe(HealthCheckName.PERFORMANCE);
      expect(performance.status).toBe('healthy');
      expect(performance.details).toBeDefined();
      expect(performance.details.available).toBe(true);
      expect(performance.details.memoryUsage).toBe(45);
      expect(performance.details.cpuUsage).toBe(12);
      expect(performance.details.fps).toBe(58);
      expect(performance.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should fire onReport callback with generated report', async () => {
      await service.runChecks();
      
      expect(onReportMock).toHaveBeenCalledTimes(1);
      const callbackReport = onReportMock.mock.calls[0][0] as SystemHealthReport;
      expect(callbackReport).toEqual(expect.objectContaining({
        timestamp: expect.any(Date),
        checks: expect.objectContaining({
          storage: expect.any(Object),
          shortcuts: expect.any(Object),
          bubble: expect.any(Object),
          performance: expect.any(Object),
        }),
      }));
    });

    it('should calculate overall status as healthy when all checks pass', async () => {
      const report = await service.runChecks();
      expect(report.overallStatus).toBe('healthy');
    });

    it('should calculate overall status as degraded when any check is degraded', async () => {
      mockHealthCheckModule.runStorageCheck.mockResolvedValueOnce({
        available: true,
        freeSpace: 1024 * 1024 * 50, // Low space
        totalSpace: 1024 * 1024 * 1024,
      });
      
      const report = await service.runChecks();
      expect(report.overallStatus).toBe('degraded');
    });

    it('should calculate overall status as critical when any check fails', async () => {
      mockHealthCheckModule.runStorageCheck.mockResolvedValueOnce({
        available: false,
        freeSpace: 0,
        totalSpace: 1024 * 1024 * 1024,
      });
      
      const report = await service.runChecks();
      expect(report.overallStatus).toBe('critical');
    });
  });

  describe('Native Module Interaction', () => {
    it('should call all native module methods during runChecks', async () => {
      await service.runChecks();
      
      expect(mockHealthCheckModule.runStorageCheck).toHaveBeenCalledTimes(1);
      expect(mockHealthCheckModule.runShortcutsCheck).toHaveBeenCalledTimes(1);
      expect(mockHealthCheckModule.runBubbleCheck).toHaveBeenCalledTimes(1);
      expect(mockHealthCheckModule.runPerformanceCheck).toHaveBeenCalledTimes(1);
      expect(mockHealthCheckModule.getSystemInfo).toHaveBeenCalledTimes(1);
    });

    it('should handle native module unavailable gracefully', async () => {
      // Remove the native module
      const originalModule = NativeModules.HealthCheckModule;
      (NativeModules as any).HealthCheckModule = null;
      
      const newService = new HealthCheckService({
        intervalMs: 30000,
        onReport: onReportMock,
        onError: onErrorMock,
      });
      
      const report = await newService.runChecks();
      
      // Should return a report with all checks marked as unavailable/error
      expect(report.checks.storage.status).toBe('critical');
      expect(report.checks.storage.details.available).toBe(false);
      expect(report.checks.storage.details.error).toContain('Native module unavailable');
      
      expect(onErrorMock).toHaveBeenCalled();
      
      // Restore
      (NativeModules as any).HealthCheckModule = originalModule;
    });

    it('should handle individual native method failures', async () => {
      mockHealthCheckModule.runStorageCheck.mockRejectedValueOnce(new Error('Storage check failed'));
      
      const report = await service.runChecks();
      
      expect(report.checks.storage.status).toBe('critical');
      expect(report.checks.storage.details.error).toBe('Storage check failed');
      expect(report.overallStatus).toBe('critical');
      
      // Other checks should still run
      expect(mockHealthCheckModule.runShortcutsCheck).toHaveBeenCalled();
      expect(mockHealthCheckModule.runBubbleCheck).toHaveBeenCalled();
      expect(mockHealthCheckModule.runPerformanceCheck).toHaveBeenCalled();
    });

    it('should handle partial native module (some methods missing)', async () => {
      const partialModule = {
        runStorageCheck: mockHealthCheckModule.runStorageCheck,
        runShortcutsCheck: mockHealthCheckModule.runShortcutsCheck,
        // Missing runBubbleCheck and runPerformanceCheck
        getSystemInfo: mockHealthCheckModule.getSystemInfo,
      };
      (NativeModules as any).HealthCheckModule = partialModule;
      
      const newService = new HealthCheckService({
        intervalMs: 30000,
        onReport: onReportMock,
        onError: onErrorMock,
      });
      
      const report = await newService.runChecks();
      
      expect(report.checks.storage.status).toBe('healthy');
      expect(report.checks.shortcuts.status).toBe('healthy');
      expect(report.checks.bubble.status).toBe('critical');
      expect(report.checks.bubble.details.error).toContain('Method runBubbleCheck not available');
      expect(report.checks.performance.status).toBe('critical');
      expect(report.checks.performance.details.error).toContain('Method runPerformanceCheck not available');
      
      (NativeModules as any).HealthCheckModule = mockHealthCheckModule;
    });
  });

  describe('Error Handling and Callbacks', () => {
    it('should fire onError callback when native module throws', async () => {
      mockHealthCheckModule.runStorageCheck.mockRejectedValueOnce(new Error('Native error'));
      
      await service.runChecks();
      
      expect(onErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Native error',
          checkName: HealthCheckName.STORAGE,
        })
      );
    });

    it('should fire onError for each failed check', async () => {
      mockHealthCheckModule.runStorageCheck.mockRejectedValueOnce(new Error('Storage failed'));
      mockHealthCheckModule.runShortcutsCheck.mockRejectedValueOnce(new Error('Shortcuts failed'));
      
      await service.runChecks();
      
      expect(onErrorMock).toHaveBeenCalledTimes(2);
      expect(onErrorMock.mock.calls[0][0].checkName).toBe(HealthCheckName.STORAGE);
      expect(onErrorMock.mock.calls[1][0].checkName).toBe(HealthCheckName.SHORTCUTS);
    });

    it('should not fire onError for successful checks', async () => {
      await service.runChecks();
      
      expect(onErrorMock).not.toHaveBeenCalled();
    });

    it('should handle onReport callback throwing without breaking service', async () => {
      onReportMock.mockImplementationOnce(() => { throw new Error('Callback error'); });
      
      // Should not throw
      await expect(service.runChecks()).resolves.toBeDefined();
      
      // Service should still be functional
      onReportMock.mockImplementationOnce(() => {});
      const report = await service.runChecks();
      expect(report).toBeDefined();
    });

    it('should handle onError callback throwing without breaking service', async () => {
      mockHealthCheckModule.runStorageCheck.mockRejectedValueOnce(new Error('Native error'));
      onErrorMock.mockImplementationOnce(() => { throw new Error('Callback error'); });
      
      // Should not throw
      await expect(service.runChecks()).resolves.toBeDefined();
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should clear interval on stopPeriodicChecks', async () => {
      await service.startPeriodicChecks();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      service.stopPeriodicChecks();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should not leak intervals on multiple start/stop', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      for (let i = 0; i < 3; i++) {
        await service.startPeriodicChecks();
        service.stopPeriodicChecks();
      }
      
      expect(setIntervalSpy).toHaveBeenCalledTimes(3);
      expect(clearIntervalSpy).toHaveBeenCalledTimes(3);
      
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    it('should allow restart after stop', async () => {
      await service