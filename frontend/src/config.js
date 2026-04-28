// In production, calls go directly to Railway backend
// In development, Vite proxy handles /api → localhost:5000
const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}`
  : ''

export default API_BASE
