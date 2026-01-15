import React, { useState } from 'react'

export default function AuthHeader({ user, isAuthenticated, isLoading, onLogin, onRegister, onLogout, error, onClearError }) {
  const [showModal, setShowModal] = useState(false)
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    let result
    if (isLoginMode) {
      result = await onLogin(formData.email, formData.password)
    } else {
      result = await onRegister(formData.email, formData.password, formData.firstName, formData.lastName)
    }

    setIsSubmitting(false)
    if (result?.success) {
      setShowModal(false)
      setFormData({ email: '', password: '', firstName: '', lastName: '' })
    }
  }

  const openModal = (loginMode) => {
    setIsLoginMode(loginMode)
    setShowModal(true)
    onClearError?.()
  }

  const closeModal = () => {
    setShowModal(false)
    setFormData({ email: '', password: '', firstName: '', lastName: '' })
    onClearError?.()
  }

  if (isLoading) {
    return (
      <div className="auth-header">
        <div className="auth-loading">Loading...</div>
      </div>
    )
  }

  if (isAuthenticated && user) {
    return (
      <div className="auth-header">
        <div className="user-info">
          <div className="user-avatar">
            {user.firstName ? user.firstName[0].toUpperCase() : user.email[0].toUpperCase()}
          </div>
          <div className="user-details">
            <span className="user-name">
              {user.firstName || user.email.split('@')[0]}
            </span>
            <span className="token-balance">
              {user.tokenBalance.toLocaleString()} tokens
            </span>
          </div>
        </div>
        <button onClick={onLogout} className="auth-button logout-button">
          Log Out
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="auth-header">
        <button onClick={() => openModal(true)} className="auth-button login-button">
          Log In
        </button>
        <button onClick={() => openModal(false)} className="auth-button register-button">
          Sign Up
        </button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>&times;</button>
            <h2>{isLoginMode ? 'Log In' : 'Create Account'}</h2>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              {!isLoginMode && (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="firstName">First Name</label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="John"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="lastName">Last Name</label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Doe"
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={isLoginMode ? 'Your password' : 'Min 8 characters'}
                  minLength={8}
                  required
                />
              </div>

              <button type="submit" className="submit-button" disabled={isSubmitting}>
                {isSubmitting ? 'Please wait...' : (isLoginMode ? 'Log In' : 'Create Account')}
              </button>
            </form>

            <div className="auth-switch">
              {isLoginMode ? (
                <p>Don't have an account? <button type="button" onClick={() => setIsLoginMode(false)}>Sign Up</button></p>
              ) : (
                <p>Already have an account? <button type="button" onClick={() => setIsLoginMode(true)}>Log In</button></p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
