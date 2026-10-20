```typescript
import { jest } from '@jest/globals';

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => {
  const mockStorage = new Map<string, string>();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: jest.fn((key: string) => mockStorage.get(key) ?? undefined),
      set: jest.fn((key: string, value: string) => mockStorage.set(key, value)),
      delete: jest.fn((key: string) => mockStorage.delete(key)),
      clearAll: jest.fn(() => mockStorage.clear()),
      getAllKeys: jest.fn(() => Array.from(mockStorage.keys())),
    })),
  };
});

// Mock react-native-floating-bubble
jest.mock('react-native-floating-bubble', () => ({
  FloatingBubble: {
    isPermissionGranted: jest.fn(),
    requestPermission: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    updatePosition: jest.fn(),
    setOnTouchListener: jest.fn(),
    setOnLongPressListener: jest.fn(),
  },
}));

// Mock internal services
jest.mock('../../src/services/shortcutsService', () => ({
  ShortcutsService: {
    getInstance: jest.fn(() => ({
      getAllShortcuts: jest.fn(),
      isEnabled: jest.fn(),
      initialize: jest.fn(),
    })),
  },
}));

jest.mock('../../src/services/performanceMonitor', () => ({
  PerformanceMonitor: {
    getInstance: jest.fn(() => ({
      getMetrics: jest.fn(),
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn(),
    })),
  },
}));

jest.mock('../../src/services/storageService', () => ({
  StorageService: {
    getInstance: jest.fn(() => ({
      getStorageInfo: jest.fn(),
      healthCheck: jest.fn(),
    })),
  },
}));

import { HealthCheckService } from '../../src/services/healthCheckService';
import { MMKV } from 'react-native-mmkv';
import { FloatingBubble } from 'react-native-floating-bubble';
import { ShortcutsService } from '../../src/services/shortcutsService';
import { PerformanceMonitor } from '../../src/services/performanceMonitor';
import { StorageService } from '../../src/services/storageService';

describe('HealthCheckService', () => {
  let healthCheckService: HealthCheckService;
  let mockMMKV: jest.Mocked<MMKV>;
  let mockFloatingBubble: jest.Mocked<typeof FloatingBubble>;
  let mockShortcutsService: jest.Mocked<ShortcutsService>;
  let mockPerformanceMonitor: jest.Mocked<PerformanceMonitor>;
  let mockStorageService: jest.Mocked<StorageService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockMMKV = new MMKV() as jest.Mocked<MMKV>;
    mockFloatingBubble = FloatingBubble as jest.Mocked<typeof FloatingBubble>;
    mockShortcutsService = ShortcutsService.getInstance() as jest.Mocked<ShortcutsService>;
    mockPerformanceMonitor = PerformanceMonitor.getInstance() as jest.Mocked<PerformanceMonitor>;
    mockStorageService = StorageService.getInstance() as jest.Mocked<StorageService>;

    healthCheckService = HealthCheckService.getInstance();
  });

  describe('runAllChecks', () => {
    it('should return a complete SystemHealthReport with all check types', async () => {
      // Setup mocks for healthy state
      mockStorageService.healthCheck.mockResolvedValue({
        isHealthy: true,
        details: { usedSpace: 1024, totalSpace: 10240, percentage: 10 },
      });
      mockShortcutsService.getAllShortcuts.mockResolvedValue([
        { id: '1', trigger: 'test', action: 'action1' },
      ]);
      mockShortcutsService.isEnabled.mockResolvedValue(true);
      mockFloatingBubble.isPermissionGranted.mockResolvedValue(true);
      mockPerformanceMonitor.getMetrics.mockResolvedValue({
        memoryUsage: 50,
        cpuUsage: 30,
        frameRate: 60,
        batteryLevel: 80,
      });

      const report = await healthCheckService.runAllChecks();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.overallStatus).toBeDefined();
      expect(report.checks).toBeDefined();
      expect(report.checks.storage).toBeDefined();
      expect(report.checks.shortcuts).toBeDefined();
      expect(report.checks.bubble).toBeDefined();
      expect(report.checks.performance).toBeDefined();
    });

    it('should return healthy status when all checks pass', async () => {
      mockStorageService.healthCheck.mockResolvedValue({
        isHealthy: true,
        details: { usedSpace: 1024, totalSpace: 10240, percentage: 10 },
      });
      mockShortcutsService.getAllShortcuts.mockResolvedValue([{ id: '1', trigger: 'test', action: 'action1' }]);
      mockShortcutsService.isEnabled.mockResolvedValue(true);
      mockFloatingBubble.isPermissionGranted.mockResolvedValue(true);
      mockPerformanceMonitor.getMetrics.mockResolvedValue({
        memoryUsage: 50,
        cpuUsage: 30,
        frameRate: 60,
        batteryLevel: 80,
      });

      const report = await healthCheckService.runAllChecks();

      expect(report.overallStatus).toBe('healthy');
      expect(report.checks.storage.status).toBe('healthy');
      expect(report.checks.shortcuts.status).toBe('healthy');
      expect(report.checks.bubble.status).toBe('healthy');
      expect(report.checks.performance.status).toBe('healthy');
    });

    it('should return degraded status when one check is degraded', async () => {
      mockStorageService.healthCheck.mockResolvedValue({
        isHealthy: true,
        details: { usedSpace: 8192, totalSpace: 10240, percentage: 80 },
      });
      mockShortcutsService.getAllShortcuts.mockResolvedValue([{ id: '1', trigger: 'test', action: 'action1' }]);
      mockShortcutsService.isEnabled.mockResolvedValue(true);
      mockFloatingBubble.isPermissionGranted.mockResolvedValue(true);
      mockPerformanceMonitor.getMetrics.mockResolvedValue({
        memoryUsage: 50,
        cpuUsage: 30,
        frameRate: 60,
        batteryLevel: 80,
      });

      const report = await healthCheckService.runAllChecks();

      expect(report.overallStatus).toBe('degraded');
      expect(report.checks.storage.status).toBe('degraded');
    });

    it('should return unhealthy status when one check fails', async () => {
      mockStorageService.healthCheck.mockResolvedValue({
        isHealthy: false,
        details: { error: 'Storage corrupted' },
      });
      mockShortcutsService.getAllShortcuts.mockResolvedValue([{ id: '1', trigger: 'test', action: 'action1' }]);
      mockShortcutsService.isEnabled.mockResolvedValue(true);
      mockFloatingBubble.isPermissionGranted.mockResolvedValue(true);
      mockPerformanceMonitor.getMetrics.mockResolvedValue({
        memoryUsage: 50,
        cpuUsage: 30,
        frameRate: 60,
        batteryLevel: 80,
      });

      const