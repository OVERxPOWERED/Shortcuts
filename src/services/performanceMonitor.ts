import { PerformanceObserver, performance } from 'react-native-performance';
import { telemetryService } from './telemetryService';

interface TraceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  type: 'trace' | 'async' | 'sync' | 'render' | 'interaction';
  metadata?: Record<string, unknown>;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private traces: Map<string, TraceMetric> = new Map();
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 1000;
  private observers: PerformanceObserver[] = [];
  private isEnabled = true;

  private constructor() {
    this.initializeObservers();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initializeObservers(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.recordMetric({
            name: entry.name,
            duration: entry.duration,
            timestamp: entry.startTime,
            type: this.mapEntryType(entry.entryType),
            metadata: {
              entryType: entry.entryType,
              ...(entry as PerformanceEntry & { detail?: unknown }).detail,
            },
          });
        });
      });
      observer.observe({ entryTypes: ['measure', 'navigation', 'resource', 'paint'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('[PerformanceMonitor] PerformanceObserver not available:', error);
    }
  }

  private mapEntryType(entryType: string): PerformanceMetric['type'] {
    switch (entryType) {
      case 'measure':
        return 'trace';
      case 'navigation':
        return 'interaction';
      case 'paint':
        return 'render';
      default:
        return 'trace';
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  startTrace(name: string, metadata?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    const trace: TraceMetric = {
      name,
      startTime: performance.now(),
      metadata,
    };
    this.traces.set(name, trace);

    try {
      performance.mark(`${name}-start`);
    } catch {
      // performance.mark may not be available in all environments
    }
  }

  endTrace(name: string): number | null {
    if (!this.isEnabled) return null;

    const trace = this.traces.get(name);
    if (!trace) {
      console.warn(`[PerformanceMonitor] Trace "${name}" not found`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - trace.startTime;

    trace.endTime = endTime;
    trace.duration = duration;

    try {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    } catch {
      // performance.measure may not be available
    }

    this.recordMetric({
      name,
      duration,
      timestamp: trace.startTime,
      type: 'trace',
      metadata: trace.metadata,
    });

    this.traces.delete(name);
    return duration;
  }

  async measureAsync<T>(fn: () => Promise<T>, name: string, metadata?: Record<string, unknown>): Promise<T> {
    if (!this.isEnabled) {
      return fn();
    }

    this.startTrace(name, metadata);
    try {
      const result = await fn();
      this.endTrace(name);
      return result;
    } catch (error) {
      this.endTrace(name);
      throw error;
    }
  }

  measureSync<T>(fn: () => T, name: string, metadata?: Record<string, unknown>): T {
    if (!this.isEnabled) {
      return fn();
    }

    this.startTrace(name, metadata);
    try {
      const result = fn();
      this.endTrace(name);
      return result;
    } catch (error) {
      this.endTrace(name);
      throw error;
    }
  }

  measureRender(componentName: string, renderFn: () => React.ReactElement): React.ReactElement {
    return this.measureSync(renderFn, `render:${componentName}`, { component: componentName }) as React.ReactElement;
  }

  measureInteraction(interactionName: string, fn: () => void): void {
    this.measureSync(fn, `interaction:${interactionName}`, { interaction: interactionName });
  }

  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    telemetryService.sendPerformance({
      name: metric.name,
      duration: metric.duration,
      timestamp: metric.timestamp,
      type: metric.type,
      metadata: metric.metadata,
    });
  }

  getRecentMetrics(limit = 100): PerformanceMetric[] {
    return this.metrics.slice(-limit);
  }

  getMetricsByType(type: PerformanceMetric['type']): PerformanceMetric[] {
    return this.metrics.filter((m) => m.type === type);
  }

  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter((m) => m.name === name);
  }

  getAverageDuration(name: string): number {
    const metrics = this.getMetricsByName(name);
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + m.duration, 0);
    return sum / metrics.length;
  }

  getPercentile(name: string, percentile: number): number {
    const metrics = this.getMetricsByName(name).map((m) => m.duration).sort((a, b) => a - b);
    if (metrics.length === 0) return 0;
    const index = Math.ceil(percentile / 100 * metrics.length) - 1;
    return metrics[Math.max(0, index)];
  }

  clearMetrics(): void {
    this.metrics = [];
    this.traces.clear();
  }

  dispose(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
    this.clearMetrics();
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

export function usePerformanceMonitor() {
  const startTrace = (name: string, metadata?: Record<string, unknown>) => {
    performanceMonitor.startTrace(name, metadata);
  };

  const endTrace = (name: string) => {
    return performanceMonitor.endTrace(name);
  };

  const measureAsync = <T>(fn: () => Promise<T>, name: string, metadata?: Record<string, unknown>) => {
    return performanceMonitor.measureAsync(fn, name, metadata);
  };

  const measureSync = <T>(fn: () => T, name: string, metadata?: Record<string, unknown>) => {
    return performanceMonitor.measureSync(fn, name, metadata);
  };

  const measureRender = (componentName: string, renderFn: () => React.ReactElement) => {
    return performanceMonitor.measureRender(componentName, renderFn);
  };

  const measureInteraction = (interactionName: string, fn: () => void) => {
    performanceMonitor.measureInteraction(interactionName, fn);
  };

  return {
    startTrace,
    endTrace,
    measureAsync,
    measureSync,
    measureRender,
    measureInteraction,
    getRecentMetrics: performanceMonitor.getRecentMetrics.bind(performanceMonitor),
    getAverageDuration: performanceMonitor.getAverageDuration.bind(performanceMonitor),
    getPercentile: performanceMonitor.getPercentile.bind(performanceMonitor),
  };
}

export { PerformanceMonitor };
export type { PerformanceMetric, TraceMetric };