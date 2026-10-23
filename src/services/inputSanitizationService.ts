```typescript
import { z } from 'zod';
import { validateAndSanitize, sanitizeString, sanitizeObject } from '../utils/validation';

export const ShortcutParamsSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  action: z.enum(['open_app', 'open_url', 'run_shortcut', 'send_intent', 'custom']),
  payload: z.record(z.unknown()).optional(),
  icon: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  order: z.number().int().min(0).max(1000).optional(),
  enabled: z.boolean().optional(),
  trigger: z.object({
    type: z.enum(['tap', 'long_press', 'swipe', 'gesture']),
    config: z.record(z.unknown()).optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const BubbleConfigSchema = z.object({
  id: z.string().uuid().optional(),
  position: z.object({
    x: z.number().min(0).max(10000),
    y: z.number().min(0).max(10000),
  }).optional(),
  size: z.number().min(20).max(200).optional(),
  opacity: z.number().min(0).max(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/).optional(),
  borderColor: z.string().regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/).optional(),
  borderWidth: z.number().min(0).max(10).optional(),
  borderRadius: z.number().min(0).max(100).optional(),
  shadow: z.object({
    color: z.string().regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/),
    offset: z.object({ width: z.number(), height: z.number() }),
    radius: z.number().min(0).max(50),
    opacity: z.number().min(0).max(1),
  }).optional(),
  animation: z.object({
    enabled: z.boolean(),
    duration: z.number().min(0).max(5000),
    easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring']),
  }).optional(),
  behavior: z.object({
    draggable: z.boolean(),
    clickThrough: z.boolean(),
    autoHide: z.boolean(),
    autoHideDelay: z.number().min(0).max(60000),
    magnetEdges: z.boolean(),
    magnetStrength: z.number().min(0).max(1),
  }).optional(),
  shortcuts: z.array(z.string().uuid()).max(20).optional(),
  theme: z.enum(['light', 'dark', 'system', 'custom']).optional(),
  customTheme: z.record(z.unknown()).optional(),
});

export const UserPreferencesSchema = z.object({
  userId: z.string().uuid().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).optional(),
  notifications: z.object({
    enabled: z.boolean(),
    sound: z.boolean(),
    vibration: z.boolean(),
    types: z.array(z.enum(['shortcut', 'bubble', 'system', 'update'])).optional(),
  }).optional(),
  accessibility: z.object({
    reduceMotion: z.boolean(),
    highContrast: z.boolean(),
    largeText: z.boolean(),
    screenReader: z.boolean(),
  }).optional(),
  privacy: z.object({
    analytics: z.boolean(),
    crashReporting: z.boolean(),
    dataCollection: z.boolean(),
  }).optional(),
  bubble: z.object({
    defaultPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']),
    defaultSize: z.number().min(40).max(120),
    defaultOpacity: z.number().min(0.3).max(1),
    showOnStartup: z.boolean(),
    rememberPosition: z.boolean(),
  }).optional(),
  shortcuts: z.object({
    maxShortcuts: z.number().min(1).max(50),
    defaultAction: z.enum(['open_app', 'open_url', 'run_shortcut', 'send_intent', 'custom']),
    confirmBeforeExecute: z.boolean(),
    hapticFeedback: z.boolean(),
  }).optional(),
  advanced: z.object({
    debugMode: z.boolean(),
    experimentalFeatures: z.boolean(),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']),
    customConfig: z.record(z.unknown()).optional(),
  }).optional(),
});

export type ShortcutParams = z.infer<typeof ShortcutParamsSchema>;
export type BubbleConfig = z.infer<typeof BubbleConfigSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

interface SanitizationResult<T> {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
  sanitized?: T;
}

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<img\b[^>]*onerror\s*=/gi,
  /<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi,
  /expression\s*\(/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
];

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\b)/gi,
  /(--|\/\*|\*\/|;)/g,
  /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi,
  /(\bOR\b|\bAND\b)\s+['"]\w+['"]\s*=\s*['"]\w+['"]/gi,
  /(UNION\s+ALL\s+SELECT)/gi,
  /(INFORMATION_SCHEMA|SYSOBJECTS|SYSCOLUMNS)/gi,
];

const NATIVE_MODULE_DANGEROUS_KEYS = [
  '__proto__',
  'constructor',
  'prototype',
  'eval',
  'Function',
  'setTimeout',
  'setInterval',
  'require',
  'module',
  'exports',
  'global',
  'process',
  'Buffer',
];

export class InputSanitizationService {
  private static instance: InputSanitizationService;
  private sanitization