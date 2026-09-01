import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

function emptyRow() {
  return { key: Math.random().toString(36).slice(2), name: '', unit: '', quantity_base: '' }
}

export default function RecipeDetailPage({ mode }) {
  const isNew = mode === 'new'
  const { id } = useParams()
  const { token } = useAuth()
  const navigate = useNavigate()

  const [recipe, setRecipe] = useState(null)
  const [editing, setEditing] = useState(isNew)
  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [servingsBase, setServingsBase] = useState(2)
  const [prepTime, setPrepTime] = useState(0)
  const [rows, setRows] = useState([emptyRow()])

  const [servingsRequested, setServingsRequested] = useState(2)
  const [checked, setChecked] = useState({})

  const isOwner = recipe?.is_owner ?? isNew

  useEffect(() => {
    if (isNew) return
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .getRecipe(id, undefined, token)
      .then((data) => {
        if (cancelled) return
        setRecipe(data)
        setServingsRequested(data.servings_requested)
        setTitle(data.title)
        setDescription(data.description)
        setServingsBase(data.servings_base)
        setPrepTime(data.prep_time_minutes)
        setRows(
          data.ingredients.map((i) => ({
            key: String(i.ingredient.id),
            ingredientId: i.ingredient.id,
            name: i.ingredient.name,
            unit: i.ingredient.unit,
            quantity_base: i.quantity_base,
          })),
        )
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id, isNew, token])

  // Mismo cálculo que hace el backend (app/routers/recipes.py::_build_recipe_out):
  // cantidad_escalada = cantidad_base * porciones_deseadas / porciones_base.
  const scaledIngredients = useMemo(() => {
    if (!recipe) return []
    const factor = servingsRequested / recipe.servings_base
    return recipe.ingredients.map((i) => ({
      ...i,
      quantity_scaled: Math.round(i.quantity_base * factor * 100) / 100,
    }))
  }, [recipe, servingsRequested])

  const canPublish =
    title.trim().length > 0 &&
    Number(prepTime) > 0 &&
    rows.some((r) => r.name.trim() && Number(r.quantity_base) > 0)

  function updateRow(key, patch) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()])
  }

  function removeRow(key) {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  async function resolveIngredientId(row) {
    if (row.ingredientId) return row.ingredientId
    const created = await api.createIngredient(
      { name: row.name.trim(), unit: row.unit.trim() || 'u' },
      token,
    )
    return created.id
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const validRows = rows.filter((r) => r.name.trim() && Number(r.quantity_base) > 0)
      const ingredients = []
      for (const row of validRows) {
        const ingredient_id = await resolveIngredientId(row)
        ingredients.push({ ingredient_id, quantity_base: Number(row.quantity_base) })
      }
      const payload = {
        title: title.trim(),
        description,
        servings_base: Number(servingsBase),
        prep_time_minutes: Number(prepTime),
        ingredients,
      }
      const saved = isNew
        ? await api.createRecipe(payload, token)
        : await api.updateRecipe(id, payload, token)

      if (isNew) {
        navigate(`/recipes/${saved.id}`)
      } else {
        setRecipe(saved)
        setServingsRequested(saved.servings_requested)
        setEditing(false)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    setSaving(true)
    setError('')
    try {
      const updated = await api.publishRecipe(id, token)
      setRecipe(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Borrar esta receta?')) return
    await api.deleteRecipe(id, token)
    navigate('/')
  }

  if (loading) return <p>Cargando...</p>
  if (error && !recipe && !isNew) return <p className="error">{error}</p>

  if (editing) {
    return (
      <form onSubmit={handleSave} style={{ maxWidth: 480 }}>
        <button type="button" onClick={() => navigate('/')}>
          ← Volver
        </button>
        <h1>{isNew ? 'Nueva receta' : 'Editar receta'}</h1>
        <div className="form-row">
          <label>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="form-row">
          <label>Descripción</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Porciones base</label>
          <input
            type="number"
            min="1"
            value={servingsBase}
            onChange={(e) => setServingsBase(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label>Tiempo de preparación (min)</label>
          <input
            type="number"
            min="0"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
          />
        </div>

        <h3>Ingredientes</h3>
        {rows.map((row) => (
          <div className="ingredient-row" key={row.key}>
            <input
              placeholder="Nombre"
              value={row.name}
              onChange={(e) => updateRow(row.key, { name: e.target.value, ingredientId: null })}
            />
            <input
              placeholder="Unidad (g, u, ml...)"
              value={row.unit}
              onChange={(e) => updateRow(row.key, { unit: e.target.value })}
              style={{ width: 100 }}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Cantidad"
              value={row.quantity_base}
              onChange={(e) => updateRow(row.key, { quantity_base: e.target.value })}
              style={{ width: 100 }}
            />
            <button type="button" onClick={() => removeRow(row.key)}>
              Quitar
            </button>
          </div>
        ))}
        <button type="button" onClick={addRow}>
          + Agregar ingrediente
        </button>

        {error && <p className="error">{error}</p>}

        <div className="toolbar">
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          {!isNew && (
            <button type="button" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    )
  }

  if (!recipe) return null

  return (
    <div>
      <button type="button" onClick={() => navigate('/')}>
        ← Volver
      </button>
      <h1>
        {recipe.title}{' '}
        <span className={`badge ${recipe.is_public ? 'public' : 'private'}`}>
          {recipe.is_public ? 'Pública' : 'Privada'}
        </span>
      </h1>
      {recipe.description
        .split('\n')
        .filter((paragraph) => paragraph.trim().length > 0)
        .map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      <p>Tiempo de preparación: {recipe.prep_time_minutes} min</p>

      <div className="form-row" style={{ maxWidth: 200 }}>
        <label>Porciones deseadas</label>
        <input
          type="number"
          min="1"
          value={servingsRequested}
          onChange={(e) => setServingsRequested(Math.max(1, Number(e.target.value) || 1))}
        />
      </div>

      <h3>Ingredientes</h3>
      <ul>
        {scaledIngredients.map((i) => (
          <li key={i.ingredient.id}>
            <label>
              <input
                type="checkbox"
                checked={Boolean(checked[i.ingredient.id])}
                onChange={(e) =>
                  setChecked((prev) => ({ ...prev, [i.ingredient.id]: e.target.checked }))
                }
              />{' '}
              <span
                style={{ textDecoration: checked[i.ingredient.id] ? 'line-through' : 'none' }}
              >
                {i.quantity_scaled} {i.ingredient.unit} de {i.ingredient.name}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {error && <p className="error">{error}</p>}

      {isOwner && (
        <div className="toolbar">
          <button type="button" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button type="button" onClick={handleDelete}>
            Borrar
          </button>
          {!recipe.is_public && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={!canPublish || saving}
              title={
                !canPublish
                  ? 'Completá título, tiempo de preparación > 0 y al menos un ingrediente'
                  : ''
              }
            >
              Publicar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
