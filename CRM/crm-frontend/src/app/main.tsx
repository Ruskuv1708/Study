import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import '../styles/index.css'
import App from './App.tsx'

const normalizeApiBase = (value?: string) => {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

const configuredApiBase = normalizeApiBase(import.meta.env.VITE_API_BASE_URL)
const API_BASE_URL = configuredApiBase || (import.meta.env.DEV ? 'http://localhost:8000' : '')

if (!API_BASE_URL && import.meta.env.PROD) {
  // Production should always provide VITE_API_BASE_URL (Netlify env var).
  console.error('Missing VITE_API_BASE_URL for production build. Requests may fail.')
}

axios.defaults.baseURL = API_BASE_URL || window.location.origin

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
