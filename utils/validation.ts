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

const shortcutSchema: z.ZodSchema<Shortcut> = z.object({
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

const bubbleConfigSchema: z.ZodSchema<BubbleConfig> = z.object({
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

const userPreferencesSchema: z.ZodSchema<UserPreferences> = z.object({
  shortcuts: z.array(shortcutSchema).max(20, 'Maximum 20 shortcuts allowed').default([]),
  bubble: bubbleConfigSchema,
  gestures: z.object({
    swipeUp: shortcutSchema.nullable().optional(),
    swipeDown: shortcutSchema.nullable().optional(),
    swipeLeft: shortcutSchema.nullable().optional(),
    swipeRight: shortcutSchema.nullable().optional(),
    longPress: shortcutSchema.nullable().optional(),
    doubleTap: shortcutSchema.nullable().optional(),
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

export function validateAndSanitize<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    throw ValidationError.fromZodError(result.error);
  }
  
  return result.data;
}

export function sanitizeString(
  input: string,
  options: { maxLength?: number; allowHtml?: boolean } = {}
): string {
  const { maxLength = 10000, allowHtml = false } = options;
  
  let sanitized = input;
  
  if (!allowHtml) {
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  
  return sanitized.trim();
}

function sanitizeValue(value: unknown, schema: z.ZodSchema): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, schema));
  }
  
  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const sanitizedKey = sanitizeString(key, { maxLength: 100, allowHtml: false });
      sanitized[sanitizedKey] = sanitizeValue(val, schema);
    }
    return sanitized;
  }
  
  return value;
}

export function sanitizeObject<T>(obj: T, schema: z.ZodSchema<T>): T {
  const sanitized = sanitizeValue(obj, schema) as T;
  return validateAndSanitize(schema, sanitized);
}

export function isValidShortcut(data: unknown): data is Shortcut {
  return shortcutSchema.safeParse(data).success;
}

export function isValidBubbleConfig(data: unknown): data is BubbleConfig {
  return bubbleConfigSchema.safeParse(data).success;
}

export function isValidUserPreferences(data: unknown): data is UserPreferences {
  return userPreferencesSchema.safeParse(data).success;
}

export function isValidShortcutAction(data: unknown): data is ShortcutAction {
  return shortcutActionSchema.safeParse(data).success;
}

export function isValidBubblePosition(data: unknown): data is BubblePosition {
  return bubblePositionSchema.safeParse(data).success;
}

export function isValidBubbleSize(data: unknown): data is BubbleSize {
  return bubbleSizeSchema.safeParse(data).success;
}

export function isValidThemeMode(data: unknown): data is ThemeMode {
  return themeModeSchema.safeParse(data).success;
}

export {
  shortcutSchema,
  bubbleConfigSchema,
  userPreferencesSchema,
  shortcutActionSchema,
  bubblePositionSchema,
  bubbleSizeSchema,
  themeModeSchema,
};