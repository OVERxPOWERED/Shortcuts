import { z } from 'zod';
import type {
  Shortcut,
  BubbleConfig,
  UserPreferences,
  ShortcutAction,
  BubblePosition,
  BubbleSize,
  ThemeMode,
} from '../types/shortcut';

/**
 * Custom validation error class that wraps Zod errors with additional context.
 * Provides structured error information for debugging and user-facing messages.
 */
export class ValidationError extends Error {
  public readonly issues: z.ZodIssue[];
  public readonly field?: string;

  constructor(message: string, issues: z.ZodIssue[] = [], field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
    this.field = field;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Creates a ValidationError from a ZodError with formatted messages.
   * @param error - The ZodError to convert
   * @param field - Optional field name for context
   * @returns A new ValidationError instance
   */
  static fromZodError(error: z.ZodError, field?: string): ValidationError {
    const messages = error.issues.map(issue => 
      `${issue.path.join('.') || 'root'}: ${issue.message}`
    ).join('; ');
    return new ValidationError(`Validation failed: ${messages}`, error.issues, field);
  }

  /**
   * Serializes the error to a plain object for logging or API responses.
   * @returns JSON-serializable error representation
   */
  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      field: this.field,
      issues: this.issues.map(issue => ({
        path: issue.path,
        message: issue.message,
        code: issue.code,
      })),
    };
  }
}

// ============================================================================
// Primitive Type Schemas
// ============================================================================

const shortcutActionSchema: z.ZodSchema<ShortcutAction> = z.enum([
  'open_app',
  'open_url',
  'run_shortcut',
  'toggle_bubble',
  'send_intent',
  'copy_text',
  'vibrate',
]);

const bubblePositionSchema: z.ZodSchema<BubblePosition> = z.object({
  x: z.number().min(0).max(10000),
  y: z.number().min(0).max(10000),
});

const bubbleSizeSchema: z.ZodSchema<BubbleSize> = z.enum(['small', 'medium', 'large']);

const themeModeSchema: z.ZodSchema<ThemeMode> = z.enum(['light', 'dark', 'system']);

// ============================================================================
// Core Domain Schemas
// ============================================================================

/**
 * Schema for validating Shortcut objects.
 * Enforces UUID format, label length limits, and required timestamps.
 */
export const ShortcutSchema: z.ZodSchema<Shortcut> = z.object({
  id: z.string().uuid('Shortcut ID must be a valid UUID'),
  label: z.string().min(1, 'Label cannot be empty').max(50, 'Label too long (max 50 chars)'),
  icon: z.string().min(1, 'Icon cannot be empty').max(100, 'Icon path too long'),
  action: shortcutActionSchema,
  actionData: z.record(z.unknown()).optional(),
  enabled: z.boolean().default(true),
  order: z.number().int().min(0, 'Order must be non-negative').default(0),
  createdAt: z.number().int().positive('Created timestamp must be positive'),
  updatedAt: z.number().int().positive('Updated timestamp must be positive'),
}).strict();

/**
 * Schema for validating BubbleConfig objects.
 * Defines visual and behavioral properties of the floating bubble.
 */
export const BubbleConfigSchema: z.ZodSchema<BubbleConfig> = z.object({
  position: bubblePositionSchema,
  size: bubbleSizeSchema.default('medium'),
  opacity: z.number().min(0.1, 'Opacity must be at least 0.1').max(1, 'Opacity cannot exceed 1').default(0.9),
  autoHide: z.boolean().default(false),
  autoHideDelay: z.number().int().min(1000, 'Auto-hide delay must be at least 1000ms').max(60000, 'Auto-hide delay too long').default(3000),
  hapticFeedback: z.boolean().default(true),
  animationDuration: z.number().int().min(0).max(1000).default(200),
  theme: themeModeSchema.default('system'),
  showOnLockScreen: z.boolean().default(false),
  excludedApps: z.array(z.string()).default([]),
}).strict();

/**
 * Schema for validating UserPreferences objects.
 * Captures user-facing settings and accessibility options.
 */
export const UserPreferencesSchema: z.ZodSchema<UserPreferences> = z.object({
  theme: themeModeSchema.default('system'),
  language: z.string().min(2).max(10).default('en'),
  hapticsEnabled: z.boolean().default(true),
  animationsEnabled: z.boolean().default(true),
  reducedMotion: z.boolean().default(false),
  highContrast: z.boolean().default(false),
  bubbleDefaults: BubbleConfigSchema.partual().default({}),
  shortcuts: z.array(ShortcutSchema).default([]),
  telemetryOptIn: z.boolean().default(false),
  autoUpdate: z.boolean().default(true),
}).strict();

// ============================================================================
// Trigger & App Config Schemas
// ============================================================================

export const TriggerSchema = z.object({
  type: z.enum(['gesture', 'shortcut', 'intent', 'schedule']),
  gesture: z.enum(['swipe_up', 'swipe_down', 'swipe_left', 'swipe_right', 'long_press', 'double_tap']).optional(),
  shortcutId: z.string().uuid().optional(),
  intentAction: z.string().optional(),
  schedule: z.object({
    cron: z.string(),
    timezone: z.string().optional(),
  }).optional(),
}).refine(
  (data) => {
    if (data.type === 'gesture') return data.gesture !== undefined;
    if (data.type === 'shortcut') return data.shortcutId !== undefined;
    if (data.type === 'intent') return data.intentAction !== undefined;
    if (data.type === 'schedule') return data.schedule !== undefined;
    return false;
  },
  {
    message: 'Trigger configuration incomplete for the specified type',
    path: ['type'],
  }
);

export const AppConfigSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format'),
  buildNumber: z.number().int().positive('Build number must be positive'),
  minSupportedVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
  featureFlags: z.record(z.boolean()).default({}),
  remoteConfigUrl: z.string().url().optional(),
}).strict();

// ============================================================================
// Runtime Configuration Schema & Validation
// ============================================================================

/**
 * Supported application environments.
 * Controls feature availability, logging verbosity, and security policies.
 */
export const AppEnvSchema = z.enum(['development', 'staging', 'production']);

/**
 * Schema for runtime configuration that can be overridden via remote config
 * or environment variables. Validated on app startup.
 */
export const RuntimeConfigSchema = z.object({
  /** Current application environment */
  appEnv: AppEnvSchema.default('development'),
  /** Enable anonymous usage telemetry (disabled in production by default) */
  enableTelemetry: z.boolean().default(false),
  /** Maximum number of shortcuts a user can create */
  maxShortcuts: z.number().int().min(1, 'Must allow at least 1 shortcut').max(50, 'Cannot exceed 50 shortcuts').default(20),
  /** Default bubble configuration applied to new users */
  bubbleDefaults: BubbleConfigSchema.partial().default({}),
  /** Remote configuration endpoint */
  remoteConfigUrl: z.string().url().optional(),
  /** Feature flag overrides */
  featureFlags: z.record(z.boolean()).default({}),
  /** Log level for the current session */
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
}).strict();

/**
 * Type inferred from RuntimeConfigSchema for TypeScript consumers.
 */
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

/**
 * Validates a runtime configuration object against the schema.
 * Throws a formatted ValidationError on failure.
 * 
 * @param config - Raw configuration object to validate
 * @returns Validated and typed RuntimeConfig object
 * @throws ValidationError if validation fails
 * 
 * @example
 * ```typescript
 * const config = validateRuntimeConfig({
 *   appEnv: 'production',
 *   enableTelemetry: false,
 *   maxShortcuts: 10,
 * });
 * ```
 */
export function validateRuntimeConfig(config: unknown): RuntimeConfig {
  const result = RuntimeConfigSchema.safeParse(config);
  
  if (!result.success) {
    throw ValidationError.fromZodError(result.error, 'runtimeConfig');
  }
  
  return result.data;
}

/**
 * Returns production-safe default configuration.
 * Used as fallback when remote config is unavailable or for fresh installs.
 * 
 * @returns Secure default RuntimeConfig with telemetry disabled and conservative limits
 * 
 * @example
 * ```typescript
 * const defaults = getSecureDefaults();
 * // { appEnv: 'production', enableTelemetry: false, maxShortcuts: 10, ... }
 * ```
 */
export function getSecureDefaults(): RuntimeConfig {
  return {
    appEnv: 'production',
    enableTelemetry: false,
    maxShortcuts: 10,
    bubbleDefaults: {
      size: 'medium',
      opacity: 0.9,
      autoHide: false,
      autoHideDelay: 3000,
      hapticFeedback: true,
      animationDuration: 200,
      theme: 'system',
      showOnLockScreen: false,
      excludedApps: [],
    },
    featureFlags: {},
    logLevel: 'warn',
  };
}

/**
 * Development-only defaults with relaxed constraints for easier testing.
 * 
 * @returns Permissive RuntimeConfig for development environments
 */
export function getDevelopmentDefaults(): RuntimeConfig {
  return {
    appEnv: 'development',
    enableTelemetry: false,
    maxShortcuts: 50,
    bubbleDefaults: {
      size: 'large',
      opacity: 1,
      autoHide: false,
      hapticFeedback: true,
      animationDuration: 150,
      theme: 'system',
      showOnLockScreen: true,
      excludedApps: [],
    },
    featureFlags: {
      debugMenu: true,
      experimentalFeatures: true,
    },
    logLevel: 'debug',
  };
}

/**
 * Staging defaults - mirrors production but with telemetry enabled for testing.
 * 
 * @returns RuntimeConfig suitable for staging/QA environments
 */
export function getStagingDefaults(): RuntimeConfig {
  return {
    ...getSecureDefaults(),
    appEnv: 'staging',
    enableTelemetry: true,
    maxShortcuts: 20,
    logLevel: 'info',
    featureFlags: {
      betaFeatures: true,
    },
  };
}

/**
 * Returns environment-appropriate defaults based on the current app environment.
 * 
 * @param env - Target environment
 * @returns Corresponding default RuntimeConfig
 */
export function getDefaultsForEnv(env: z.infer<typeof AppEnvSchema>): RuntimeConfig {
  switch (env) {
    case 'development':
      return getDevelopmentDefaults();
    case 'staging':
      return getStagingDefaults();
    case 'production':
    default:
      return getSecureDefaults();
  }
}

// ============================================================================
// Environment Guardrail Functions
// ============================================================================

/**
 * Asserts that the current environment is production-ready.
 * Throws if running in development with production-only features enabled.
 * 
 * @param config - Validated runtime configuration
 * @throws Error if production readiness checks fail
 * 
 * @example
 * ```typescript
 * assertProductionReady(config); // Throws in dev if telemetry enabled
 * ```
 */
export function assertProductionReady(config: RuntimeConfig): void {
  if (config.appEnv === 'development') {
    const violations: string[] = [];
    
    if (config.enableTelemetry) {
      violations.push('Telemetry must be disabled in development');
    }
    
    if (config.maxShortcuts > 20) {
      violations.push('Max shortcuts should not exceed 20 in development');
    }
    
    if (config.logLevel === 'debug' && config.featureFlags?.debugMenu !== true) {
      violations.push('Debug log level requires debugMenu feature flag');
    }
    
    if (violations.length > 0) {
      throw new Error(
        `Production readiness check failed in development:\n- ${violations.join('\n- ')}`
      );
    }
  }
  
  if (config.appEnv === 'production') {
    const violations: string[] = [];
    
    if (config.enableTelemetry && !config.featureFlags?.telemetryApproved) {
      violations.push('Telemetry requires explicit approval flag in production');
    }
    
    if (config.logLevel === 'debug') {
      violations.push('Debug log level not allowed in production');
    }
    
    if (config.featureFlags?.debugMenu || config.featureFlags?.experimentalFeatures) {
      violations.push('Development feature flags must be disabled in production');
    }
    
    if (violations.length > 0) {
      throw new Error(
        `Production readiness check failed:\n- ${violations.join('\n- ')}`
      );
    }
  }
}

/**
 * Asserts that a feature is only accessible in development environment.
 * Useful for gating debug menus, experimental features, and test utilities.
 * 
 * @param config - Validated runtime configuration
 * @param featureName - Name of the feature being accessed (for error messages)
 * @throws Error if not in development environment
 * 
 * @example
 * ```typescript
 * assertDevelopmentOnly(config, 'Debug Menu');
 * // Safe to show debug UI
 *