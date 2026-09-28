import { describe, it, expect } from 'vitest';
import { startHost } from './main.js';

describe('NativeHost Main', () => {
  it('exports startHost function', () => {
    expect(typeof startHost).toBe('function');
  });
});
