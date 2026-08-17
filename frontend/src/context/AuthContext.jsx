import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('recetario_token'))
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('recetario_email'))

  useEffect(() => {
    if (token) localStorage.setItem('recetario_token', token)
    else localStorage.removeItem('recetario_token')
  }, [token])

  useEffect(() => {
    if (userEmail) localStorage.setItem('recetario_email', userEmail)
    else localStorage.removeItem('recetario_email')
  }, [userEmail])

  const value = useMemo(
    () => ({
      token,
      userEmail,
      isAuthenticated: Boolean(token),
      login: (newToken, email) => {
        setToken(newToken)
        setUserEmail(email)
      },
      logout: () => {
        setToken(null)
        setUserEmail(null)
      },
    }),
    [token, userEmail],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
