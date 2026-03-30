import { describe, it, expect } from 'vitest';
import { normalizeDomusbetUsername, isValidDomusbetUsername } from './username.utils';

describe('normalizeDomusbetUsername', () => {
  it('trims whitespace', () => {
    expect(normalizeDomusbetUsername('  mario123  ')).toBe('mario123');
  });

  it('removes leading @', () => {
    expect(normalizeDomusbetUsername('@mario123')).toBe('mario123');
  });

  it('converts to lowercase', () => {
    expect(normalizeDomusbetUsername('Mario123')).toBe('mario123');
  });

  it('handles combination: spaces + @ + uppercase', () => {
    expect(normalizeDomusbetUsername('  @Mario123  ')).toBe('mario123');
  });

  it('removes internal whitespace', () => {
    expect(normalizeDomusbetUsername('mario 123')).toBe('mario123');
  });

  it('throws on empty string', () => {
    expect(() => normalizeDomusbetUsername('')).toThrow();
  });

  it('throws on non-string', () => {
    expect(() => normalizeDomusbetUsername(null as unknown as string)).toThrow();
  });

  it('handles already normalized username', () => {
    expect(normalizeDomusbetUsername('mario123')).toBe('mario123');
  });
});

describe('isValidDomusbetUsername', () => {
  it('accepts valid username', () => {
    expect(isValidDomusbetUsername('mario123')).toBe(true);
  });

  it('accepts username with dots and underscores', () => {
    expect(isValidDomusbetUsername('mario_123')).toBe(true);
    expect(isValidDomusbetUsername('mario.123')).toBe(true);
  });

  it('rejects too short username', () => {
    expect(isValidDomusbetUsername('ab')).toBe(false);
  });

  it('rejects too long username', () => {
    expect(isValidDomusbetUsername('a'.repeat(33))).toBe(false);
  });

  it('accepts username with @ prefix (normalized)', () => {
    expect(isValidDomusbetUsername('@mario123')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidDomusbetUsername('')).toBe(false);
  });
});
