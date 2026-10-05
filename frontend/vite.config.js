import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Proxy /api hacia el backend en desarrollo local (sin Docker).
// En produccion, ese mismo rol lo cumple nginx (ver frontend/nginx.conf).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, 'e2e/**'], // vitest NO toca los specs de Playwright (los DOS: el de api y el de navegador viven en e2e/)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/lib/**'],
      thresholds: { lines: 95, branches: 95, functions: 95 },
    },
  },
})
