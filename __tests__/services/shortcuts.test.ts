```typescript
import { ShortcutsService } from '../../src/services/shortcuts';
import { StorageService } from '../../src/services/storage';
import { Shortcut } from '../../src/types/shortcut';

// Mock StorageService
jest.mock('../../src/services/storage', () => ({
  StorageService: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    getAllKeys: jest.fn(),
    clear: jest.fn(),
  },
}));

const mockStorageService = StorageService as jest.Mocked<typeof StorageService>;

describe('ShortcutsService', () => {
  const STORAGE_KEY = '@shortcuts';

  const createMockShortcut = (overrides: Partial<Shortcut> = {}): Shortcut => ({
    id: 'test-id-1',
    label: 'Test Shortcut',
    url: 'https://example.com',
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  const mockShortcuts: Shortcut[] = [
    createMockShortcut({ id: 'id-1', label: 'First', order: 0 }),
    createMockShortcut({ id: 'id-2', label: 'Second', order: 1 }),
    createMockShortcut({ id: 'id-3', label: 'Third', order: 2 }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService.getItem.mockResolvedValue(null);
    mockStorageService.setItem.mockResolvedValue(undefined);
  });

  describe('getShortcuts', () => {
    it('returns empty array when no shortcuts stored', async () => {
      mockStorageService.getItem.mockResolvedValueOnce(null);
      const result = await ShortcutsService.getShortcuts();
      expect(result).toEqual([]);
      expect(mockStorageService.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('returns parsed shortcuts from storage', async () => {
      mockStorageService.getItem.mockResolvedValueOnce(JSON.stringify(mockShortcuts));
      const result = await ShortcutsService.getShortcuts();
      expect(result).toEqual(mockShortcuts);
    });

    it('returns empty array and logs error on parse failure', async () => {
      mockStorageService.getItem.mockResolvedValueOnce('invalid json');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await ShortcutsService.getShortcuts();
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('normalizes order if shortcuts have gaps', async () => {
      const unorderedShortcuts = [
        createMockShortcut({ id: 'id-1', label: 'First', order: 5 }),
        createMockShortcut({ id: 'id-2', label: 'Second', order: 10 }),
        createMockShortcut({ id: 'id-3', label: 'Third', order: 0 }),
      ];
      mockStorageService.getItem.mockResolvedValueOnce(JSON.stringify(unorderedShortcuts));
      const result = await ShortcutsService.getShortcuts();
      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
      expect(result[2].order).toBe(2);
    });
  });

  describe('getShortcutById', () => {
    it('returns shortcut when found', async () => {
      mockStorageService.getItem.mockResolvedValueOnce(JSON.stringify(mockShortcuts));
      const result = await ShortcutsService.getShortcutById('id-2');
      expect(result).toEqual(mockShortcuts[1]);
    });

    it('returns null when not found', async () => {
      mockStorageService.getItem.mockResolvedValueOnce(JSON.stringify(mockShortcuts));
      const result = await ShortcutsService.getShortcutById('non-existent');
      expect(result).toBeNull();
    });

    it('returns null when storage is empty', async () => {
      mockStorageService.getItem.mockResolvedValueOnce(null);
      const result = await ShortcutsService.getShortcutById('id-1');
      expect(result).toBeNull();
    });
  });

  describe('createShortcut', () => {
    it('creates shortcut with generated UUID and correct order', async () => {
      mockStorageService.getItem.mockResolvedValueOnce(JSON.stringify(mockShortcuts));
      const newShortcut = await ShortcutsService.createShortcut({
        label: 'New Shortcut',
        url: 'https://new.com',
      });

      expect(newShortcut.id).toBeDefined();
      expect(newShortcut.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(newShortcut.label).toBe('New Shortcut');
      expect(newShortcut.url).toBe('https://new.com');
      expect(newShortcut.order).toBe(3);
      expect(newShortcut.createdAt).toBeDefined();
      expect(newShortcut.updatedAt).toBeDefined();
      expect(mockStorageService.setItem).toHaveBeenCalled();
    });

    it('creates first shortcut with order 0 when list is empty', async () => {
      mockStorageService.getItem.mockResolvedValueOnce(null);
      const newShortcut = await ShortcutsService.createShortcut({
        label: 'First',
        url: 'https://first.com',
      });
      expect(newShortcut.order).toBe(0);
    });

    it('throws error for empty label', async () => {
      await expect(
        ShortcutsService.createShortcut({ label: '', url: 'https://test.com' })
      ).rejects.toThrow('Label is required');
    });

    it('throws error for whitespace-only label', async () => {
      await expect(
        ShortcutsService.createShortcut({ label: '   ', url: 'https://test.com' })
      ).rejects.toThrow('Label is required');
    });

    it('throws error for empty URL', async () => {
      await expect(
        ShortcutsService.createShortcut({ label: 'Test', url: '' })
      ).rejects.toThrow('URL is required');
    });

    it('throws error for invalid URL format', async () => {
      await expect(
        ShortcutsService.createShortcut({ label: 'Test', url: 'not-a-url' })
      ).rejects.toThrow('Invalid URL format');
    });

    it('throws error for duplicate label', async () => {
      mockStorageService.getItem.mockResolvedValueOnce(JSON.stringify(mockShortcuts));
      await expect(
        ShortcutsService.createShortcut({ label: 'First', url: 'https://duplicate.com' })
      ).rejects.toThrow('Shortcut with this label already exists');
    });

    it('throws error for duplicate label case-insensitive', async () => {
      mockStorageService.getItem.mockResolvedValueOnce(JSON.stringify(mockShortcuts));
      await expect(
        ShortcutsService.createShortcut({ label: 'FIRST', url: 'https://duplicate.com' })
      ).rejects.to