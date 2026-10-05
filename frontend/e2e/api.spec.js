import { expect, test } from '@playwright/test'

// La api tiene su propia dirección: NO es la del front. Sin barra al final.
// Local (docker-compose.yml): el backend publica el 8888 en el host.
const API = process.env.API_BASE_URL || 'http://localhost:8888'

// Cada test registra su propio usuario, con email único: así los tests no
// comparten estado entre sí ni con otras corridas que usen el mismo QA.
async function registerAndLogin(request) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`
  const payload = { email, password: 'Test1234!', name: 'E2E Test' }

  const registro = await request.post(`${API}/api/auth/register`, { data: payload })
  expect(registro.status()).toBe(201)

  const login = await request.post(`${API}/api/auth/login`, {
    data: { email, password: payload.password },
  })
  expect(login.status()).toBe(200)
  const { access_token } = await login.json()
  return { email, token: access_token }
}

// Crea (o reusa, si ya existe) un ingrediente de prueba y devuelve su id.
async function ingredienteDePrueba(request, token) {
  const r = await request.post(`${API}/api/ingredients`, {
    data: { name: 'Harina', unit: 'g' },
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(r.status()).toBe(201)
  const ingrediente = await r.json()
  return ingrediente.id
}

async function misRecetas(request, token) {
  const r = await request.get(`${API}/api/recipes?mine=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(r.status()).toBe(200)
  return await r.json()
}

test('el alta guarda en la base de verdad, y el borrado la saca', async ({ request }) => {
  const { token } = await registerAndLogin(request)
  const ingredientId = await ingredienteDePrueba(request, token)
  const titulo = `api ${Date.now()}` // único: no choca con otra corrida

  const alta = await request.post(`${API}/api/recipes`, {
    data: {
      title: titulo,
      description: 'receta de prueba',
      servings_base: 4,
      prep_time_minutes: 10,
      ingredients: [{ ingredient_id: ingredientId, quantity_base: 200 }],
    },
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(alta.status()).toBe(201) // la api dice «creada»
  const creada = await alta.json()

  const antesDelBorrado = await misRecetas(request, token) // y la BASE la devuelve: no es un doble
  expect(antesDelBorrado.some((r) => r.title === titulo)).toBe(true)

  const borrado = await request.delete(`${API}/api/recipes/${creada.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(borrado.status()).toBe(204) // «borrada, no hay nada que devolver»

  const despuesDelBorrado = await misRecetas(request, token) // y el borrado, comprobado
  expect(despuesDelBorrado.some((r) => r.title === titulo)).toBe(false)
})

test('un título vacío lo rechaza la api, y no crea nada', async ({ request }) => {
  const { token } = await registerAndLogin(request)
  const antes = await misRecetas(request, token)

  const alta = await request.post(`${API}/api/recipes`, {
    data: {
      title: '',
      description: '',
      servings_base: 1,
      prep_time_minutes: 1,
      ingredients: [],
    },
    headers: { Authorization: `Bearer ${token}` },
  })
  // FastAPI + Pydantic: un campo que no cumple su validación (title con
  // min_length=1) da 422, no 400 — distinto del contrato .NET de la guía.
  expect(alta.status()).toBe(422)

  const despues = await misRecetas(request, token)
  expect(despues.length).toBe(antes.length) // y de verdad no se creó nada
})

test('una receta privada no la ve otro usuario: la api la trata como si no existiera', async ({
  request,
}) => {
  const dueño = await registerAndLogin(request)
  const otro = await registerAndLogin(request)
  const ingredientId = await ingredienteDePrueba(request, dueño.token)
  const titulo = `api-privada ${Date.now()}`

  const alta = await request.post(`${API}/api/recipes`, {
    data: {
      title: titulo,
      description: 'privada',
      servings_base: 2,
      prep_time_minutes: 5,
      ingredients: [{ ingredient_id: ingredientId, quantity_base: 50 }],
    },
    headers: { Authorization: `Bearer ${dueño.token}` },
  })
  expect(alta.status()).toBe(201)
  const creada = await alta.json()
  expect(creada.is_public).toBe(false) // nace privada

  // Regla de negocio: autorización de lectura — una receta privada no revela
  // ni siquiera su existencia a quien no es el dueño (404, no 403).
  const vistaPorOtro = await request.get(`${API}/api/recipes/${creada.id}`, {
    headers: { Authorization: `Bearer ${otro.token}` },
  })
  expect(vistaPorOtro.status()).toBe(404)

  // el dueño sí la sigue viendo
  const vistaPorDueño = await request.get(`${API}/api/recipes/${creada.id}`, {
    headers: { Authorization: `Bearer ${dueño.token}` },
  })
  expect(vistaPorDueño.status()).toBe(200)

  const borrado = await request.delete(`${API}/api/recipes/${creada.id}`, {
    headers: { Authorization: `Bearer ${dueño.token}` },
  })
  expect(borrado.status()).toBe(204)
})

test('otro usuario no puede borrar (ni editar) una receta que no es suya', async ({ request }) => {
  const dueño = await registerAndLogin(request)
  const otro = await registerAndLogin(request)
  const ingredientId = await ingredienteDePrueba(request, dueño.token)
  const titulo = `api-ajena ${Date.now()}`

  const alta = await request.post(`${API}/api/recipes`, {
    data: {
      title: titulo,
      description: '',
      servings_base: 2,
      prep_time_minutes: 5,
      ingredients: [{ ingredient_id: ingredientId, quantity_base: 50 }],
    },
    headers: { Authorization: `Bearer ${dueño.token}` },
  })
  expect(alta.status()).toBe(201)
  const creada = await alta.json()

  // Regla de negocio: autorización de ESCRITURA — distinta de la de lectura
  // (test anterior: 404, ni confirma que exista). Acá sí existe para "otro":
  // la api se lo confirma (403), porque intentar borrarla ya asume que sabe
  // el id. No es el mismo código ni la misma regla que la de lectura.
  const borradoAjeno = await request.delete(`${API}/api/recipes/${creada.id}`, {
    headers: { Authorization: `Bearer ${otro.token}` },
  })
  expect(borradoAjeno.status()).toBe(403)

  // y la receta sigue intacta: el intento de "otro" no tuvo efecto
  const sigueExistiendo = await request.get(`${API}/api/recipes/${creada.id}`, {
    headers: { Authorization: `Bearer ${dueño.token}` },
  })
  expect(sigueExistiendo.status()).toBe(200)

  const borrado = await request.delete(`${API}/api/recipes/${creada.id}`, {
    headers: { Authorization: `Bearer ${dueño.token}` },
  })
  expect(borrado.status()).toBe(204)
})

test('un ingrediente inexistente lo rechaza la api, y no crea nada', async ({ request }) => {
  const { token } = await registerAndLogin(request)
  const antes = await misRecetas(request, token)

  const alta = await request.post(`${API}/api/recipes`, {
    data: {
      title: `api-ingrediente-invalido ${Date.now()}`,
      description: '',
      servings_base: 1,
      prep_time_minutes: 1,
      ingredients: [{ ingredient_id: 999999999, quantity_base: 1 }], // no existe
    },
    headers: { Authorization: `Bearer ${token}` },
  })
  // Regla de negocio: integridad referencial — no es un error de formato
  // (eso sería 422), es la api comprobando contra la base que el ingrediente
  // exista antes de guardar la receta.
  expect(alta.status()).toBe(400)

  const despues = await misRecetas(request, token)
  expect(despues.length).toBe(antes.length) // y de verdad no se creó nada
})
