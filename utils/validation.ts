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

  static fromZodError(error: z.ZodError, field?: string): ValidationError {
    const messages = error.issues.map(issue => 
      `${issue.path.join('.') || 'root'}: ${issue.message}`
    ).join('; ');
    return new ValidationError(`Validation failed: ${messages}`, error.issues, field);
  }

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
  buildNumber: z.number().int().positive(),
  environment: z.enum(['development', 'staging', 'production']),
  features: z.object({
    floatingBubble: z.boolean().default(true),
    gestures: z.boolean().default(true),
    shortcuts: z.boolean().default(true),
    analytics: z.boolean().default(false),
    crashReporting: z.boolean().default(true),
  }).default({}),
  limits: z.object({
    maxShortcuts: z.number().int().min(1).max(50).default(20),
    maxBubbleSize: z.number().int().min(50).max(500).default(200),
    minAnimationDuration: z.number().int().min(0).max(500).default(0),
    maxAnimationDuration: z.number().int().min(100).max(2000).default(1000),
  }).default({}),
  permissions: z.object({
    overlay: z.boolean().default(false),
    accessibility: z.boolean().default(false),
    notificationListener: z.boolean().default(false),
  }).default({}),
}).strict();

const userPreferencesSchema: z.ZodSchema<UserPreferences> = z.object({
  shortcuts: z.array(ShortcutSchema).max(20, 'Maximum 20 shortcuts allowed').default([]),
  bubble: BubbleConfigSchema,
  gestures: z.object({
    swipeUp: ShortcutSchema.nullable().optional(),
    swipeDown: ShortcutSchema.nullable().optional(),
    swipeLeft: ShortcutSchema.nullable().optional(),
    swipeRight: ShortcutSchema.nullable().optional(),
    longPress: ShortcutSchema.nullable().optional(),
    doubleTap: ShortcutSchema.nullable().optional(),
  }).optional(),
  accessibility: z.object({
    reduceMotion: z.boolean().default(false),
    highContrast: z.boolean().default(false),
    largeText: z.boolean().default(false),
  }).default({ reduceMotion: false, highContrast: false, largeText: false }),
  privacy: z.object({
    analyticsEnabled: z.boolean().default(false),
    crashReportingEnabled: z.boolean().default(true),
    dataCollectionConsent: z.boolean().default(false),
  }).default({ analyticsEnabled: false, crashReportingEnabled: true, dataCollectionConsent: false }),
}).strict();

export type ShortcutInput = z.input<typeof ShortcutSchema>;
export type ShortcutOutput = z.output<typeof ShortcutSchema>;
export type BubbleConfigInput = z.input<typeof BubbleConfigSchema>;
export type BubbleConfigOutput = z.output<typeof BubbleConfigSchema>;
export type TriggerInput = z.input<typeof TriggerSchema>;
export type TriggerOutput = z.output<typeof TriggerSchema>;
export type AppConfigInput = z.input<typeof AppConfigSchema>;
export type AppConfigOutput = z.output<typeof AppConfigSchema>;
export type UserPreferencesInput = z.input<typeof userPreferencesSchema>;
export type UserPreferencesOutput = z.output<typeof userPreferencesSchema>;

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
}

export function validateAndSanitize<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, errors: result.error };
}

export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) :
        item
      );
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

export function validateShortcut(data: unknown): ValidationResult<Shortcut> {
  return validateAndSanitize(ShortcutSchema, data);
}

export function validateBubbleConfig(data: unknown): ValidationResult<BubbleConfig> {
  return validateAndSanitize(BubbleConfigSchema, data);
}

export function validateTrigger(data: unknown): ValidationResult<TriggerOutput> {
  return validateAndSanitize(TriggerSchema, data);
}

export function validateAppConfig(data: unknown): ValidationResult<AppConfigOutput> {
  return validateAndSanitize(AppConfigSchema, data);
}

export function validateUserPreferences(data: unknown): ValidationResult<UserPreferences> {
  return validateAndSanitize(userPreferencesSchema, data);
}

export const DEFAULT_BUBBLE_CONFIG: BubbleConfig = BubbleConfigSchema.parse({
  position: { x: 100, y: 100 },
  size: 'medium',
  opacity: 0.9,
  autoHide: false,
  autoHideDelay: 3000,
  hapticFeedback: true,
  animationDuration: 200,
  theme: 'system',
  showOnLockScreen: false,
  excludedApps: [],
});

export const DEFAULT_APP_CONFIG: AppConfigOutput = AppConfigSchema.parse({
  version: '1.0.0',
  buildNumber: 1,
  environment: 'development',
  features: {
    floatingBubble: true,
    gestures: true,
    shortcuts: true,
    analytics: false,
    crashReporting: true,
  },
  limits: {
    maxShortcuts: 20,
    maxBubbleSize: 200,
    minAnimationDuration: 0,
    maxAnimationDuration: 1000,
  },
  permissions: {
    overlay: false,
    accessibility: false,
    notificationListener: false,
  },
});