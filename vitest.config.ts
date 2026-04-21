import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      NODE_ENV: 'test',
    },
    include: ['src/tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
