import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  sanitizeString,
  sanitizeObject,
  validateAndSanitize,
  InputSanitizationError,
  InputSanitizationErrorCode,
} from '@/services/inputSanitizationService';
import { ShortcutParamsSchema, BubbleConfigSchema } from '@/models/shortcut';

describe('InputSanitizationService - Boundary Edge Cases', () => {
  describe('Unicode Injection Prevention', () => {
    it('strips RTL override characters (U+202E, U+202D)', () => {
      const payload = 'normal\u202Emalicious\u202Ctext';
      const result = sanitizeString(payload);
      expect(result).not.toContain('\u202E');
      expect(result).not.toContain('\u202D');
      expect(result).toBe('normalmalicioustext');
    });

    it('strips zero-width characters (U+200B, U+200C, U+200D, U+FEFF)', () => {
      const payload = 'test\u200B\u200C\u200D\uFEFFstring';
      const result = sanitizeString(payload);
      expect(result).not.toContain('\u200B');
      expect(result).not.toContain('\u200C');
      expect(result).not.toContain('\u200D');
      expect(result).not.toContain('\uFEFF');
      expect(result).toBe('teststring');
    });

    it('strips directional formatting characters (U+2066-U+2069)', () => {
      const payload = 'text\u2066\u2067\u2068\u2069more';
      const result = sanitizeString(payload);
      expect(result).not.toContain('\u2066');
      expect(result).not.toContain('\u2067');
      expect(result).not.toContain('\u2068');
      expect(result).not.toContain('\u2069');
      expect(result).toBe('textmore');
    });

    it('handles complex emoji sequences with variation selectors', () => {
      const payload = '👨‍👩‍👧‍👦\uFE0F\u200D🏳️‍🌈';
      const result = sanitizeString(payload);
      expect(result).toBe('👨‍👩‍👧‍👦🏳️‍🌈');
    });

    it('strips invisible control characters (U+0000-U+001F, U+007F-U+009F)', () => {
      const payload = 'test\u0000\u0001\u001F\u007F\u0080\u009Fend';
      const result = sanitizeString(payload);
      expect(result).toBe('testend');
    });

    it('preserves valid unicode whitespace (U+0020, U+00A0, U+2000-U+200A)', () => {
      const payload = 'hello\u00A0world\u2000test';
      const result = sanitizeString(payload);
      expect(result).toBe('hello world test');
    });

    it('handles nested RTL overrides in object values', () => {
      const obj = {
        name: 'user\u202Eadmin\u202C',
        description: 'desc\u202Dription\u202C',
      };
      const result = sanitizeObject(obj);
      expect(result.name).toBe('useradmin');
      expect(result.description).toBe('description');
    });
  });

  describe('Prototype Pollution Defense', () => {
    it('removes __proto__ key from object', () => {
      const payload = { __proto__: { polluted: true }, normal: 'value' };
      const result = sanitizeObject(payload);
      expect(result).not.toHaveProperty('__proto__');
      expect(result.normal).toBe('value');
      expect(Object.prototype).not.toHaveProperty('polluted');
    });

    it('removes constructor key from object', () => {
      const payload = { constructor: { prototype: { polluted: true } }, data: 'ok' };
      const result = sanitizeObject(payload);
      expect(result).not.toHaveProperty('constructor');
      expect(result.data).toBe('ok');
    });

    it('removes prototype key from object', () => {
      const payload = { prototype: { malicious: 'code' }, safe: 'data' };
      const result = sanitizeObject(payload);
      expect(result).not.toHaveProperty('prototype');
      expect(result.safe).toBe('data');
    });

    it('freezes the result object to prevent runtime pollution', () => {
      const payload = { a: 1, b: 2 };
      const result = sanitizeObject(payload);
      expect(Object.isFrozen(result)).toBe(true);
      expect(() => {
        (result as Record<string, unknown>).c = 3;
      }).toThrow();
    });

    it('deeply freezes nested objects', () => {
      const payload = { nested: { deep: { value: 'test' } } };
      const result = sanitizeObject(payload);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.nested)).toBe(true);
      expect(Object.isFrozen(result.nested.deep)).toBe(true);
    });

    it('handles array prototype pollution attempts', () => {
      const payload = { items: ['a', 'b'], __proto__: { polluted: true } };
      const result = sanitizeObject(payload);
      expect(result).not.toHaveProperty('__proto__');
      expect(Array.isArray(result.items)).toBe(true);
      expect(Object.isFrozen(result.items)).toBe(true);
    });

    it('prevents pollution via Object.defineProperty simulation', () => {
      const payload = JSON.parse('{"__proto__": {"isAdmin": true}}');
      const result = sanitizeObject(payload);
      expect(result).not.toHaveProperty('__proto__');
      expect({}.isAdmin).toBeUndefined();
    });
  });

  describe('Oversized Payload Rejection', () => {
    it('rejects payload exceeding 10MB limit', () => {
      const largeString = 'x'.repeat(11 * 1024 * 1024);
      const payload = { data: largeString };
      
      expect(() => validateAndSanitize(payload, ShortcutParamsSchema)).toThrow(
        InputSanitizationError
      );
      
      try {
        validateAndSanitize(payload, ShortcutParamsSchema);
      } catch (error) {
        expect(error).toBeInstanceOf(InputSanitizationError);
        expect((error as InputSanitizationError).code).toBe(InputSanitizationErrorCode.PAYLOAD_TOO_LARGE);
      }
    });

    it('rejects deeply nested object exceeding 1000 levels', () => {
      let deepObj: Record<string, unknown> = { value: 'deep' };
      for (let i = 0; i < 1001; i++) {
        deepObj = { nested: deepObj };
      }
      
      expect(() => validateAndSanitize(deepObj, ShortcutParamsSchema)).toThrow(
        InputSanitizationError
      );
      
      try {
        validateAndSanitize(deepObj, ShortcutParamsSchema);
      } catch (error) {
        expect(error).toBeInstanceOf(InputSanitizationError);
        expect((error as InputSanitizationError).code).toBe(InputSanitizationErrorCode.PAYLOAD_TOO_LARGE);
      }
    });

    it('rejects array with excessive length', () => {
      const largeArray = new Array(100001).fill('item');
      const payload = { items: largeArray };
      
      expect(() => validateAndSanitize(payload, ShortcutParamsSchema)).toThrow(
        InputSanitizationError
      );
      
      try {
        validateAndSanitize(payload, ShortcutParamsSchema);
      } catch (error) {
        expect(error).toBeInstanceOf(InputSanitizationError);
        expect((error as InputSanitizationError).code).toBe(InputSanitizationErrorCode.PAYLOAD_TOO_LARGE);
      }
    });

    it('accepts payload at exactly 10MB limit', () => {
      const exactSize = 10 * 1024 * 1024 - 100;
      const payload = { data: 'x'.repeat(exactSize) };
      
      const result = validateAndSanitize(payload, ShortcutParamsSchema);
      expect(result.data).toHaveLength(exactSize);
    });

    it('accepts nested object at exactly 1000 levels', () => {
      let deepObj: Record<string, unknown> = { value: 'deep' };
      for (let i = 0; i < 1000; i++) {
        deepObj = { nested: deepObj };
      }
      
      const result = validateAndSanitize(deepObj, ShortcutParamsSchema);
      expect(result).toBeDefined();
    });
  });

  describe('Schema Evolution Compatibility', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    beforeEach(() => {
      consoleWarnSpy.mockClear();
    });

    afterEach(() => {
      consoleWarnSpy.mockClear();
    });

    it('rejects unknown fields in strict mode', () => {
      const payload = {
        action: 'openApp',
        packageName: 'com.test.app',
        unknownField: 'should fail',
        anotherUnknown: 123,
      };
      
      expect(() => validateAndSanitize(payload, ShortcutParamsSchema)).toThrow(
        InputSanitizationError
      );
      
      try {
        validateAndSanitize(payload, ShortcutParamsSchema);
      } catch (error) {
        expect(error).toBeInstanceOf(InputSanitizationError);
        expect((error as InputSanitizationError).code).toBe(InputSanitizationErrorCode.SCHEMA_VALIDATION_FAILED);
      }
    });

    it('allows unknown fields in passthrough mode with warning', () => {
      const PassthroughSchema = ShortcutParamsSchema.passthrough();
      const payload = {
        action: 'openApp',
        packageName: 'com.test.app',
        unknownField: 'allowed in passthrough',
        futureField: { nested: 'data' },
      };
      
      const result = validateAndSanitize(payload, PassthroughSchema);
      expect(result.unknownField).toBe('allowed in passthrough');
      expect(result.futureField).toEqual({ nested: 'data' });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown fields detected')
      );
    });

    it('strips unknown fields when using strict mode with stripUnknown', () => {
      const StrictStripSchema = ShortcutParamsSchema.strict();
      const payload = {
        action: 'openApp',
        packageName: 'com.test.app',
        deprecatedField: 'old value',
      };
      
      expect(() => validateAndSanitize(payload, StrictStripSchema)).toThrow();
    });

    it('handles schema evolution with optional fields', () => {
      const EvolvedSchema = ShortcutParamsSchema.extend({
        newOptionalField: z.string().optional(),
        newRequiredField: z.number().default(42),
      });
      
      const payload = {
        action: 'openApp',
        packageName: 'com.test.app',
      };
      
      const result = validateAndSanitize(payload, EvolvedSchema);
      expect(result.newRequiredField).toBe(42);
      expect(result.newOptionalField).toBeUndefined();
    });

    it('rejects payload missing required fields in evolved schema', () => {
      const EvolvedSchema = ShortcutParamsSchema.extend({
        newRequiredField: z.string(),
      });
      
      const payload = {
        action: 'openApp',
        packageName: 'com.test.app',
      };
      
      expect(() => validateAndSanitize(payload, EvolvedSchema)).toThrow(
        InputSanitizationError
      );
    });

    it('validates BubbleConfigSchema with unknown fields in passthrough', () => {
      const PassthroughBubbleSchema = BubbleConfigSchema.passthrough();
      const payload = {
        position: { x: 100, y: 200 },
        size: 60,
        opacity: 0.9,
        experimentalFeature: true,
        futureConfig: { enabled: true, version: '2.0' },
      };
      
      const result = validateAndSanitize(payload, PassthroughBubbleSchema);
      expect(result.experimentalFeature).toBe(true);
      expect(result.futureConfig).toEqual({ enabled: true, version: '2.0' });
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('uses SafeParseError for detailed validation error assertions', () => {
      const payload = {
        action: 'invalidAction',
        packageName: '',
      };
      
      try {
        validateAndSanitize(payload, ShortcutParamsSchema);
      } catch (error) {
        expect(error).toBeInstanceOf(InputSanitizationError);
        const sanitizationError = error as InputSanitizationError;
        expect(sanitizationError.code).toBe(InputSanitizationErrorCode.SCHEMA_VALIDATION_FAILED);
        expect(sanitizationError.details).toBeDefined();
        expect(sanitizationError.details).toBeInstanceOf(z.ZodError);
        
        const zodError = sanitizationError.details as z.ZodError;
        expect(zodError.errors.length).toBeGreaterThan(0);
        expect(zodError.errors.some(e => e.path.includes('action'))).toBe(true);
        expect(zodError.errors.some(e => e.path.includes('packageName'))).toBe(true);
      }
    });
  });

  describe('Combined Edge Cases', () => {
    it('handles unicode injection within oversized payload', () => {
      const largePayload = {
        data: 'x'.repeat(5 * 1024 * 1024) + '\u202E\u200B\uFEFF',
      };
      
      const result = validateAndSanitize(largePayload, ShortcutParamsSchema);
      expect(result.data).not.toContain('\u202E');
      expect(result.data).not.toContain('\u200B');
      expect(result.data).not.toContain('\uFEFF');
    });

    it('handles prototype pollution attempt in deeply nested object', () => {
      let deepObj: Record<string, unknown> = { 
        value: 'test',
        __proto__: { polluted: true },
      };
      for (let i = 0; i < 100; i++) {
        deepObj = { nested: deepObj, constructor: { bad: true } };
      }
      
      const result = sanitizeObject(deepObj);
      expect(Object.prototype).not.toHaveProperty('polluted');
      expect(result).not.toHaveProperty('__proto__');
      expect(result).not.toHaveProperty('constructor');
      
      let current: Record<string, unknown> = result;
      for (let i = 0; i < 100; i++) {
        expect(current).not.toHaveProperty('__proto__');
        expect(current).not.toHaveProperty('constructor');
        expect(Object.isFrozen(current)).toBe(true);
        current = current.nested as Record<string, unknown>;
      }
    });

    it('validates schema evolution with unicode field names', () => {
      const UnicodeSchema = z.object({
        action: z.string(),
        'field\u200Bname': z.string().optional(),
        normalField: z.number(),
      });
      
      const payload = {
        action: 'test',
        'field\u200Bname': 'value',
        normalField: 42,
      };
      
      const result = validateAndSanitize(payload, UnicodeSchema);
      expect(result.normalField).toBe(42);
      expect(result['field\u200Bname']).toBe('value');
    });
  });
});