import { MMKV } from 'react-native-mmkv';
import { Shortcut, ShortcutParams } from '../models/shortcut';
import { ShortcutParamsSchema } from './inputSanitizationService';

const STORAGE_KEY = 'shortcuts';

class ShortcutsService {
  private static instance: ShortcutsService;
  private storage: MMKV;
  private cache: Shortcut[] | null = null;

  private constructor() {
    this.storage = new MMKV();
    this.loadFromStorage();
  }

  public static getInstance(): ShortcutsService {
    if (!ShortcutsService.instance) {
      ShortcutsService.instance = new ShortcutsService();
    }
    return ShortcutsService.instance;
  }

  private loadFromStorage(): void {
    try {
      const data = this.storage.getString(STORAGE_KEY);
      if (data) {
        this.cache = JSON.parse(data);
      } else {
        this.cache = [];
      }
    } catch (error) {
      console.error('Failed to load shortcuts from storage:', error);
      this.cache = [];
    }
  }

  private saveToStorage(): void {
    try {
      if (this.cache !== null) {
        this.storage.set(STORAGE_KEY, JSON.stringify(this.cache));
      }
    } catch (error) {
      console.error('Failed to save shortcuts to storage:', error);
    }
  }

  private validateParams(params: unknown): ShortcutParams {
    const result = ShortcutParamsSchema.safeParse(params);
    if (!result.success) {
      throw new Error(`Invalid shortcut parameters: ${result.error.message}`);
    }
    return result.data;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getAll(): Shortcut[] {
    return this.cache ? [...this.cache] : [];
  }

  public getById(id: string): Shortcut | undefined {
    if (!this.cache) return undefined;
    return this.cache.find(shortcut => shortcut.id === id);
  }

  public create(params: ShortcutParams): Shortcut {
    const validatedParams = this.validateParams(params);
    const newShortcut: Shortcut = {
      id: this.generateId(),
      ...validatedParams,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!this.cache) this.cache = [];
    this.cache.push(newShortcut);
    this.saveToStorage();
    return newShortcut;
  }

  public update(id: string, params: Partial<ShortcutParams>): Shortcut | null {
    const validatedParams = this.validateParams(params);
    const index = this.cache?.findIndex(shortcut => shortcut.id === id);

    if (index === undefined || index === -1 || !this.cache) {
      return null;
    }

    const updatedShortcut: Shortcut = {
      ...this.cache[index],
      ...validatedParams,
      id,
      updatedAt: new Date().toISOString(),
    };

    this.cache[index] = updatedShortcut;
    this.saveToStorage();
    return updatedShortcut;
  }

  public delete(id: string): boolean {
    if (!this.cache) return false;
    const initialLength = this.cache.length;
    this.cache = this.cache.filter(shortcut => shortcut.id !== id);
    const deleted = this.cache.length !== initialLength;
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  public reorder(shortcuts: Shortcut[]): Shortcut[] {
    if (!Array.isArray(shortcuts)) {
      throw new Error('Invalid shortcuts array for reorder');
    }
    this.cache = [...shortcuts];
    this.saveToStorage();
    return this.getAll();
  }
}

export const shortcutsService = ShortcutsService.getInstance();