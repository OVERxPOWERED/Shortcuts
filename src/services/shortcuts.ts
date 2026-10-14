import { StorageService } from './storage';
import { Shortcut, ShortcutInput, ShortcutValidationResult } from '../types/shortcut';
import { validateShortcut } from '../utils/validation';

class ShortcutsService {
  private storage: StorageService;
  private readonly STORAGE_KEY = 'shortcuts';

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  async getAllShortcuts(): Promise<Shortcut[]> {
    const shortcuts = await this.storage.get<Shortcut[]>(this.STORAGE_KEY);
    return shortcuts ?? [];
  }

  async getEnabledShortcuts(): Promise<Shortcut[]> {
    const allShortcuts = await this.getAllShortcuts();
    return allShortcuts
      .filter((shortcut) => shortcut.enabled)
      .sort((a, b) => a.order - b.order);
  }

  async addShortcut(input: ShortcutInput): Promise<Shortcut> {
    const validation = validateShortcut(input);
    if (!validation.isValid) {
      throw new Error(`Invalid shortcut: ${validation.errors.join(', ')}`);
    }

    const shortcuts = await this.getAllShortcuts();
    const maxOrder = shortcuts.length > 0 ? Math.max(...shortcuts.map((s) => s.order)) : -1;

    const newShortcut: Shortcut = {
      id: crypto.randomUUID(),
      ...input,
      enabled: input.enabled ?? true,
      order: maxOrder + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedShortcuts = [...shortcuts, newShortcut];
    await this.storage.set(this.STORAGE_KEY, updatedShortcuts);
    return newShortcut;
  }

  async updateShortcut(id: string, input: Partial<ShortcutInput>): Promise<Shortcut | null> {
    const shortcuts = await this.getAllShortcuts();
    const index = shortcuts.findIndex((s) => s.id === id);

    if (index === -1) {
      return null;
    }

    const existingShortcut = shortcuts[index];
    const mergedInput = { ...existingShortcut, ...input };

    const validation = validateShortcut(mergedInput);
    if (!validation.isValid) {
      throw new Error(`Invalid shortcut: ${validation.errors.join(', ')}`);
    }

    const updatedShortcut: Shortcut = {
      ...existingShortcut,
      ...input,
      id: existingShortcut.id,
      createdAt: existingShortcut.createdAt,
      updatedAt: Date.now(),
    };

    shortcuts[index] = updatedShortcut;
    await this.storage.set(this.STORAGE_KEY, shortcuts);
    return updatedShortcut;
  }

  async deleteShortcut(id: string): Promise<boolean> {
    const shortcuts = await this.getAllShortcuts();
    const filteredShortcuts = shortcuts.filter((s) => s.id !== id);

    if (filteredShortcuts.length === shortcuts.length) {
      return false;
    }

    await this.storage.set(this.STORAGE_KEY, filteredShortcuts);
    return true;
  }

  async reorderShortcuts(shortcutIds: string[]): Promise<Shortcut[]> {
    const shortcuts = await this.getAllShortcuts();
    const shortcutMap = new Map(shortcuts.map((s) => [s.id, s]));

    const reorderedShortcuts: Shortcut[] = [];
    let order = 0;

    for (const id of shortcutIds) {
      const shortcut = shortcutMap.get(id);
      if (shortcut) {
        reorderedShortcuts.push({ ...shortcut, order, updatedAt: Date.now() });
        order++;
      }
    }

    const remainingShortcuts = shortcuts.filter((s) => !shortcutIds.includes(s.id));
    for (const shortcut of remainingShortcuts) {
      reorderedShortcuts.push({ ...shortcut, order, updatedAt: Date.now() });
      order++;
    }

    await this.storage.set(this.STORAGE_KEY, reorderedShortcuts);
    return reorderedShortcuts;
  }

  async toggleShortcut(id: string): Promise<Shortcut | null> {
    const shortcuts = await this.getAllShortcuts();
    const index = shortcuts.findIndex((s) => s.id === id);

    if (index === -1) {
      return null;
    }

    const updatedShortcut: Shortcut = {
      ...shortcuts[index],
      enabled: !shortcuts[index].enabled,
      updatedAt: Date.now(),
    };

    shortcuts[index] = updatedShortcut;
    await this.storage.set(this.STORAGE_KEY, shortcuts);
    return updatedShortcut;
  }
}

let shortcutsServiceInstance: ShortcutsService | null = null;

export function getShortcutsService(storage?: StorageService): ShortcutsService {
  if (!shortcutsServiceInstance) {
    if (!storage) {
      throw new Error('StorageService is required for first initialization');
    }
    shortcutsServiceInstance = new ShortcutsService(storage);
  }
  return shortcutsServiceInstance;
}

export function resetShortcutsService(): void {
  shortcutsServiceInstance = null;
}