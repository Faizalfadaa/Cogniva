import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Pure helpers only for now: no DOM, so no jsdom dependency to carry.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
