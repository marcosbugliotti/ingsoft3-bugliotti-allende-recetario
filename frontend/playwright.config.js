import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',                // recoge los DOS archivos; cada job de §3.4 corre el suyo por nombre
  timeout: 60_000,                 // tope de CADA test: generoso para las e2e, de sobra para los pedidos a la api
  expect: { timeout: 15_000 },     // tope de CADA aserción: no lo hereda del de arriba (el default es 5 s)
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',   // el FRONT. La api tiene la suya: API_BASE_URL, que lee api.spec.js
    trace: 'on-first-retry',         // la traza se graba en el retry de un fallo (los verdes no la generan)
    screenshot: 'only-on-failure',   // screenshot standalone de cada fallo en el reporte
  },
  retries: 1,                      // 1 retry: absorbe una demora suelta; si un test pasa recién ahí, sale «flaky»
  reporter: [['html', { open: 'never' }], ['list']],
})
