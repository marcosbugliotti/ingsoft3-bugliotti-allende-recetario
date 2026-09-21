import { describe, expect, it, vi } from 'vitest'
import {
  buildRecipePayload,
  canPublishRecipe,
  resolveIngredientId,
  scaleIngredients,
} from './recipes.js'

const fila = (cambios = {}) => ({ name: 'Harina', unit: 'g', quantity_base: '200', ...cambios })

describe('scaleIngredients', () => {
  it.each([
    ['mismas porciones: no escala', 4, 4, 200, 200],
    ['el doble de porciones: el doble de cantidad', 4, 8, 200, 400],
    ['la mitad de porciones: la mitad de cantidad', 4, 2, 200, 100],
    ['no exacto: redondea a 2 decimales', 3, 1, 100, 33.33],
  ])('%s', (_caso, porcionesBase, porcionesPedidas, cantidadBase, esperada) => {
    const [resultado] = scaleIngredients([{ quantity_base: cantidadBase }], porcionesBase, porcionesPedidas)

    expect(resultado.quantity_scaled).toBe(esperada)
  })
})

describe('canPublishRecipe', () => {
  it('acepta una receta con título, tiempo e ingrediente válidos', () => {
    const form = { title: 'Tarta', prepTime: 30, rows: [fila()] }

    expect(canPublishRecipe(form)).toBe(true)
  })

  it.each([
    ['título vacío', { title: '', prepTime: 30, rows: [fila()] }],
    ['título de solo espacios', { title: '   ', prepTime: 30, rows: [fila()] }],
    ['tiempo de preparación en 0', { title: 'Tarta', prepTime: 0, rows: [fila()] }],
    ['sin ingredientes', { title: 'Tarta', prepTime: 30, rows: [] }],
    ['ingrediente sin nombre', { title: 'Tarta', prepTime: 30, rows: [fila({ name: '  ' })] }],
    ['ingrediente con cantidad 0', { title: 'Tarta', prepTime: 30, rows: [fila({ quantity_base: '0' })] }],
  ])('la rechaza con %s', (_caso, form) => {
    expect(canPublishRecipe(form)).toBe(false)
  })
})

describe('resolveIngredientId', () => {
  it('crea el ingrediente nuevo con el nombre recortado y la unidad "u" por defecto', async () => {
    const api = { createIngredient: vi.fn().mockResolvedValue({ id: 7 }) }

    const id = await resolveIngredientId({ name: '  Sal ', unit: '   ', quantity_base: '1' }, api, 'tok')

    expect(id).toBe(7)
    expect(api.createIngredient).toHaveBeenCalledWith({ name: 'Sal', unit: 'u' }, 'tok')
  })

  it('reutiliza un ingrediente existente sin llamar a la API', async () => {
    const api = { createIngredient: vi.fn() }

    const id = await resolveIngredientId({ ingredientId: 3, name: 'Harina', unit: 'g' }, api, 'tok')

    expect(id).toBe(3)
    expect(api.createIngredient).not.toHaveBeenCalled()
  })
})

describe('buildRecipePayload', () => {
  it('arma el payload: recorta el título, convierte a número y descarta las filas inválidas', async () => {
    const api = { createIngredient: vi.fn().mockResolvedValue({ id: 9 }) }
    const rows = [
      { ingredientId: 1, name: 'Harina', unit: 'g', quantity_base: '200' },
      { name: 'Sal', unit: 'g', quantity_base: '5' },
      { name: '', unit: 'g', quantity_base: '10' },
      { name: 'Agua', unit: 'ml', quantity_base: '0' },
    ]

    const payload = await buildRecipePayload(
      { title: '  Tarta ', description: 'rica', servingsBase: '4', prepTime: '30', rows },
      api,
      'tok',
    )

    expect(payload).toEqual({
      title: 'Tarta',
      description: 'rica',
      servings_base: 4,
      prep_time_minutes: 30,
      ingredients: [
        { ingredient_id: 1, quantity_base: 200 },
        { ingredient_id: 9, quantity_base: 5 },
      ],
    })
    expect(api.createIngredient).toHaveBeenCalledTimes(1)
  })

  it('propaga el error de la API para que la pantalla lo pueda mostrar', async () => {
    const api = { createIngredient: vi.fn().mockRejectedValue(new Error('Error 500')) }
    const rows = [{ name: 'Sal', unit: 'g', quantity_base: '5' }]

    await expect(
      buildRecipePayload({ title: 'Tarta', description: '', servingsBase: 2, prepTime: 10, rows }, api, 'tok'),
    ).rejects.toThrow('Error 500')
  })
})
