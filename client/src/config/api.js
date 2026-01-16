import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || ''

const AUTH_TOKEN_KEY = 'draw_trade_auth_token'

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
})

// Add auth token to every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
