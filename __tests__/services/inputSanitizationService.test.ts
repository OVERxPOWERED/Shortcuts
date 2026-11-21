```typescript
import { InputSanitizationService } from '../../src/services/inputSanitizationService';
import { ValidationError } from '../../src/utils/validation';

// Mock the validation utilities
jest.mock('../../src/utils/validation', () => ({
  ValidationError: class ValidationError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  validateString: jest.fn((value: string, maxLength: number) => {
    if (typeof value !== 'string') {
      throw new ValidationError('Value must be a string', 'INVALID_TYPE');
    }
    if (value.length > maxLength) {
      throw new ValidationError(`String exceeds maximum length of ${maxLength}`, 'MAX_LENGTH_EXCEEDED');
    }
    return value;
  }),
  validateObject: jest.fn((value: object, maxDepth: number) => {
    if (value === null || typeof value !== 'object') {
      throw new ValidationError('Value must be an object', 'INVALID_TYPE');
    }
    return value;
  }),
}));

describe('InputSanitizationService', () => {
  let service: InputSanitizationService;

  beforeEach(() => {
    service = new InputSanitizationService();
    jest.clearAllMocks();
  });

  describe('sanitizeShortcutParams', () => {
    it('should pass through valid shortcut parameters', () => {
      const validParams = {
        action: 'sendMessage',
        recipient: 'John Doe',
        message: 'Hello, world!',
        timestamp: Date.now(),
      };

      const result = service.sanitizeShortcutParams(validParams);

      expect(result).toEqual(validParams);
    });

    it('should strip script tags from string values', () => {
      const maliciousParams = {
        action: 'sendMessage',
        message: '<script>alert("xss")</script>Hello',
        recipient: 'John <script>steal()</script> Doe',
      };

      const result = service.sanitizeShortcutParams(maliciousParams);

      expect(result.message).toBe('alert("xss")Hello');
      expect(result.recipient).toBe('John steal() Doe');
    });

    it('should strip event handler attributes', () => {
      const maliciousParams = {
        action: 'sendMessage',
        message: '<img src="x" onerror="steal()">',
        recipient: '<span onmouseover="steal()">hover</span>',
      };

      const result = service.sanitizeShortcutParams(maliciousParams);

      expect(result.message).toBe('<img src="x">');
      expect(result.recipient).toBe('<span>hover</span>');
    });

    it('should block SQL injection patterns', () => {
      const sqlInjectionParams = {
        action: 'query',
        query: "SELECT * FROM users WHERE id = 1; DROP TABLE users; --",
        filter: "1' OR '1'='1",
      };

      const result = service.sanitizeShortcutParams(sqlInjectionParams);

      expect(result.query).not.toContain('DROP TABLE');
      expect(result.query).not.toContain('--');
      expect(result.filter).not.toContain("' OR '1'='1");
    });

    it('should reject oversized payloads', () => {
      const oversizedParams = {
        action: 'sendMessage',
        message: 'x'.repeat(10001), // Exceeds default 10000 char limit
      };

      expect(() => service.sanitizeShortcutParams(oversizedParams)).toThrow(ValidationError);
      expect(() => service.sanitizeShortcutParams(oversizedParams)).toThrow('MAX_LENGTH_EXCEEDED');
    });

    it('should handle null and undefined values gracefully', () => {
      const paramsWithNulls = {
        action: 'sendMessage',
        message: 'Hello',
        optionalField: null,
        anotherField: undefined,
      };

      const result = service.sanitizeShortcutParams(paramsWithNulls);

      expect(result.message).toBe('Hello');
      expect(result.optionalField).toBeNull();
      expect(result.anotherField).toBeUndefined();
    });

    it('should preserve unicode characters', () => {
      const unicodeParams = {
        action: 'sendMessage',
        message: 'Hello 世界 🌍 Привет мир 🎉',
        recipient: 'José María',
      };

      const result = service.sanitizeShortcutParams(unicodeParams);

      expect(result.message).toBe('Hello 世界 🌍 Привет мир 🎉');
      expect(result.recipient).toBe('José María');
    });

    it('should sanitize nested objects recursively', () => {
      const nestedParams = {
        action: 'complexAction',
        data: {
          user: {
            name: '<script>alert(1)</script>John',
            preferences: {
              theme: 'dark',
              notifications: '<img onerror="xss()">enabled',
            },
          },
          metadata: {
            tags: ['<b>tag1</b>', 'tag2'],
            source: 'web',
          },
        },
      };

      const result = service.sanitizeShortcutParams(nestedParams);

      expect(result.data.user.name).toBe('alert(1)John');
      expect(result.data.user.preferences.notifications).toBe('<img>enabled');
      expect(result.data.metadata.tags[0]).toBe('<b>tag1</b>');
      expect(result.data.metadata.tags[1]).toBe('tag2');
    });

    it('should sanitize arrays of strings', () => {
      const paramsWithArray = {
        action: 'batchAction',
        items: [
          '<script>alert(1)</script>Item 1',
          'Item 2',
          '<img onerror="xss()">Item 3',
        ],
      };

      const result = service.sanitizeShortcutParams(paramsWithArray);

      expect(result.items[0]).toBe('alert(1)Item 1');
      expect(result.items[1]).toBe('Item 2');
      expect(result.items[2]).toBe('<img>Item 3');
    });

    it('should handle empty objects and arrays', () => {
      const params = {
        action: 'test',
        emptyObject: {},
        emptyArray: [],
        nestedEmpty: { inner: {} },
      };

      const result = service.sanitizeShortcutParams(params);

      expect(result.emptyObject).toEqual({});
      expect(result.emptyArray).toEqual([]);
      expect(result.nestedEmpty.inner).toEqual({});
    });

    it('should strip javascript: protocol handlers', () => {
      const params = {
        action: 'navigate',
        url: 'javascript:alert("xss")',
        link: '<a href="javascript:steal()">Click</a>',
      };

      const result = service.sanitizeShortcutParams(params);

      expect(result.url).toBe('alert("xss")');
      expect(result.link).toBe('<a href="">Click</a>');
    });

    it('should handle deeply nested structures within depth limit', () => {
      const deepObject: Record<string, unknown> = { level: 0 };
      let current: Record<string, unknown> = deepObject;
      
      for (let i = 1; i <= 10;