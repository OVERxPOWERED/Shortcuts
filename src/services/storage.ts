import { MMKV } from 'react-native-mmkv';
import { Shortcut, BubbleConfig, UserPreferences } from '../types';

const STORAGE_ID = 'shortcuts-storage';
const KEYS = {
  SHORTCUTS: 'shortcuts',
  BUBBLE_CONFIG: 'bubbleConfig',
  USER_PREFERENCES: 'userPreferences',
  MIGRATION_VERSION: 'migrationVersion',
} as const;

const CURRENT_MIGRATION_VERSION = 1;

class StorageService {
  private storage: MMKV;
  private static instance: StorageService;

  private constructor() {
    this.storage = new MMKV({
      id: STORAGE_ID,
      encryptionKey: 'shortcuts-app-secure-key-2024',
    });
    this.runMigrations();
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private runMigrations(): void {
    const currentVersion = this.storage.getNumber(KEYS.MIGRATION_VERSION) ?? 0;

    if (currentVersion < CURRENT_MIGRATION_VERSION) {
      this.migrateFromAsyncStorage();
      this.storage.set(KEYS.MIGRATION_VERSION, CURRENT_MIGRATION_VERSION);
    }
  }

  private async migrateFromAsyncStorage(): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      
      const shortcutsData = await AsyncStorage.getItem('shortcuts');
      if (shortcutsData) {
        this.setShortcuts(JSON.parse(shortcutsData));
        await AsyncStorage.removeItem('shortcuts');
      }

      const bubbleConfigData = await AsyncStorage.getItem('bubbleConfig');
      if (bubbleConfigData) {
        this.setBubbleConfig(JSON.parse(bubbleConfigData));
        await AsyncStorage.removeItem('bubbleConfig');
      }

      const userPrefsData = await AsyncStorage.getItem('userPreferences');
      if (userPrefsData) {
        this.setUserPreferences(JSON.parse(userPrefsData));
        await AsyncStorage.removeItem('userPreferences');
      }
    } catch (error) {
      console.warn('Migration from AsyncStorage failed:', error);
    }
  }

  private validateShortcuts(data: unknown): Shortcut[] {
    if (!Array.isArray(data)) {
      return [];
    }
    return data.filter((item): item is Shortcut => 
      typeof item === 'object' && 
      item !== null &&
      typeof (item as Record<string, unknown>).id === 'string' &&
      typeof (item as Record<string, unknown>).label === 'string' &&
      typeof (item as Record<string, unknown>).action === 'string' &&
      typeof (item as Record<string, unknown>).icon === 'string' &&
      typeof (item as Record<string, unknown>).order === 'number' &&
      typeof (item as Record<string, unknown>).enabled === 'boolean'
    );
  }

  private validateBubbleConfig(data: unknown): BubbleConfig | null {
    if (!data || typeof data !== 'object') {
      return null;
    }
    const config = data as Record<string, unknown>;
    if (
      typeof config.position === 'object' &&
      config.position !== null &&
      typeof (config.position as Record<string, unknown>).x === 'number' &&
      typeof (config.position as Record<string, unknown>).y === 'number' &&
      typeof config.size === 'number' &&
      typeof config.opacity === 'number' &&
      typeof config.autoHide === 'boolean' &&
      typeof config.autoHideDelay === 'number' &&
      typeof config.hapticFeedback === 'boolean' &&
      typeof config.animationDuration === 'number'
    ) {
      return data as BubbleConfig;
    }
    return null;
  }

  private validateUserPreferences(data: unknown): UserPreferences | null {
    if (!data || typeof data !== 'object') {
      return null;
    }
    const prefs = data as Record<string, unknown>;
    if (
      typeof prefs.theme === 'string' &&
      typeof prefs.language === 'string' &&
      typeof prefs.showTooltips === 'boolean' &&
      typeof prefs.vibrationEnabled === 'boolean' &&
      typeof prefs.soundEnabled === 'boolean'
    ) {
      return data as UserPreferences;
    }
    return null;
  }

  getShortcuts(): Shortcut[] {
    try {
      const data = this.storage.getString(KEYS.SHORTCUTS);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return this.validateShortcuts(parsed);
    } catch (error) {
      console.error('Failed to get shortcuts:', error);
      return [];
    }
  }

  setShortcuts(shortcuts: Shortcut[]): boolean {
    try {
      const validated = this.validateShortcuts(shortcuts);
      this.storage.set(KEYS.SHORTCUTS, JSON.stringify(validated));
      return true;
    } catch (error) {
      console.error('Failed to set shortcuts:', error);
      return false;
    }
  }

  getBubbleConfig(): BubbleConfig | null {
    try {
      const data = this.storage.getString(KEYS.BUBBLE_CONFIG);
      if (!data) return null;
      const parsed = JSON.parse(data);
      return this.validateBubbleConfig(parsed);
    } catch (error) {
      console.error('Failed to get bubble config:', error);
      return null;
    }
  }

  setBubbleConfig(config: BubbleConfig): boolean {
    try {
      const validated = this.validateBubbleConfig(config);
      if (!validated) return false;
      this.storage.set(KEYS.BUBBLE_CONFIG, JSON.stringify(validated));
      return true;
    } catch (error) {
      console.error('Failed to set bubble config:', error);
      return false;
    }
  }

  getUserPreferences(): UserPreferences | null {
    try {
      const data = this.storage.getString(KEYS.USER_PREFERENCES);
      if (!data) return null;
      const parsed = JSON.parse(data);
      return this.validateUserPreferences(parsed);
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return null;
    }
  }

  setUserPreferences(preferences: UserPreferences): boolean {
    try {
      const validated = this.validateUserPreferences(preferences);
      if (!validated) return false;
      this.storage.set(KEYS.USER_PREFERENCES, JSON.stringify(validated));
      return true;
    } catch (error) {
      console.error('Failed to set user preferences:', error);
      return false;
    }
  }

  clearAll(): boolean {
    try {
      this.storage.clearAll();
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  }

  getStorageInstance(): MMKV {
    return this.storage;
  }
}

export const storageService = StorageService.getInstance();
export default storageService;