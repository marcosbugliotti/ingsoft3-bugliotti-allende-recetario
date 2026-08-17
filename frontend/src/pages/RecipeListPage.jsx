import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function RecipeListPage() {
  const { token, isAuthenticated } = useAuth()
  const [search, setSearch] = useState('')
  const [mine, setMine] = useState(false)
  const [recipes, setRecipes] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (search.trim()) params.search = search.trim()
      if (mine) params.mine = 'true'
      const data = await api.listRecipes(params, token)
      setRecipes(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, mine, token])

  useEffect(() => {
    load()
  }, [load])

  function handleSearchSubmit(e) {
    e.preventDefault()
    load()
  }

  return (
    <div>
      <div className="toolbar">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Buscar por título o ingrediente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">Buscar</button>
        </form>

        {isAuthenticated && (
          <label>
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />{' '}
            Solo mis recetas
          </label>
        )}

        {isAuthenticated && (
          <Link to="/recipes/new">
            <button type="button">+ Nueva receta</button>
          </Link>
        )}
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && recipes.length === 0 && <p>No hay recetas para mostrar.</p>}

      {recipes.map((r) => (
        <div className="recipe-card" key={r.id}>
          <Link to={`/recipes/${r.id}`}>
            <strong>{r.title}</strong>
          </Link>{' '}
          <span className={`badge ${r.is_public ? 'public' : 'private'}`}>
            {r.is_public ? 'Pública' : 'Privada'}
          </span>
          <div>
            {r.servings_base} porciones · {r.prep_time_minutes} min
          </div>
        </div>
      ))}
    </div>
  )
}
