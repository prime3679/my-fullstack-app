import {
  sanitizeInput,
  validatePasswordStrength,
  validateJWT,
  escapeSQLString,
} from './security';

describe('Security Utilities', () => {
  describe('sanitizeInput', () => {
    it('should sanitize HTML entities in strings', () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizeInput(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    });

    it('should remove null bytes from strings', () => {
      const input = 'hello\0world';
      const result = sanitizeInput(input);
      expect(result).toBe('helloworld');
    });

    it('should trim whitespace from strings', () => {
      const input = '  hello world  ';
      const result = sanitizeInput(input);
      expect(result).toBe('hello world');
    });

    it('should sanitize nested objects', () => {
      const input = {
        name: '<script>alert(1)</script>',
        nested: {
          value: 'test\0value',
        },
      };
      const result = sanitizeInput(input);
      expect(result.name).toBe('&lt;script&gt;alert(1)&lt;&#x2F;script&gt;');
      expect(result.nested.value).toBe('testvalue');
    });

    it('should sanitize arrays', () => {
      const input = ['<script>', 'normal', '\0null'];
      const result = sanitizeInput(input);
      expect(result[0]).toBe('&lt;script&gt;');
      expect(result[1]).toBe('normal');
      expect(result[2]).toBe('null');
    });

    it('should handle non-string types', () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(true)).toBe(true);
      expect(sanitizeInput(null)).toBe(null);
      expect(sanitizeInput(undefined)).toBe(undefined);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate a strong password', () => {
      const result = validatePasswordStrength('StrongP@ss123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject passwords shorter than 8 characters', () => {
      const result = validatePasswordStrength('Short1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should require uppercase letters', () => {
      const result = validatePasswordStrength('lowercase123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase letters', () => {
      const result = validatePasswordStrength('UPPERCASE123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require numbers', () => {
      const result = validatePasswordStrength('NoNumbers!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should require special characters', () => {
      const result = validatePasswordStrength('NoSpecial123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should return all validation errors', () => {
      const result = validatePasswordStrength('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });

  describe('validateJWT', () => {
    it('should validate a properly formatted JWT', () => {
      const validJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      expect(validateJWT(validJWT)).toBe(true);
    });

    it('should reject JWT with incorrect number of parts', () => {
      expect(validateJWT('not.a.jwt')).toBe(true);
      expect(validateJWT('only.two')).toBe(false);
      expect(validateJWT('one')).toBe(false);
      expect(validateJWT('too.many.parts.here')).toBe(false);
    });

    it('should reject JWT with invalid characters', () => {
      const invalidJWT = 'eyJ@invalid.eyJ@invalid.sig@invalid';
      expect(validateJWT(invalidJWT)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(validateJWT('')).toBe(false);
    });
  });

  describe('escapeSQLString', () => {
    it('should escape single quotes', () => {
      const input = "O'Reilly";
      const result = escapeSQLString(input);
      expect(result).toBe("O\\'Reilly");
    });

    it('should escape double quotes', () => {
      const input = 'He said "Hello"';
      const result = escapeSQLString(input);
      expect(result).toBe('He said \\"Hello\\"');
    });

    it('should escape backslashes', () => {
      const input = 'C:\\Users\\Admin';
      const result = escapeSQLString(input);
      expect(result).toBe('C:\\\\Users\\\\Admin');
    });

    it('should escape null bytes', () => {
      const input = 'hello\0world';
      const result = escapeSQLString(input);
      expect(result).toBe('hello\\0world');
    });

    it('should escape newlines and carriage returns', () => {
      const input = 'line1\nline2\rline3';
      const result = escapeSQLString(input);
      expect(result).toBe('line1\\nline2\\rline3');
    });

    it('should escape percent signs', () => {
      const input = '100% complete';
      const result = escapeSQLString(input);
      expect(result).toBe('100\\% complete');
    });

    it('should handle multiple special characters', () => {
      const input = "'; DROP TABLE users; --";
      const result = escapeSQLString(input);
      expect(result).toBe("\\'; DROP TABLE users; --");
    });
  });
});