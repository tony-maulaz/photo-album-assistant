import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Les tests sur photos réelles décodent des JPEG de 12 Mpx en JavaScript.
    testTimeout: 120_000,
  },
});
