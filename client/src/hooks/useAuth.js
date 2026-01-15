import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

export function useAuth() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState(null)

  const fetchUser = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/user`, { withCredentials: true })
      if (response.data.authenticated) {
        setUser(response.data.user)
        setIsAuthenticated(true)
      } else {
        setUser(null)
        setIsAuthenticated(false)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      setUser(null)
      setIsAuthenticated(false)
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
      const response = await axios.post(
        `${API_URL}/api/auth/login`,
        { email, password },
        { withCredentials: true }
      )
      if (response.data.success) {
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
      const response = await axios.post(
        `${API_URL}/api/auth/register`,
        { email, password, firstName, lastName },
        { withCredentials: true }
      )
      if (response.data.success) {
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
      await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true })
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
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
