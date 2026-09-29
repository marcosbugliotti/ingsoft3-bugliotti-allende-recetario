import { defineConfig } from 'vite'
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/lib/**'],
      thresholds: { lines: 95, branches: 95, functions: 95 },
    },
  },
})
