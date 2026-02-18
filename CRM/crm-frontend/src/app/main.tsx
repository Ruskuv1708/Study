import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import '../styles/index.css'
import App from './App.tsx'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
axios.defaults.baseURL = API_BASE_URL

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
