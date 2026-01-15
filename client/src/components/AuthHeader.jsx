import React from 'react'

export default function AuthHeader({ user, isAuthenticated, isLoading }) {
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
          {user.profileImageUrl && (
            <img 
              src={user.profileImageUrl} 
              alt="Profile" 
              className="profile-image"
            />
          )}
          <div className="user-details">
            <span className="user-name">
              {user.firstName || user.email || 'User'}
            </span>
            <span className="token-balance">
              {user.tokenBalance.toLocaleString()} tokens
            </span>
          </div>
        </div>
        <a href="/auth/logout" className="auth-button logout-button">
          Log Out
        </a>
      </div>
    )
  }

  return (
    <div className="auth-header">
      <a href="/auth/replit_auth" className="auth-button login-button">
        Log In
      </a>
    </div>
  )
}
