```typescript
import { MMKV } from 'react-native-mmkv';
import { Platform, NativeModules } from 'react-native';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface TelemetryEvent {
  name: string;
  properties: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
  userId?: string;
}

export interface ErrorContext {
  component?: string;
  action?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
  stackTrace?: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  tags?: Record<string, string>;
  timestamp: number;
}

export interface UserContext {
  userId: string;
  traits: Record<string, unknown>;
  timestamp: number;
}

export interface Transport {
  name: string;
  send(event: TelemetryEvent): Promise<void>;
  sendError(error: Error, context: ErrorContext): Promise<void>;
  sendPerformance(metric: PerformanceMetric): Promise<void>;
  sendUserContext(context: UserContext): Promise<void>;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface TelemetryConfig {
  enabled: boolean;
  environment: 'development' | 'staging' | 'production';
  batchSize: number;
  flushInterval: number;
  maxQueueSize: number;
  transports: Transport[];
  sessionId: string;
}

// ============================================================================
// Console Transport (Development)
// ============================================================================

class ConsoleTransport implements Transport {
  name = 'console';
  private config: TelemetryConfig;

  constructor(config: TelemetryConfig) {
    this.config = config;
  }

  async send(event: TelemetryEvent): Promise<void> {
    if (this.config.environment === 'development') {
      console.log('[Telemetry] Event:', JSON.stringify(event, null, 2));
    }
  }

  async sendError(error: Error, context: ErrorContext): Promise<void> {
    if (this.config.environment === 'development') {
      console.error('[Telemetry] Error:', {
        message: error.message,
        stack: error.stack,
        context,
      });
    }
  }

  async sendPerformance(metric: PerformanceMetric): Promise<void> {
    if (this.config.environment === 'development') {
      console.log('[Telemetry] Performance:', JSON.stringify(metric, null, 2));
    }
  }

  async sendUserContext(context: UserContext): Promise<void> {
    if (this.config.environment === 'development') {
      console.log('[Telemetry] User Context:', JSON.stringify(context, null, 2));
    }
  }

  async flush(): Promise<void> {
    // No-op for console
  }

  async shutdown(): Promise<void> {
    // No-op for console
  }
}

// ============================================================================
// MMKV Transport (Offline Buffering)
// ============================================================================

class MMKVTransport implements Transport {
  name = 'mmkv';
  private storage: MMKV;
  private bufferKey = 'telemetry_buffer';
  private config: TelemetryConfig;
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.storage = new MMKV({
      id: 'telemetry',
      encryptionKey: 'telemetry_encryption_key_2024',
    });
    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushInterval);
  }

  private getBuffer(): TelemetryEvent[] {
    try {
      const data = this.storage.getString(this.bufferKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private setBuffer(buffer: TelemetryEvent[]): void {
    try {
      this.storage.set(this.bufferKey, JSON.stringify(buffer));
    } catch (error) {
      console.error('[MMKVTransport] Failed to write buffer:', error);
    }
  }

  private addToBuffer(event: TelemetryEvent): void {
    const buffer = this.getBuffer();
    if (buffer.length >= this.config.maxQueueSize) {
      buffer.shift(); // Remove oldest
    }
    buffer.push(event);
    this.setBuffer(buffer);
  }

  async send(event: TelemetryEvent): Promise<void> {
    this.addToBuffer(event);
    if (this.getBuffer().length >= this.config.batchSize) {
      await this.flush();
    }
  }

  async sendError(error: Error, context: ErrorContext): Promise<void> {
    const event: TelemetryEvent = {
      name: 'error',
      properties: {
        message: error.message,
        stack: error.stack,
        context,
      },
      timestamp: Date.now(),
      sessionId: this.config.sessionId,
    };
    this.addToBuffer(event);
  }

  async sendPerformance(metric: PerformanceMetric): Promise<void> {
    const event: TelemetryEvent = {
      name: 'performance',
      properties: metric,
      timestamp: Date.now(),
      sessionId: this.config.sessionId,
    };
    this.addToBuffer(event);
  }

  async sendUserContext(context: UserContext): Promise<void> {
    const event: TelemetryEvent = {
      name: 'user_context',
      properties: context,
      timestamp: Date.now(),
      sessionId: this.config.sessionId,
    };
    this.addToBuffer(event);
  }

  async flush(): Promise<void> {
    const buffer = this.getBuffer();
    if (buffer.length === 0) return;

    // In production, this would send to backend
    // For now, we keep in buffer until native bridge picks it up
    if (this.config.environment === 'production') {
      // Native bridge will handle actual sending
      return;
    }

    // In development/staging, clear after logging
    this.setBuffer([]);
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }

  // Expose buffer for native bridge consumption
  getBufferedEvents(): TelemetryEvent[] {
    return this.getBuffer();
  }

  clearBuffer(): void {
    this.setBuffer([]);
  }
}

// ============================================================================
// Native Transport (Production - React Native Bridge)
// ============================================================================

class NativeTransport implements Transport {
  name = 'native';
  private config: TelemetryConfig;
  private nativeModule: any;

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.nativeModule = NativeModules.TelemetryModule;
  }

  async send(event: TelemetryEvent): Promise<void> {
    if (this.nativeModule?.trackEvent) {
      await this.nativeModule.trackEvent(event);
    }
  }

  async sendError(error: Error, context: ErrorContext): Promise<void> {
    if (this.nativeModule?.trackError) {
      await this.nativeModule.trackError({
        message: error.message,
        stack: error.stack,
        context,
        sessionId: this.config.sessionId,
      });
    }
  }

  async sendPerformance(metric: PerformanceMetric): Promise<void> {
    if (this.nativeModule?.trackPerformance) {
      await this.nativeModule.trackPerformance(metric);
    }
  }

  async sendUserContext(context: UserContext): Promise<void> {
    if (this.nativeModule?.setUserContext) {
      await this.nativeModule.setUserContext(context);
    }
  }

  async flush(): Promise<void> {
    if (this.nativeModule?.flush) {
      await this.nativeModule.flush();
    }
  }

  async shutdown(): Promise<void> {
    if (this.nativeModule?.shutdown) {
      await this.nativeModule.shutdown();
    }
  }
}

// ============================================================================
//