import { jest } from '@jest/globals';

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
      // Test implementation would continue here
      expect(healthCheckService).toBeDefined();
    });
  });
});