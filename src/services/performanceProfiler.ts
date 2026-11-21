import { PerformanceMonitor } from 'react-native-performance-monitor';
import { MMKV } from 'react-native-mmkv';
import { FloatingBubble } from 'react-native-floating-bubble';

export interface PerformanceMetric {
  id: string;
  timestamp: number;
  type: 'bubble_tap' | 'bubble_long_press' | 'bubble_drag' | 'render_cycle' | 'memory_pressure';
  duration: number;
  metadata: Record<string, unknown>;
  thread: 'js' | 'ui' | 'native';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ProfilingConfig {
  flushInterval: number;
  maxBatchSize: number;
  memoryThreshold: number;
  enableNativeMonitoring: boolean;
}

export interface BubbleEventPayload {
  x: number;
  y: number;
  timestamp: number;
  gestureState?: number;
}

const DEFAULT_CONFIG: ProfilingConfig = {
  flushInterval: 5000,
  maxBatchSize: 100,
  memoryThreshold: 150 * 1024 * 1024,
  enableNativeMonitoring: true,
};

const STORAGE_KEYS = {
  METRICS_BUFFER: 'performance_metrics_buffer',
  PROFILING_STATE: 'profiling_state',
  AGGREGATED_STATS: 'aggregated_performance_stats',
} as const;

export class PerformanceProfiler {
  private static instance: PerformanceProfiler;
  private monitor: PerformanceMonitor;
  private storage: MMKV;
  private config: ProfilingConfig;
  private isProfiling: boolean = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private metricsBuffer: PerformanceMetric[] = [];
  private bubbleListeners: Map<string, () => void> = new Map();
  private renderCycleStart: number = 0;
  private frameCount: number = 0;

  private constructor(config: Partial<ProfilingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.monitor = new PerformanceMonitor();
    this.storage = new MMKV({ id: 'performance-profiler' });
    this.loadPersistedState();
  }

  static getInstance(config?: Partial<ProfilingConfig>): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler(config);
    }
    return PerformanceProfiler.instance;
  }

  static resetInstance(): void {
    if (PerformanceProfiler.instance) {
      PerformanceProfiler.instance.stopProfiling();
      PerformanceProfiler.instance = null as unknown as PerformanceProfiler;
    }
  }

  private loadPersistedState(): void {
    try {
      const buffer = this.storage.getString(STORAGE_KEYS.METRICS_BUFFER);
      if (buffer) {
        this.metricsBuffer = JSON.parse(buffer);
      }
      this.isProfiling = this.storage.getBoolean(STORAGE_KEYS.PROFILING_STATE) ?? false;
    } catch (error) {
      console.warn('[PerformanceProfiler] Failed to load persisted state:', error);
    }
  }

  private persistState(): void {
    try {
      this.storage.set(STORAGE_KEYS.METRICS_BUFFER, JSON.stringify(this.metricsBuffer));
      this.storage.set(STORAGE_KEYS.PROFILING_STATE, this.isProfiling);
    } catch (error) {
      console.warn('[PerformanceProfiler] Failed to persist state:', error);
    }
  }

  startProfiling(): void {
    if (this.isProfiling) {
      console.warn('[PerformanceProfiler] Already profiling');
      return;
    }

    this.isProfiling = true;
    this.attachBubbleListeners();
    this.startFlushTimer();
    
    if (this.config.enableNativeMonitoring) {
      this.monitor.start();
    }

    this.persistState();
    console.log('[PerformanceProfiler] Profiling started');
  }

  stopProfiling(): void {
    if (!this.isProfiling) {
      console.warn('[PerformanceProfiler] Not currently profiling');
      return;
    }

    this.isProfiling = false;
    this.detachBubbleListeners();
    this.stopFlushTimer();
    this.flushMetrics();
    
    if (this.config.enableNativeMonitoring) {
      this.monitor.stop();
    }

    this.persistState();
    console.log('[PerformanceProfiler] Profiling stopped');
  }

  private attachBubbleListeners(): void {
    const bubble = FloatingBubble.getInstance();
    
    if (!bubble) {
      console.warn('[PerformanceProfiler] FloatingBubble instance not available');
      return;
    }

    const onTapHandler = (payload: BubbleEventPayload) => {
      this.profileBubbleTap(payload);
    };

    const onLongPressHandler = (payload: BubbleEventPayload) => {
      this.profileBubbleLongPress(payload);
    };

    const onDragHandler = (payload: BubbleEventPayload) => {
      this.profileBubbleDrag(payload);
    };

    bubble.on('onTap', onTapHandler);
    bubble.on('onLongPress', onLongPressHandler);
    bubble.on('onDrag', onDragHandler);

    this.bubbleListeners.set('onTap', () => bubble.off('onTap', onTapHandler));
    this.bubbleListeners.set('onLongPress', () => bubble.off('onLongPress', onLongPressHandler));
    this.bubbleListeners.set('onDrag', () => bubble.off('onDrag', onDragHandler));
  }

  private detachBubbleListeners(): void {
    this.bubbleListeners.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        console.warn('[PerformanceProfiler] Error detaching listener:', error);
      }
    });
    this.bubbleListeners.clear();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, this.config.flushInterval);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private flushMetrics(): void {
    if (this.metricsBuffer.length === 0) return;

    const metricsToFlush = this.metricsBuffer.splice(0, this.config.maxBatchSize);
    
    try {
      const existingStats = this.storage.getString(STORAGE_KEYS.AGGREGATED_STATS);
      const stats = existingStats ? JSON.parse(existingStats) : {
        totalMetrics: 0,
        byType: {} as Record<string, number>,
        avgDuration: 0,
        maxDuration: 0,
      };

      let totalDuration = 0;
      let maxDuration = 0;

      metricsToFlush.forEach((metric) => {
        stats.totalMetrics += 1;
        stats.byType[metric.type] = (stats.byType[metric.type] || 0) + 1;
        totalDuration += metric.duration;
        maxDuration = Math.max(maxDuration, metric.duration);
      });

      stats.avgDuration = stats.totalMetrics > 0 
        ? (stats.avgDuration * (stats.totalMetrics - metricsToFlush.length) + totalDuration) / stats.totalMetrics
        : 0;
      stats.maxDuration = maxDuration;

      this.storage.set(STORAGE_KEYS.AGGREGATED_STATS, JSON.stringify(stats));
      this.persistState();
    } catch (error) {
      console.error('[PerformanceProfiler] Failed to flush metrics:', error);
      this.metricsBuffer.unshift(...metricsToFlush);
    }
  }

  private recordMetric(
    type: PerformanceMetric['type'],
    duration: number,
    metadata: Record<string, unknown> = {},
    thread: PerformanceMetric['thread'] = 'js',
    severity: PerformanceMetric['severity'] = 'low'
  ): PerformanceMetric {
    const metric: PerformanceMetric = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      type,
      duration,
      metadata,
      thread,
      severity,
    };

    this.metricsBuffer.push(metric);

    if (this.metricsBuffer.length >= this.config.maxBatchSize) {
      this.flushMetrics();
    }

    return metric;
  }

  profileBubbleTap(payload: BubbleEventPayload): PerformanceMetric {
    const startTime = performance.now();
    
    const metadata = {
      x: payload.x,
      y: payload.y,
      gestureTimestamp: payload.timestamp,
      bubblePosition: { x: payload.x, y: payload.y },
    };

    const duration = performance.now() - startTime;
    const severity = duration > 16 ? 'medium' : duration > 33 ? 'high' : 'low';

    return this.recordMetric('bubble_tap', duration, metadata, 'ui', severity);
  }

  profileBubbleLongPress(payload: BubbleEventPayload): PerformanceMetric {
    const startTime = performance.now();
    
    const metadata = {
      x: payload.x,
      y: payload.y,
      gestureTimestamp: payload.timestamp,
      gestureState: payload.gestureState,
      pressure: payload.gestureState ? 'high' : 'normal',
    };

    const duration = performance.now() - startTime;
    const severity = duration > 50 ? 'high' : duration > 100 ? 'critical' : 'medium';

    return this.recordMetric('bubble_long_press', duration, metadata, 'ui', severity);
  }

  profileBubbleDrag(payload: BubbleEventPayload): PerformanceMetric {
    const startTime = performance.now();
    
    const metadata = {
      x: payload.x,
      y: payload.y,
      gestureTimestamp: payload.timestamp,
      gestureState: payload.gestureState,
      deltaX: 0,
      deltaY: 0,
    };

    const duration = performance.now() - startTime;
    const severity = duration > 16 ? 'medium' : duration > 33 ? 'high' : 'low';

    return this.recordMetric('bubble_drag', duration, metadata, 'ui', severity);
  }

  profileRenderCycle(componentName: string, renderDuration: number): PerformanceMetric {
    const metadata = {
      componentName,
      frameCount: this.frameCount,
      isInitialRender: this.frameCount === 0,
    };

    this.frameCount += 1;
    
    const severity = renderDuration > 16 ? 'medium' : renderDuration > 33 ? 'high' : 'low';

    return this.recordMetric('render_cycle', renderDuration, metadata, 'js', severity);
  }

  profileMemoryPressure(): PerformanceMetric {
    const startTime = performance.now();
    const memoryUsage = this.getCurrentMemoryUsage();
    
    const metadata = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      threshold: this.config.memoryThreshold,
      isOverThreshold: memoryUsage.heapUsed > this.config.memoryThreshold,
    };

    const duration = performance.now() - startTime;
    const severity = memoryUsage.heapUsed > this.config.memoryThreshold ? 'critical' : 'low';

    return this.recordMetric('memory_pressure', duration, metadata, 'native', severity);
  }

  private getCurrentMemoryUsage(): { heapUsed: number; heapTotal: number; external: number; rss: number } {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const mem = (performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      return {
        heapUsed: mem.usedJSHeapSize,
        heapTotal: mem.totalJSHeapSize,
        external: 0,
        rss: mem.totalJSHeapSize,
      };
    }

    if (global.gc) {
      global.gc();
    }

    return {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0,
    };
  }

  startRenderCycleTracking(): void {
    this.renderCycleStart = performance.now();
    this.frameCount = 0;
  }

  endRenderCycleTracking(componentName: string): PerformanceMetric {
    const duration = performance.now() - this.renderCycleStart;
    return this.profileRenderCycle(componentName, duration);
  }

  getMetricsBuffer(): PerformanceMetric[] {
    return [...this.metricsBuffer];
  }

  getAggregatedStats(): { totalMetrics: number; byType: Record<string, number>; avgDuration: number; maxDuration: number } {
    const stats = this.storage.getString(STORAGE_KEYS.AGGREGATED_STATS);
    return stats ? JSON.parse(stats) : {
      totalMetrics: 0,
      byType: {},
      avgDuration: 0,
      maxDuration: 0,
    };
  }

  clearMetrics(): void {
    this.metricsBuffer = [];
    this.storage.delete(STORAGE_KEYS.METRICS_BUFFER);
    this.storage.delete(STORAGE_KEYS.AGGREGATED_STATS);
    this.persistState();
  }

  isActive(): boolean {
    return this.isProfiling;
  }

  getConfig(): ProfilingConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<ProfilingConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.flushTimer) {
      this.stopFlushTimer();
      this.startFlushTimer();
    }
  }

  destroy(): void {
    this.stopProfiling();
    this.clearMetrics();
    PerformanceProfiler.resetInstance();
  }
}

export const performanceProfiler = PerformanceProfiler.getInstance();