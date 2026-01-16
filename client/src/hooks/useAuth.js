import { useState, useEffect, useCallback } from 'react'
import api from '../config/api'

const AUTH_TOKEN_KEY = 'draw_trade_auth_token'

// Helper to get/set auth token in localStorage
const getStoredToken = () => localStorage.getItem(AUTH_TOKEN_KEY)
const setStoredToken = (token) => {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  }
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState(null)

  const fetchUser = useCallback(async () => {
    try {
      const response = await api.get('/api/auth/user')
      if (response.data.authenticated) {
        setUser(response.data.user)
        setIsAuthenticated(true)
      } else {
        setUser(null)
        setIsAuthenticated(false)
        setStoredToken(null) // Clear invalid token
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      setUser(null)
      setIsAuthenticated(false)
      setStoredToken(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const login = async (email, password) => {
    setError(null)
    try {
      const response = await api.post('/api/auth/login', { email, password })
      if (response.data.success) {
        // Store the auth token for mobile/cross-origin support
        if (response.data.authToken) {
          setStoredToken(response.data.authToken)
        }
        setUser(response.data.user)
        setIsAuthenticated(true)
        return { success: true }
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Login failed'
      setError(message)
      return { success: false, error: message }
    }
  }

  const register = async (email, password, firstName, lastName) => {
    setError(null)
    try {
      const response = await api.post('/api/auth/register', {
        email,
        password,
        firstName,
        lastName
      })
      if (response.data.success) {
        // Store the auth token for mobile/cross-origin support
        if (response.data.authToken) {
          setStoredToken(response.data.authToken)
        }
        setUser(response.data.user)
        setIsAuthenticated(true)
        return { success: true }
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Registration failed'
      setError(message)
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try {
      await api.post('/api/auth/logout', {})
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      setStoredToken(null)
      setUser(null)
      setIsAuthenticated(false)
    }
  }

  const refetch = () => {
    setIsLoading(true)
    fetchUser()
  }

  const clearError = () => setError(null)

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    login,
    register,
    logout,
    refetch,
    clearError
  }
}

// Export helper for other modules to get the token
export const getAuthToken = getStoredToken
