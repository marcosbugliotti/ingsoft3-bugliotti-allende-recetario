import { useEffect, useRef, useState } from 'react'

const ICONOS = { local: '🧑‍🍳', qa: '🥘', prod: '🍽️' }
const TRIPLE_CLICK_MS = 600

function detectarEntorno() {
  const host = window.location.hostname
  if (host.includes('-qa')) return 'qa'
  if (host.includes('-prod')) return 'prod'
  return 'local'
}

export default function Footer() {
  const [commit, setCommit] = useState(null)
  const [revelado, setRevelado] = useState(false)
  const clicks = useRef(0)
  const resetTimer = useRef(null)
  const entorno = detectarEntorno()

  useEffect(() => {
    fetch('/api/version')
      .then((res) => res.json())
      .then((data) => setCommit(data.commit))
      .catch(() => setCommit('?'))
  }, [])

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
          {entorno.toUpperCase()} · commit {commit}
        </span>
      )}
    </footer>
  )
}
