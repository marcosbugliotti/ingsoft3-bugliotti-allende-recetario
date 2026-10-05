const BASE_URL = '/api'

// El "detail" de un error de FastAPI es un string (las excepciones que
// lanza nuestro código) o, en un error de validación de Pydantic, una
// lista de {loc, msg, ...} — una por campo inválido.
function mensajeDeError(detail, status) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const campo = item.loc?.at(-1) // último elemento de loc: el nombre del campo
        return campo ? `${campo}: ${item.msg}` : item.msg
      })
      .join(', ')
  }
  return `Error ${status}`
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(mensajeDeError(data?.detail, res.status))
  }

  return data
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),

  listRecipes: (params, token) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/recipes${qs ? `?${qs}` : ''}`, { token })
  },
  getRecipe: (id, servings, token) => {
    const qs = servings ? `?servings=${servings}` : ''
    return request(`/recipes/${id}${qs}`, { token })
  },
  createRecipe: (payload, token) => request('/recipes', { method: 'POST', body: payload, token }),
  updateRecipe: (id, payload, token) =>
    request(`/recipes/${id}`, { method: 'PUT', body: payload, token }),
  deleteRecipe: (id, token) => request(`/recipes/${id}`, { method: 'DELETE', token }),
  publishRecipe: (id, token) => request(`/recipes/${id}/publish`, { method: 'PATCH', token }),

  listIngredients: (search) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : ''
    return request(`/ingredients${qs}`)
  },
  createIngredient: (payload, token) =>
    request('/ingredients', { method: 'POST', body: payload, token }),
}
