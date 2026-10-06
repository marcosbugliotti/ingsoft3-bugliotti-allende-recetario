import { useEffect, useRef, useState } from 'react'

const ICONOS = { local: '🧑‍🍳', qa: '🥘', prod: '🍽️' }
const TRIPLE_CLICK_MS = 600
const REPO = 'marcosbugliotti/ingsoft3-bugliotti-allende-recetario'
// nombre del environment de GitHub (ci.yml) por entorno detectado del hostname
const ENVIRONMENT_POR_ENTORNO = { qa: 'qa', prod: 'production' }

function detectarEntorno() {
  const host = window.location.hostname
  if (host.includes('-qa')) return 'qa'
  if (host.includes('-prod')) return 'prod'
  return 'local'
}

// El deployment más reciente de un environment puede estar "waiting"
// (esperando aprobación) o "queued"/"in_progress" — no necesariamente lo
// que Render ya tiene corriendo. Hay que recorrer hacia atrás hasta
// encontrar el último cuyo estado real sea "success".
async function obtenerCommitDesplegado(environment) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/deployments?environment=${environment}&per_page=5`,
  )
  const deployments = await res.json()
  for (const deployment of deployments) {
    const statusesRes = await fetch(deployment.statuses_url)
    const statuses = await statusesRes.json()
    if (statuses[0]?.state === 'success') {
      return deployment.sha
    }
  }
  return null
}

export default function Footer() {
  const [commit, setCommit] = useState(null)
  const [revelado, setRevelado] = useState(false)
  const clicks = useRef(0)
  const resetTimer = useRef(null)
  const entorno = detectarEntorno()

  useEffect(() => {
    // TP7: ya no le preguntamos a nuestro propio backend (RENDER_GIT_COMMIT
    // no existe en un servicio *Existing Image*) — le preguntamos a GitHub
    // qué commit quedó como el último deployment real de este entorno.
    const environment = ENVIRONMENT_POR_ENTORNO[entorno]
    if (!environment) {
      setCommit('local')
      return
    }
    obtenerCommitDesplegado(environment)
      .then((sha) => setCommit(sha ? `sha-${sha.slice(0, 7)}` : '?'))
      .catch(() => setCommit('?'))
  }, [entorno])

  useEffect(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${ICONOS[entorno]}</text></svg>`
    let link = document.querySelector("link[rel='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`
  }, [entorno])

  function handleClick() {
    clicks.current += 1
    clearTimeout(resetTimer.current)
    if (clicks.current >= 3) {
      setRevelado((r) => !r)
      clicks.current = 0
      return
    }
    resetTimer.current = setTimeout(() => {
      clicks.current = 0
    }, TRIPLE_CLICK_MS)
  }

  return (
    <footer className="footer">
      <button
        type="button"
        className={`env-icon env-${entorno}`}
        onClick={handleClick}
        aria-label={`Entorno: ${entorno}`}
      >
        {ICONOS[entorno]}
      </button>
      {revelado && commit && (
        <span className="commit">
          {entorno.toUpperCase()} · {commit}
        </span>
      )}
    </footer>
  )
}
