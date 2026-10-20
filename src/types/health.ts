export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  serviceName: string;
  status: HealthStatus;
  latencyMs: number;
  timestamp: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface HealthCheckThresholds {
  healthyMaxLatencyMs: number;
  degradedMaxLatencyMs: number;
}

export interface HealthCheckConfig {
  intervalMs: number;
  timeoutMs: number;
  thresholds: HealthCheckThresholds;
  enabled: boolean;
}

export interface SystemHealthReport {
  overallStatus: HealthStatus;
  checks: HealthCheckResult[];
  timestamp: number;
  uptimeMs: number;
}

export interface HealthCheckService {
  name: string;
  check: () => Promise<HealthCheckResult>;
  config: HealthCheckConfig;
}

export type HealthCheckCallback = (result: HealthCheckResult) => void;

export interface HealthMonitorConfig {
  checks: HealthCheckService[];
  onStatusChange?: (report: SystemHealthReport) => void;
  onCheckComplete?: HealthCheckCallback;
}