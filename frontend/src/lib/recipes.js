// Mismo cálculo que hace el backend (app/routers/recipes.py::_build_recipe_out):
// cantidad_escalada = cantidad_base * porciones_deseadas / porciones_base.
export function scaleIngredients(ingredients, servingsBase, servingsRequested) {
  const factor = servingsRequested / servingsBase
  return ingredients.map((i) => ({
    ...i,
    quantity_scaled: Math.round(i.quantity_base * factor * 100) / 100,
  }))
}

export function canPublishRecipe({ title, prepTime, rows }) {
  return (
    title.trim().length > 0 &&
    Number(prepTime) > 0 &&
    rows.some((r) => r.name.trim() && Number(r.quantity_base) > 0)
  )
}

export async function resolveIngredientId(row, api, token) {
  if (row.ingredientId) return row.ingredientId
  const created = await api.createIngredient(
    { name: row.name.trim(), unit: row.unit.trim() || 'u' },
    token,
  )
  return created.id
}

export async function buildRecipePayload(
  { title, description, servingsBase, prepTime, rows },
  api,
  token,
) {
  const validRows = rows.filter((r) => r.name.trim() && Number(r.quantity_base) > 0)
  const ingredients = []
  for (const row of validRows) {
    const ingredient_id = await resolveIngredientId(row, api, token)
    ingredients.push({ ingredient_id, quantity_base: Number(row.quantity_base) })
  }
  return {
    title: title.trim(),
    description,
    servings_base: Number(servingsBase),
    prep_time_minutes: Number(prepTime),
    ingredients,
  }
}
