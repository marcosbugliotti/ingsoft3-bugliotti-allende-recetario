import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const canSubmit = email.trim() && password.trim() && (mode === 'login' || name.trim())

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        await api.register({ email, password, name })
      }
      const { access_token } = await api.login({ email, password })
      login(access_token, email)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '48px auto' }}>
      <h1>{mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</h1>
      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <div className="form-row">
            <label htmlFor="name">Nombre</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="form-row">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-row">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={!canSubmit || loading}>
          {loading ? 'Cargando...' : mode === 'login' ? 'Ingresar' : 'Registrarme'}
        </button>
      </form>
      <p>
        {mode === 'login' ? (
          <>
            ¿No tenés cuenta?{' '}
            <button type="button" onClick={() => setMode('register')}>
              Registrate
            </button>
          </>
        ) : (
          <>
            ¿Ya tenés cuenta?{' '}
            <button type="button" onClick={() => setMode('login')}>
              Ingresá
            </button>
          </>
        )}
      </p>
    </div>
  )
}
