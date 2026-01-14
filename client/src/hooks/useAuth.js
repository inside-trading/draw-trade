import { useState, useEffect } from 'react'
import axios from 'axios'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const fetchUser = async () => {
    try {
      const response = await axios.get('/api/auth/user', { withCredentials: true })
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
  }

  useEffect(() => {
    fetchUser()
  }, [])

  const refetch = () => {
    setIsLoading(true)
    fetchUser()
  }

  return { user, isLoading, isAuthenticated, refetch }
}
