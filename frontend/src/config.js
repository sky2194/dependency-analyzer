// Production: set VITE_API_URL to the DigitalOcean backend origin.
// Development: leave empty so Vite proxies /api to localhost:5000.
const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : ''

export default API_BASE
