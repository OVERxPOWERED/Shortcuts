import { ShortcutsService } from '../../src/services/shortcutsService';
import { Shortcut, ShortcutAction } from '../../src/types/shortcut';

// Mock MMKV before importing the service
const mockMMKV = {
  getString: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  getAllKeys: jest.fn(),
  contains: jest.fn(),
  clearAll: jest.fn(),
};

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => mockMMKV),
}));

describe('ShortcutsService', () => {
  let service: ShortcutsService;
  const STORAGE_KEY = '@shortcuts';

  const validShortcutData = {
    name: 'Test Shortcut',
    color: '#FF5733',
    action: ShortcutAction.OPEN_APP,
    actionPayload: { packageName: 'com.test.app' },
  };

  const createValidShortcut = (overrides: Partial<Shortcut> = {}): Shortcut => ({
    id: 'test-id-1',
    name: 'Test Shortcut',
    color: '#FF5733',
    action: ShortcutAction.OPEN_APP,
    actionPayload: { packageName: 'com.test.app' },
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockMMKV.getString.mockReturnValue(null);
    mockMMKV.getAllKeys.mockReturnValue([]);
    service = new ShortcutsService();
  });

  describe('create', () => {
    it('should create a valid shortcut and persist it', async () => {
      const shortcut = await service.create(validShortcutData);

      expect(shortcut).toMatchObject({
        name: validShortcutData.name,
        color: validShortcutData.color,
        action: validShortcutData.action,
        actionPayload: validShortcutData.actionPayload,
      });
      expect(shortcut.id).toBeDefined();
      expect(shortcut.order).toBe(0);
      expect(shortcut.createdAt).toBeDefined();
      expect(shortcut.updatedAt).toBeDefined();

      expect(mockMMKV.set).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining(shortcut.id)
      );
    });

    it('should assign incremental order for multiple shortcuts', async () => {
      const existingShortcuts = [
        createValidShortcut({ id: '1', order: 0 }),
        createValidShortcut({ id: '2', order: 1 }),
      ];
      mockMMKV.getString.mockReturnValue(JSON.stringify(existingShortcuts));

      const newService = new ShortcutsService();
      const shortcut = await newService.create(validShortcutData);

      expect(shortcut.order).toBe(2);
    });

    it('should reject shortcut with name too long', async () => {
      const longName = 'a'.repeat(51);
      await expect(
        service.create({ ...validShortcutData, name: longName })
      ).rejects.toThrow('Shortcut name must be 50 characters or less');
    });

    it('should reject shortcut with empty name', async () => {
      await expect(
        service.create({ ...validShortcutData, name: '' })
      ).rejects.toThrow('Shortcut name is required');
    });

    it('should reject shortcut with whitespace-only name', async () => {
      await expect(
        service.create({ ...validShortcutData, name: '   ' })
      ).rejects.toThrow('Shortcut name is required');
    });

    it('should reject shortcut with invalid color hex', async () => {
      const invalidColors = ['FF5733', '#FF573', '#GG5733', '#FF573333', 'red', ''];
      
      for (const color of invalidColors) {
        await expect(
          service.create({ ...validShortcutData, color })
        ).rejects.toThrow('Invalid color format. Use #RRGGBB hex format');
      }
    });

    it('should accept valid color hex formats', async () => {
      const validColors = ['#FF5733', '#000000', '#FFFFFF', '#abcdef', '#ABCDEF'];
      
      for (const color of validColors) {
        const shortcut = await service.create({ ...validShortcutData, color });
        expect(shortcut.color).toBe(color.toUpperCase());
        mockMMKV.set.mockClear();
      }
    });

    it('should reject shortcut with invalid action enum', async () => {
      await expect(
        service.create({ ...validShortcutData, action: 'INVALID_ACTION' as ShortcutAction })
      ).rejects.toThrow('Invalid action type');
    });

    it('should accept all valid action enums', async () => {
      const validActions = Object.values(ShortcutAction);
      
      for (const action of validActions) {
        const shortcut = await service.create({ ...validShortcutData, action });
        expect(shortcut.action).toBe(action);
        mockMMKV.set.mockClear();
      }
    });

    it('should reject shortcut with missing actionPayload for OPEN_APP', async () => {
      await expect(
        service.create({ ...validShortcutData, action: ShortcutAction.OPEN_APP, actionPayload: undefined })
      ).rejects.toThrow('actionPayload is required for OPEN_APP action');
    });

    it('should reject shortcut with missing packageName in actionPayload for OPEN_APP', async () => {
      await expect(
        service.create({ ...validShortcutData, action: ShortcutAction.OPEN_APP, actionPayload: {} })
      ).rejects.toThrow('packageName is required for OPEN_APP action');
    });

    it('should trim whitespace from name', async () => {
      const shortcut = await service.create({ ...validShortcutData, name: '  Trimmed Name  ' });
      expect(shortcut.name).toBe('Trimmed Name');
    });

    it('should normalize color to uppercase', async () => {
      const shortcut = await service.create({ ...validShortcutData, color: '#ff5733' });
      expect(shortcut.color).toBe('#FF5733');
    });
  });

  describe('getById', () => {
    it('should return the correct shortcut by id', async () => {
      const existingShortcut = createValidShortcut({ id: 'target-id', name: 'Target' });
      mockMMKV.getString.mockReturnValue(JSON.stringify([existingShortcut]));

      const newService = new ShortcutsService();
      const result = await newService.getById('target-id');

      expect(result).toEqual(existingShortcut);
    });

    it('should return null for non-existent id', async () => {
      const existingShortcut = createValidShortcut({ id: 'existing-id' });
      mockMMKV.getString.mockReturnValue(JSON.stringify([existingShortcut]));

      const newService = new ShortcutsService();
      const result = await newService.getById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return null when storage is empty', async () => {
      const result = await service.getById('any-id');
      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all shortcuts sorted by order', async () => {
      const shortcuts = [
        createValidShortcut({ id: '3', order: 2, name: 'Third' }),
        createValidShortcut({ id: '1', order: 0, name: 'First' }),
        createValidShortcut({ id: '2', order: 1, name: 'Second' }),
      ];
      mockMMKV.getString.mockReturnValue(JSON.stringify(shortcuts));

      const newService = new ShortcutsService();
      const result = await newService.getAll();

      expect(result).toHaveLength(3);
      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
      expect(result[2].order).toBe(2);
      expect(result.map(s => s.name)).toEqual(['First', 'Second', 'Third']);
    });

    it('should return empty array when storage is empty', async () => {
      const result = await service.getAll();
      expect(result).toEqual([]);
    });

    it('should return empty array when storage has invalid JSON', async () => {
      mockMMKV.getString.mockReturnValue('invalid json');
      const result = await service.getAll();
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update mutable fields and persist changes', async () => {
      const existingShortcut = createValidShortcut({ id: 'update-id', name: 'Original' });
      mockMMKV.getString.mockReturnValue(JSON.stringify([existingShortcut]));

      const newService = new ShortcutsService();
      const updated = await newService.update('update-id', { name: 'Updated', color: '#00FF00' });

      expect(updated.name).toBe('Updated');
      expect(updated.color).toBe('#00FF00');
      expect(updated.id).toBe('update-id');
      expect(updated.createdAt).toBe(existingShortcut.createdAt);
      expect(updated.updatedAt).toBeGreaterThan(existingShortcut.updatedAt);

      expect(mockMMKV.set).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('Updated')
      );
    });

    it('should preserve immutable fields (id, createdAt, order)', async () => {
      const existingShortcut = createValidShortcut({ 
        id: 'immutable-id', 
        order: 5, 
        createdAt: 1000 
      });
      mockMMKV.getString.mockReturnValue(JSON.stringify([existingShortcut]));

      const newService = new ShortcutsService();
      const updated = await newService.update('immutable-id', { 
        id: 'new-id', 
        order: 99, 
        createdAt: 2000 
      });

      expect(updated.id).toBe('immutable-id');
      expect(updated.order).toBe(5);
      expect(updated.createdAt).toBe(1000);
    });

    it('should reject update for non-existent shortcut', async () => {
      mockMMKV.getString.mockReturnValue(JSON.stringify([createValidShortcut()]));

      await expect(
        service.update('non-existent', { name: 'Test' })
      ).rejects.toThrow('Shortcut not found');
    });

    it('should validate name length on update', async () => {
      const existingShortcut = createValidShortcut({ id: 'validate-id' });
      mockMMKV.getString.mockReturnValue(JSON.stringify([existingShortcut]));

      const newService = new ShortcutsService();
      await expect(
        newService.update('validate-id', { name: 'a'.repeat(51) })
      ).rejects.toThrow('Shortcut name must be 50 characters or less');
    });

    it('should validate color format on update', async () => {
      const existingShortcut = createValidShortcut({ id: 'validate-id' });
      mockMMKV.getString.mockReturnValue(JSON.stringify([existingShortcut]));

      const newService = new ShortcutsService();
      await expect(
        newService.update('validate-id', { color: 'invalid' })
      ).rejects.toThrow('Invalid color format. Use #RRGGBB hex format');
    });

    it('should validate action enum on update', async () => {
      const existingShortcut = createValidShortcut({ id: 'validate-id' });
      mockMMKV.getString.mockReturnValue(JSON.stringify([existingShortcut]));

      const newService = new ShortcutsService();
      await expect(
        newService.update('validate-id', { action: 'INVALID' as ShortcutAction })
      ).rejects.toThrow('Invalid action type');
    });

    it('should update actionPayload for OPEN_APP', async () => {
      const existingShortcut = createValidShortcut({ 
        id: 'payload-id', 
        action: ShortcutAction.OPEN_APP,
        actionPayload: { packageName: 'com.old.app' }
      });
      mockMMKV.getString.mockReturnValue(JSON.stringify([existingShortcut]));

      const newService = new ShortcutsService();
      const updated = await newService.update('payload-id', { 
        actionPayload: { packageName: 'com.new.app' } 
      });

      expect(updated.actionPayload).toEqual({ packageName: 'com.new.app' });
    });
  });

  describe('delete', () => {
    it('should remove shortcut from storage', async () => {
      const shortcuts = [
        createValidShortcut({ id: '1', name: 'First' }),
        createValidShortcut({ id: '2', name: 'Second' }),
        createValidShortcut({ id: '3', name: 'Third' }),
      ];
      mockMMKV.getString.mockReturnValue(JSON.stringify(shortcuts));

      const newService = new ShortcutsService();
      await newService.delete('2');

      expect(mockMMKV.set).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('"id":"1"')
      );
      expect(mockMMKV.set).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('"id":"3"')
      );
      expect(mockMMKV.set).not.toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('"id":"2"')
      );
    });

    it('should reorder remaining shortcuts after deletion', async () => {
      const shortcuts = [
        createValidShortcut({ id: '1', order: 0 }),
        createValidShortcut({ id: '2', order: 1 }),
        createValidShortcut({ id: '3', order: 2 }),
      ];
      mockMMKV.getString.mockReturnValue(JSON.stringify(shortcuts));

      const newService = new ShortcutsService();
      await newService.delete('2');

      const savedData = JSON.parse(mockMMKV.set.mock.calls[0][1]);
      expect(savedData.find((s: Shortcut) => s.id === '1').order).toBe(0);
      expect(savedData.find((s: Shortcut) => s.id === '3').order).toBe(1);
    });

    it('should not throw when deleting non-existent shortcut', async () => {
      mockMMKV.getString.mockReturnValue(JSON.stringify([createValidShortcut()]));

      await expect(service.delete('non-existent')).resolves.toBeUndefined();
    });

    it('should handle deletion from empty storage', async () => {
      await expect(service.delete('any-id')).resolves.toBeUndefined();
    });
  });

  describe('reorder', () => {
    it('should update order field for multiple shortcuts', async () => {
      const shortcuts = [
        createValidShortcut({ id: '1', order: 0 }),
        createValidShortcut({ id: '2', order: 1 }),
        createValidShortcut({ id: '3', order: 2 }),
      ];
      mockMMKV.getString.mockReturnValue(JSON.stringify(shortcuts));

      const newService = new ShortcutsService();
      await newService.reorder([
        { id: '3', order: 0 },
        { id: '1', order: 1 },
        { id: '2', order: 2 },
      ]);

      const savedData = JSON.parse(mockMMKV.set.mock.calls[0][1]);
      expect(savedData.find((s: Shortcut) => s.id === '3').order).toBe(0);
      expect(savedData.find((s: Shortcut) => s.id === '1').order).toBe(1);
      expect(savedData.find((s: Shortcut) => s.id === '2').order).toBe(2);
    });

    it('should update updatedAt timestamp on reorder', async () => {
      const shortcuts = [
        createValidShortcut({ id: '1', order: 0, updatedAt: 1000 }),
        createValidShortcut({ id: '2', order: 1, updatedAt: 1000 }),
      ];
      mockMMKV.getString.mockReturnValue(JSON.stringify(shortcuts));

      const newService = new ShortcutsService();
      await newService.reorder([
        { id: '2', order: 0 },
        { id: '1', order: 1 },
      ]);

      const savedData = JSON.parse(mockMMKV.set.mock.calls[0][1]);
      expect(savedData.find((s: Shortcut) => s.id === '1').updatedAt).toBeGreaterThan(1000);
      expect(savedData.find((s: Shortcut) => s.id === '2').updatedAt).toBeGreaterThan(1000);
    });

    it('should ignore reorder for non-existent shortcuts', async () => {
      const shortcuts = [createValidShortcut({ id: '1', order: 0 })];
      mockMMKV.getString.mockReturnValue(JSON.stringify(shortcuts));

      const newService = new ShortcutsService();
      await newService.reorder([
        { id: '1', order: 0 },
        { id: 'non-existent