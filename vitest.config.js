import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    // The app's components import src/index.css; component tests (added later)
    // run under jsdom via a per-file // @vitest-environment jsdom pragma.
  },
});
