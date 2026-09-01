import { describe, it, expect } from 'vitest';
// const { describe, it, expect } = require('vitest');
const { isValidSessionName } = require('../../src/validators/sessionName');

describe('isValidSessionName', () => {
  it('V1: accepts a valid session name', () => {
    expect(isValidSessionName('Q3 Onboarding Training')).toBe(true);
  });

  it('V2: rejects a name below the minimum length', () => {
    expect(isValidSessionName('A')).toBe(false);
  });

  it('V3: rejects an empty string', () => {
    expect(isValidSessionName('')).toBe(false);
  });

  it('V4: rejects whitespace-only names', () => {
    expect(isValidSessionName('   ')).toBe(false);
  });

  it('V5: rejects a name longer than 200 characters', () => {
    const name = 'A'.repeat(201);

    expect(isValidSessionName(name)).toBe(false);
  });

  it('V6: accepts a name exactly 200 characters long', () => {
    const name = 'A'.repeat(200);

    expect(isValidSessionName(name)).toBe(true);
  });

  it('V7: rejects null', () => {
    expect(isValidSessionName(null)).toBe(false);
  });

  it('V8: rejects undefined', () => {
    expect(isValidSessionName(undefined)).toBe(false);
  });

  it('V9: rejects non-string values', () => {
    expect(isValidSessionName(123)).toBe(false);
  });

  it('V10: accepts names with surrounding whitespace', () => {
    expect(isValidSessionName('  Team Sync  ')).toBe(true);
  });
});

module.exports = {
  isValidSessionName
};