import { describe, it, expect } from 'vitest';
import { parseTemplate, extractTemplatePlaceholders, validateTemplatePlaceholders } from './template.utils';

describe('parseTemplate', () => {
  it('replaces simple variable', () => {
    expect(parseTemplate('Hello {firstName}!', { firstName: 'Mario' })).toBe('Hello Mario!');
  });

  it('replaces multiple variables', () => {
    expect(
      parseTemplate('Hello {firstName}, you have {points} points!', {
        firstName: 'Mario',
        points: 42,
      })
    ).toBe('Hello Mario, you have 42 points!');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(parseTemplate('Hello {firstName}!', {})).toBe('Hello {firstName}!');
  });

  it('handles empty template', () => {
    expect(parseTemplate('', { name: 'test' })).toBe('');
  });

  it('handles template without placeholders', () => {
    expect(parseTemplate('Hello World!', { name: 'test' })).toBe('Hello World!');
  });

  it('replaces numeric values', () => {
    expect(parseTemplate('Rank: {rank}', { rank: 1 })).toBe('Rank: 1');
  });

  it('replaces same placeholder multiple times', () => {
    expect(parseTemplate('{name} - {name}', { name: 'Mario' })).toBe('Mario - Mario');
  });
});

describe('extractTemplatePlaceholders', () => {
  it('extracts single placeholder', () => {
    expect(extractTemplatePlaceholders('Hello {firstName}!')).toEqual(['firstName']);
  });

  it('extracts multiple unique placeholders', () => {
    const result = extractTemplatePlaceholders('{name} has {points} points and {points} bonus');
    expect(result).toEqual(['name', 'points']);
  });

  it('returns empty array for no placeholders', () => {
    expect(extractTemplatePlaceholders('Hello World')).toEqual([]);
  });
});

describe('validateTemplatePlaceholders', () => {
  it('validates template with allowed keys', () => {
    const result = validateTemplatePlaceholders('Hello {firstName}!', ['firstName', 'lastName']);
    expect(result.valid).toBe(true);
    expect(result.unknownKeys).toEqual([]);
  });

  it('detects unknown keys', () => {
    const result = validateTemplatePlaceholders('Hello {firstName} {badKey}!', ['firstName']);
    expect(result.valid).toBe(false);
    expect(result.unknownKeys).toEqual(['badKey']);
  });
});
