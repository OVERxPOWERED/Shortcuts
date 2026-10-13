import { z } from 'zod';

export enum ShortcutActionType {
  APP_SHORTCUT = 'APP_SHORTCUT',
  URL = 'URL',
  SYSTEM_ACTION = 'SYSTEM_ACTION',
  CUSTOM = 'CUSTOM',
}

export interface Shortcut {
  id: string;
  label: string;
  actionType: ShortcutActionType;
  actionPayload: string;
  iconName: string;
  order: number;
  isEnabled: boolean;
}

export interface BubbleConfig {
  position: { x: number; y: number };
  size: number;
  opacity: number;
  animation: 'spring' | 'timing' | 'none';
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  hapticsEnabled: boolean;
  bubbleEnabled: boolean;
}

export const ShortcutActionTypeSchema = z.nativeEnum(ShortcutActionType);

export const ShortcutSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(50),
  actionType: ShortcutActionTypeSchema,
  actionPayload: z.string().min(1),
  iconName: z.string().min(1),
  order: z.number().int().nonnegative(),
  isEnabled: z.boolean(),
});

export const BubbleConfigSchema = z.object({
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  size: z.number().positive().max(200),
  opacity: z.number().min(0).max(1),
  animation: z.enum(['spring', 'timing', 'none']),
});

export const UserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  hapticsEnabled: z.boolean(),
  bubbleEnabled: z.boolean(),
});

export type ShortcutInput = z.input<typeof ShortcutSchema>;
export type ShortcutOutput = z.output<typeof ShortcutSchema>;
export type BubbleConfigInput = z.input<typeof BubbleConfigSchema>;
export type BubbleConfigOutput = z.output<typeof BubbleConfigSchema>;
export type UserPreferencesInput = z.input<typeof UserPreferencesSchema>;
export type UserPreferencesOutput = z.output<typeof UserPreferencesSchema>;

export const MMKV_KEYS = {
  SHORTCUTS: '@shortcuts',
  BUBBLE_CONFIG: '@bubble_config',
  USER_PREFERENCES: '@user_preferences',
} as const;

export const createDefaultShortcut = (overrides: Partial<Shortcut> = {}): Shortcut => ({
  id: crypto.randomUUID(),
  label: '',
  actionType: ShortcutActionType.CUSTOM,
  actionPayload: '',
  iconName: 'help-circle',
  order: 0,
  isEnabled: true,
  ...overrides,
});

export const createDefaultBubbleConfig = (): BubbleConfig => ({
  position: { x: 300, y: 600 },
  size: 60,
  opacity: 0.9,
  animation: 'spring',
});

export const createDefaultUserPreferences = (): UserPreferences => ({
  theme: 'system',
  hapticsEnabled: true,
  bubbleEnabled: true,
});