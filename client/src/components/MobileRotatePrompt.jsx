import React, { useState, useEffect } from 'react'

function MobileRotatePrompt({ children }) {
  const [isMobilePortrait, setIsMobilePortrait] = useState(false)

  useEffect(() => {
    const checkOrientation = () => {
      // Check if it's a mobile device (screen width when in portrait would be narrow)
      const isMobile = window.innerWidth < 768 ||
        (window.innerWidth < 1024 && 'ontouchstart' in window)

      // Check if in portrait mode (height > width)
      const isPortrait = window.innerHeight > window.innerWidth

      setIsMobilePortrait(isMobile && isPortrait)
    }

    // Check on mount
    checkOrientation()

    // Listen for resize and orientation changes
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)

    // Also check after a small delay for orientation change to complete
    const handleOrientationChange = () => {
      setTimeout(checkOrientation, 100)
    }
    window.addEventListener('orientationchange', handleOrientationChange)

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  if (isMobilePortrait) {
    return (
      <div className="rotate-prompt">
        <div className="rotate-icon">
          <svg viewBox="0 0 24 24" fill="currentColor" className="phone-icon">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2"/>
            <circle cx="12" cy="18" r="1" fill="currentColor"/>
          </svg>
          <svg viewBox="0 0 24 24" fill="currentColor" className="rotate-arrow">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          </svg>
        </div>
        <h2>Rotate Your Device</h2>
        <p>For the best experience drawing predictions, please rotate your phone to landscape mode.</p>
        <div className="rotate-hint">
          <span>Turn your phone sideways</span>
        </div>
      </div>
    )
  }

  return children
}

export default MobileRotatePrompt
