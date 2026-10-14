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
  version: z.number().int().positive().default(1),
}).strict();

export function validateShortcut(data: unknown): Shortcut {
  const result = shortcutSchema.safeParse(data);
  if (!result.success) {
    throw ValidationError.fromZodError(result.error, 'shortcut');
  }
  return result.data;
}

export function validateShortcuts(data: unknown): Shortcut[] {
  const arraySchema = z.array(shortcutSchema).max(20);
  const result = arraySchema.safeParse(data);
  if (!result.success) {
    throw ValidationError.fromZodError(result.error, 'shortcuts');
  }
  return result.data;
}

export function validateBubbleConfig(data: unknown): BubbleConfig {
  const result = bubbleConfigSchema.safeParse(data);
  if (!result.success) {
    throw ValidationError.fromZodError(result.error, 'bubbleConfig');
  }
  return result.data;
}

export function validateUserPreferences(data: unknown): UserPreferences {
  const result = userPreferencesSchema.safeParse(data);
  if (!result.success) {
    throw ValidationError.fromZodError(result.error, 'userPreferences');
  }
  return result.data;
}

export function safeValidateShortcut(data: unknown): { success: true; data: Shortcut } | { success: false; error: ValidationError } {
  const result = shortcutSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: ValidationError.fromZodError(result.error, 'shortcut') };
  }
  return { success: true, data: result.data };
}

export function safeValidateBubbleConfig(data: unknown): { success: true; data: BubbleConfig } | { success: false; error: ValidationError } {
  const result = bubbleConfigSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: ValidationError.fromZodError(result.error, 'bubbleConfig') };
  }
  return { success: true, data: result.data };
}

export function safeValidateUserPreferences(data: unknown): { success: true; data: UserPreferences } | { success: false; error: ValidationError } {
  const result = userPreferencesSchema.safeParse(data);
  if (!result.success) {
    return { success