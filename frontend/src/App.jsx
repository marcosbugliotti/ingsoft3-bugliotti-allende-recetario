import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RecipeListPage from './pages/RecipeListPage.jsx'
import RecipeDetailPage from './pages/RecipeDetailPage.jsx'

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { isAuthenticated, userEmail, logout } = useAuth()

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          Recetario
        </Link>
        <nav>
          {isAuthenticated ? (
            <>
              <span className="user-email">{userEmail}</span>
              <button onClick={logout}>Salir</button>
            </>
          ) : (
            <Link to="/login">Ingresar</Link>
          )}
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RecipeListPage />} />
          <Route
            path="/recipes/new"
            element={
              <PrivateRoute>
                <RecipeDetailPage mode="new" />
              </PrivateRoute>
            }
          />
          <Route path="/recipes/:id" element={<RecipeDetailPage mode="view" />} />
        </Routes>
      </main>
    </div>
  )
}
