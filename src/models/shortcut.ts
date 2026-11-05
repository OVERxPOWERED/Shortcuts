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
  | NFCTriggerConfig;

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
  /** Start date for the schedule (ISO 8601) */
  startDate?: string;
  /** End date for the schedule (ISO 8601) */
  endDate?: string;
}

/**
 * Configuration for external intent triggers.
 */
export interface ExternalIntentTriggerConfig {
  /** The action string to match */
  action: string;
  /** Optional category to filter intents */
  category?: string;
  /** Optional data URI pattern to match */
  data?: string;
  /** Optional MIME type to match */
  mimeType?: string;
  /** Optional package name to restrict to */
  packageName?: string;
}

/**
 * Configuration for hardware button triggers.
 */
export interface HardwareButtonTriggerConfig {
  /** The hardware button to listen for */
  button: 'volume_up' | 'volume_down' | 'power' | 'camera' | 'home' | 'back' | 'recent_apps' | 'assist';
  /** The action type (press, long_press, double_press) */
  action: 'press' | 'long_press' | 'double_press';
  /** Optional modifier keys required */
  modifiers?: ('shift' | 'alt' | 'ctrl' | 'meta')[];
  /** Minimum duration for long press in ms */
  minDuration?: number;
  /** Maximum interval for double press in ms */
  maxInterval?: number;
}

/**
 * Configuration for geofence triggers.
 */
export interface GeofenceTriggerConfig {
  /** Unique identifier for the geofence region */
  regionId: string;
  /** Latitude of the center point */
  latitude: number;
  /** Longitude of the center point */
  longitude: number;
  /** Radius in meters */
  radius: number;
  /** Transition types to trigger on */
  transitionTypes: ('enter' | 'exit' | 'dwell')[];
  /** Minimum dwell time in ms for dwell transitions */
  dwellDelayMs?: number;
  /** Notification responsiveness in ms */
  notificationResponsivenessMs?: number;
}

/**
 * Configuration for NFC triggers.
 */
export interface NFCTriggerConfig {
  /** The NFC tag technology to match (e.g., 'NfcA', 'NfcB', 'NfcF', 'NfcV', 'IsoDep', 'MifareClassic', 'MifareUltralight') */
  tagTechnology?: string | string[];
  /** Optional NDEF record type to match (TNF + type) */
  ndefRecordType?: string;
  /** Optional payload pattern to match (base64 encoded) */
  payloadPattern?: string;
  /** Whether to require exact match or partial */
  exactMatch?: boolean;
}

/**
 * Represents a shortcut entity with all its properties.
 */
export interface Shortcut {
  /** Unique identifier for the shortcut */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** The action type this shortcut performs */
  action: ShortcutAction;
  /** Configuration specific to the action type */
  actionConfig: ShortcutActionConfig;
  /** Optional icon identifier or URI */
  icon?: string;
  /** Optional color for the shortcut (hex) */
  color?: string;
  /** Whether the shortcut is enabled */
  enabled: boolean;
  /** Order index for display */
  order: number;
  /** Optional trigger configuration */
  trigger?: Trigger;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last modified timestamp (ISO 8601) */
  updatedAt: string;
  /** Optional tags for categorization */
  tags?: string[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Union type for action-specific configuration.
 */
export type ShortcutActionConfig =
  | AppShortcutConfig
  | UrlConfig
  | SystemActionConfig
  | CustomConfig
  | IntentConfig
  | CopyToClipboardConfig
  | ExternalShortcutConfig;

/**
 * Configuration for APP_SHORTCUT action.
 */
export interface AppShortcutConfig {
  /** Package name (Android) or bundle identifier (iOS) */
  packageName: string;
  /** Optional activity/class name to launch */
  className?: string;
  /** Optional deep link URI */
  deepLink?: string;
  /** Optional extra parameters */
  extras?: Record<string, string | number | boolean>;
}

/**
 * Configuration for URL action.
 */
export interface UrlConfig {
  /** The URL to open */
  url: string;
  /** Optional browser package to use */
  browserPackage?: string;
  /** Whether to open in external browser */
  external?: boolean;
}

/**
 * Configuration for SYSTEM_ACTION action.
 */
export interface SystemActionConfig {
  /** The system action to perform */
  action: 'toggle_wifi' | 'toggle_bluetooth' | 'toggle_flashlight' | 'toggle_airplane_mode' | 'open_settings' | 'open_wifi_settings' | 'open_bluetooth_settings' | 'open_location_settings' | 'take_screenshot' | 'lock_screen' | 'power_dialog' | 'volume_up' | 'volume_down' | 'media_play_pause' | 'media_next' | 'media_previous';
  /** Optional parameters for the action */
  params?: Record<string, string | number | boolean>;
}

/**
 * Configuration for CUSTOM action.
 */
export interface CustomConfig {
  /** JavaScript code to execute */
  script: string;
  /** Optional function name to call */
  functionName?: string;
  /** Optional parameters to pass */
  params?: Record<string, unknown>;
  /** Whether to run in background */
  background?: boolean;
}

/**
 * Configuration for INTENT action.
 */
export interface IntentConfig {
  /** Intent action */
  action: string;
  /** Optional category */
  category?: string;
  /** Optional data URI */
  data?: string;
  /** Optional MIME type */
  mimeType?: string;
  /** Optional package name */
  packageName?: string;
  /** Optional class name */
  className?: string;
  /** Optional extras */
  extras?: Record<string, string | number | boolean | string[] | number[]>;
  /** Intent flags */
  flags?: number;
}

/**
 * Configuration for COPY_TO_CLIPBOARD action.
 */
export interface CopyToClipboardConfig {
  /** Text to copy */
  text: string;
  /** Optional label for the clipboard entry */
  label?: string;
}

/**
 * Configuration for EXTERNAL_SHORTCUT action.
 */
export interface ExternalShortcutConfig {
  /** The shortcut identifier in the external app */
  shortcutId: string;
  /** The external app package/bundle identifier */
  appIdentifier: string;
  /** Optional parameters */
  params?: Record<string, unknown>;
}

/**
 * Configuration for the floating bubble appearance and behavior.
 */
export interface BubbleConfig {
  /** Position of the bubble on screen */
  position: {
    /** X coordinate (0-1 relative to screen width, or absolute pixels) */
    x: number;
    /** Y coordinate (0-1 relative to screen height, or absolute pixels) */
    y: number;
    /** Whether coordinates are relative (percentage) or absolute */
    relative: boolean;
  };
  /** Size of the bubble in pixels */
  size: number;
  /** Opacity of the bubble (0-1) */
  opacity: number;
  /** Background color of the bubble (hex) */
  color: string;
  /** Border color of the bubble (hex) */
  borderColor: string;
  /** Border width in pixels */
  borderWidth: number;
  /** Border radius in pixels (for rounded corners) */
  borderRadius: number;
  /** Animation configuration */
  animation: {
    /** Enable entrance animation */
    entrance: boolean;
    /** Enable exit animation */
    exit: boolean;
    /** Animation duration in ms */
    duration: number;
    /** Animation easing function */
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
    /** Spring config if using spring easing */
    springConfig?: {
      damping: number;
      stiffness: number;
      mass: number;
    };
  };
  /** Shadow configuration */
  shadow?: {
    /** Shadow color */
    color: string;
    /** Shadow offset */
    offset: { width: number; height: number };
    /** Shadow opacity (0-1) */
    opacity: number;
    /** Shadow radius */
    radius: number;
  };
  /** Whether the bubble is draggable */
  draggable: boolean;
  /** Whether the bubble shows on top of all apps (requires overlay permission) */
  overlay: boolean;
  /** Minimum distance from screen edges in pixels */
  edgeInset: number;
  /** Haptic feedback on interaction */
  hapticFeedback: boolean;
  /** Sound effect on interaction (optional URI) */
  soundEffect?: string;
}

/**
 * Registry containing all shortcuts and metadata.
 */
export interface ShortcutRegistry {
  /** Array of all registered shortcuts */
  shortcuts: Shortcut[];
  /** Schema version for migration */
  version: number;
  /** Last modified timestamp (ISO 8601) */
  lastModified: string;
  /** Optional user ID for multi-user support */
  userId?: string;
  /** Optional device ID */
  deviceId?: string;
  /** Checksum for integrity verification */
  checksum?: string;
}

/**
 * Type guard to check if a value is a valid Trigger.
 */
export function isTrigger(value: unknown): value is Trigger {
  if (!value || typeof value !== 'object') return false;
  const trigger = value as Record<string, unknown>;
  return (
    typeof trigger.type === 'string' &&
    Object.values(TriggerType).includes(trigger.type as TriggerType) &&
    trigger.config !== undefined &&
    typeof trigger.config === 'object'
  );
}

/**
 * Type guard to check if a value is a valid BubbleConfig.
 */
export function isBubbleConfig(value: unknown): value is BubbleConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Record<string, unknown>;
  return (
    typeof config.position === 'object' &&
    config.position !== null &&
    typeof (config.position as Record<string, unknown>).x === 'number' &&
    typeof (config.position as Record<string, unknown>).y === 'number' &&
    typeof (config.position as Record<string, unknown>).relative === 'boolean' &&
    typeof config.size === 'number' &&
    typeof config.opacity === 'number' &&
    typeof config.color === 'string' &&
    typeof config.borderColor === 'string' &&
    typeof config.borderWidth === 'number' &&
    typeof config.borderRadius === 'number' &&
    typeof config.animation === 'object' &&
    config.animation !== null &&
    typeof (config.animation as Record<string, unknown>).entrance === 'boolean' &&
    typeof (config.animation as Record<string, unknown>).exit === 'boolean' &&
    typeof (config.animation as Record<string, unknown>).duration === 'number' &&
    typeof (config.animation as Record<string, unknown>).easing === 'string' &&
    typeof config.draggable === 'boolean' &&
    typeof config.overlay === 'boolean' &&
    typeof config.edgeInset === 'number' &&
    typeof config.hapticFeedback === 'boolean'
  );
}

/**
 * Type guard to check if a value is a valid Shortcut.
 */
export function isShortcut(value: unknown): value is Shortcut {
  if (!value || typeof value !== 'object') return false;
  const shortcut = value as Record<string, unknown>;
  return (
    typeof shortcut.id === 'string' &&
    typeof shortcut.name === 'string' &&
    typeof shortcut.action === 'string' &&
    Object.values(ShortcutAction).includes(shortcut.action as ShortcutAction) &&
    shortcut.actionConfig !== undefined &&
    typeof shortcut.actionConfig === 'object' &&
    typeof shortcut.enabled ===