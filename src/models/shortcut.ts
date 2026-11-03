/**
 * Core domain data models and type contracts for the floating bubble shortcuts system.
 * Defines strict TypeScript interfaces for Shortcut, BubbleConfig, and Trigger entities.
 */

/**
 * Enumeration of supported shortcut action types.
 * Defines the category of action a shortcut can perform.
 */
export enum ShortcutAction {
  /** Opens a specific application via deep link or package name */
  APP_SHORTCUT = 'APP_SHORTCUT',
  /** Opens a URL in the default browser or specified app */
  URL = 'URL',
  /** Triggers a system-level action (e.g., toggle WiFi, open settings) */
  SYSTEM_ACTION = 'SYSTEM_ACTION',
  /** Executes a custom JavaScript function or script */
  CUSTOM = 'CUSTOM',
  /** Sends an intent to another application */
  INTENT = 'INTENT',
  /** Copies text to clipboard */
  COPY_TO_CLIPBOARD = 'COPY_TO_CLIPBOARD',
  /** Triggers a shortcut from another app (e.g., Shortcuts app on iOS) */
  EXTERNAL_SHORTCUT = 'EXTERNAL_SHORTCUT',
}

/**
 * Configuration for a shortcut trigger.
 * Defines how a shortcut can be activated beyond the bubble menu.
 */
export interface Trigger {
  /** The type of trigger mechanism */
  type: TriggerType;
  /** Configuration specific to the trigger type */
  config: TriggerConfig;
}

/**
 * Enumeration of supported trigger types.
 */
export enum TriggerType {
  /** Triggered by a gesture on the bubble (long press, double tap, etc.) */
  GESTURE = 'GESTURE',
  /** Triggered by a system event (boot, network change, etc.) */
  SYSTEM_EVENT = 'SYSTEM_EVENT',
  /** Triggered by a scheduled time or interval */
  SCHEDULE = 'SCHEDULE',
  /** Triggered by an external intent or deep link */
  EXTERNAL_INTENT = 'EXTERNAL_INTENT',
  /** Triggered by a hardware button or key combination */
  HARDWARE_BUTTON = 'HARDWARE_BUTTON',
  /** Triggered when entering/exiting a geographic region */
  GEOFENCE = 'GEOFENCE',
  /** Triggered by NFC tag detection */
  NFC = 'NFC',
}

/**
 * Union type for trigger-specific configuration.
 * Each trigger type has its own configuration structure.
 */
export type TriggerConfig =
  | GestureTriggerConfig
  | SystemEventTriggerConfig
  | ScheduleTriggerConfig
  | ExternalIntentTriggerConfig
  | HardwareButtonTriggerConfig
  | GeofenceTriggerConfig
  | NFCTiggerConfig;

/**
 * Configuration for gesture-based triggers.
 */
export interface GestureTriggerConfig {
  /** The gesture type that activates the shortcut */
  gesture: 'long_press' | 'double_tap' | 'swipe_up' | 'swipe_down' | 'swipe_left' | 'swipe_right' | 'force_touch';
  /** Minimum duration in ms for long press gestures */
  minDuration?: number;
  /** Maximum duration in ms for double tap gestures */
  maxDuration?: number;
  /** Required number of taps for tap-based gestures */
  tapCount?: number;
  /** Direction threshold for swipe gestures (pixels) */
  swipeThreshold?: number;
}

/**
 * Configuration for system event triggers.
 */
export interface SystemEventTriggerConfig {
  /** The system event to listen for */
  event: 'boot_completed' | 'network_changed' | 'battery_low' | 'battery_charging' | 'screen_on' | 'screen_off' | 'app_foreground' | 'app_background';
  /** Optional filter for the event (e.g., specific network type) */
  filter?: Record<string, string>;
}

/**
 * Configuration for scheduled triggers.
 */
export interface ScheduleTriggerConfig {
  /** Cron expression for recurring schedules */
  cronExpression?: string;
  /** ISO 8601 timestamp for one-time triggers */
  timestamp?: string;
  /** Interval in milliseconds for repeating triggers */
  intervalMs?: number;
  /** Timezone for the schedule (IANA timezone identifier) */
  timezone?: string;
  /** Whether the schedule repeats */
  repeating?: boolean;
  /** Days of week for weekly schedules (0 = Sunday) */
  daysOfWeek?: number[];
}

/**
 * Configuration for external intent triggers.
 */
export interface ExternalIntentTriggerConfig {
  /** The action string to match */
  action: string;
  /** Optional category to filter intents */
  category?: string;
  /** Optional data URI scheme to match */
  dataScheme?: string;
  /** Optional data host to match */
  dataHost?: string;
  /** Optional MIME type to match */
  mimeType?: string;
}

/**
 * Configuration for hardware button triggers.
 */
export interface HardwareButtonTriggerConfig {
  /** The hardware button to listen for */
  button: 'volume_up' | 'volume_down' | 'power' | 'camera' | 'headset_hook' | 'assist';
  /** The press type required */
  pressType: 'single' | 'double' | 'long' | 'combo';
  /** Optional combination with other buttons */
  comboButtons?: ('volume_up' | 'volume_down' | 'power')[];
  /** Timeout for combo detection in ms */
  comboTimeoutMs?: number;
}

/**
 * Configuration for geofence triggers.
 */
export interface GeofenceTriggerConfig {
  /** Latitude of the geofence center */
  latitude: number;
  /** Longitude of the geofence center */
  longitude: number;
  /** Radius in meters */
  radius: number;
  /** Transition types to trigger on */
  transitions: ('enter' | 'exit' | 'dwell')[];
  /** Minimum dwell time in ms for dwell transitions */
  dwellDelayMs?: number;
  /** Optional identifier for the geofence */
  identifier?: string;
}

/**
 * Configuration for NFC tag triggers.
 */
export interface NFCTiggerConfig {
  /** NFC technology to filter (e.g., 'NfcA', 'NfcB', 'NfcF', 'NfcV', 'IsoDep') */
  techList?: string[];
  /** Optional NDEF record type to match */
  recordType?: string;
  /** Optional payload prefix to match */
  payloadPrefix?: string;
}

/**
 * Metadata associated with a shortcut.
 * Extensible key-value store for additional information.
 */
export interface ShortcutMetadata {
  /** Human-readable description of the shortcut */
  description?: string;
  /** Tags for categorization and filtering */
  tags?: string[];
  /** Version of the shortcut definition */
  version?: string;
  /** Author or source of the shortcut */
  author?: string;
  /** Whether the shortcut is a user favorite */
  isFavorite?: boolean;
  /** Usage count for sorting/prioritization */
  usageCount?: number;
  /** Last time the shortcut was executed (ISO 8601) */
  lastExecutedAt?: string;
  /** Custom data for extensions */
  customData?: Record<string, unknown>;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
  /** Whether the shortcut requires confirmation before execution */
  requiresConfirmation?: boolean;
  /** Confirmation message if required */
  confirmationMessage?: string;
}

/**
 * Represents a single shortcut action in the floating bubble.
 */
export interface Shortcut {
  /** Unique identifier for the shortcut (UUID v4) */
  id: string;
  /** Display name of the shortcut */
  name: string;
  /** The type of action this shortcut performs */
  action: ShortcutAction;
  /** Action-specific payload (URL, package name, script, etc.) */
  payload: string;
  /** Icon identifier (system icon name, SF Symbol, Material Icon, or custom asset path) */
  icon: string;
  /** Hex color code for the shortcut (e.g., '#FF5722') */
  color: string;
  /** Display order within the bubble (lower values appear first) */
  order: number;
  /** Whether the shortcut is currently enabled */
  enabled: boolean;
  /** Optional trigger configuration for alternative activation */
  trigger?: Trigger;
  /** Additional metadata for the shortcut */
  metadata: ShortcutMetadata;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Configuration for the floating bubble appearance and behavior.
 */
export interface BubbleConfig {
  /** Unique identifier for this bubble configuration */
  id: string;
  /** Current position of the bubble on screen */
  position: BubblePosition;
  /** Size of the bubble in density-independent pixels */
  size: number;
  /** Opacity of the bubble (0.0 to 1.0) */
  opacity: number;
  /** Background color of the bubble (hex color code) */
  color: string;
  /** Border color of the bubble (hex color code) */
  borderColor: string;
  /** Array of shortcut IDs in display order */
  shortcuts: string[];
  /** Animation type for bubble transitions */
  animation: BubbleAnimation;
  /** Whether the bubble is currently visible */
  visible: boolean;
  /** Whether the bubble can be dragged by the user */
  draggable: boolean;
  /** Magnet behavior for edge snapping */
  magnet: BubbleMagnet;
  /** Haptic feedback intensity */
  hapticIntensity: HapticIntensity;
  /** Whether to show shortcut labels */
  showLabels: boolean;
  /** Maximum number of shortcuts to display */
  maxShortcuts: number;
  /** Auto-hide delay in milliseconds (0 = disabled) */
  autoHideDelay: number;
}

/**
 * Position coordinates for the bubble.
 */
export interface BubblePosition {
  /** X coordinate in density-independent pixels */
  x: number;
  /** Y coordinate in density-independent pixels */
  y: number;
}

/**
 * Animation types for bubble transitions.
 */
export type BubbleAnimation = 'spring' | 'timing' | 'none' | 'bounce' | 'elastic';

/**
 * Magnet behavior for edge snapping.
 */
export type BubbleMagnet = 'none' | 'edges' | 'corners' | 'all';

/**
 * Haptic feedback intensity levels.
 */
export type HapticIntensity = 'none' | 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';

/**
 * User preferences for the application.
 */
export interface UserPreferences {
  /** Color theme preference */
  theme: 'light' | 'dark' | 'system';
  /** Whether haptic feedback is enabled globally */
  hapticsEnabled: boolean;
  /** Whether the floating bubble is enabled */
  bubbleEnabled: boolean;
  /** Whether to start bubble on app launch */
  startOnBoot: boolean;
  /** Default bubble configuration ID */
  defaultBubbleId?: string;
  /** Language preference (ISO 639-1 code) */
  language?: string;
  /** Whether to collect anonymous usage analytics */
  analyticsEnabled: boolean;
  /** Whether to check for updates automatically */
  autoUpdateEnabled: boolean;
}

/**
 * Storage keys for MMKV persistence.
 */
export const MMKV_KEYS = {
  SHORTCUTS: '@shortcuts',
  BUBBLE_CONFIG: '@bubble_config',
  USER_PREFERENCES: '@user_preferences',
  SHORTCUT_METADATA: '@shortcut_metadata',
  TRIGGER_CONFIGS: '@trigger_configs',
} as const;

/**
 * Creates a default shortcut with optional overrides.
 * @param overrides - Partial shortcut properties to override defaults
 * @returns A new Shortcut instance with defaults applied
 */
export const createDefaultShortcut = (overrides: Partial<Shortcut> = {}): Shortcut => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: '',
    action: ShortcutAction.CUSTOM,
    payload: '',
    icon: 'help-circle',
    color: '#2196F3',
    order: 0,
    enabled: true,
    metadata: {
      description: '',
      tags: [],
      version: '1.0.0',
      isFavorite: false,
      usageCount: 0,
      requiresConfirmation: false,
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

/**
 * Creates a default bubble configuration.
 * @returns A new BubbleConfig instance with sensible defaults
 */
export const createDefaultBubbleConfig = (): BubbleConfig => ({
  id: crypto.randomUUID(),
  position: { x: 300, y: 600 },
  size: 60,
  opacity: 0.9,
  color: '#FFFFFF',
  borderColor: '#E0E0E0',
  shortcuts: [],
  animation: 'spring',
  visible: true,
  draggable: true,
  magnet: 'edges',
  hapticIntensity: 'medium',
  showLabels: true,
  maxShortcuts: 8,
  autoHideDelay: 0,
});

/**
 * Creates default user preferences.
 * @returns A new UserPreferences instance with defaults
 */
export const createDefaultUserPreferences = (): UserPreferences => ({
  theme: 'system',
  hapticsEnabled: true,
  bubbleEnabled: true,
  startOnBoot: false,
  analyticsEnabled: false,
  autoUpdateEnabled: true,
});

/**
 * Type guard to check if a value is a valid ShortcutAction.
 * @param value - The value to check
 * @returns True if the value is a valid ShortcutAction
 */
export const isShortcutAction = (value: string): value is ShortcutAction => {
  return Object.values(ShortcutAction).includes(value as ShortcutAction);
};

/**
 * Type guard to check if a value is a valid TriggerType.
 * @param value - The value to check
 * @returns True if the value is a valid TriggerType
 */
export const isTriggerType = (value: string): value is TriggerType => {
  return Object.values(TriggerType).includes(value as TriggerType);
};

/**
 * Type guard to check if a value is a valid BubbleAnimation.
 * @param value - The value to check
 * @returns True if the value is a valid BubbleAnimation
 */
export const isBubbleAnimation = (value: string): value is BubbleAnimation => {
  return ['spring', 'timing', 'none', 'bounce', 'elastic'].includes(value);
};

/**
 * Type guard to check if a value is a valid BubbleMagnet.
 * @param value - The value to check
 * @returns True if the value is a valid BubbleMagnet
 */
export const isBubbleMagnet = (value: string): value is BubbleMagnet => {
  return ['none', 'edges', 'corners', 'all'].includes(value);
};

/**
 * Type guard to check if a value is a valid HapticIntensity.
 * @param value - The value to check
 * @returns True if the value is a valid HapticIntensity
 */
export const isHapticIntensity = (value: string): value is HapticIntensity => {
  return ['none', 'light', 'medium', 'heavy', 'rigid', 'soft'].includes(value);
};