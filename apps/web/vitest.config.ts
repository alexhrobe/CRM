import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Testes rodam sempre em modo demo (client em memória, determinístico, sem
    // rede) — independente de um .env.local com credenciais reais.
    env: { VITE_DEMO: '1' },
  },
})
