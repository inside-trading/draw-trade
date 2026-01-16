import React from 'react'

function InstructionsPanel() {
  return (
    <div className="instructions-section-centered">
      <div className="instructions-panel">
        <h3>How to Play</h3>
        <ol className="instructions-list">
          <li>
            <span className="step-number">1</span>
            <span className="step-text">Create and log into your account to receive 100 bonus tokens</span>
          </li>
          <li>
            <span className="step-number">2</span>
            <span className="step-text">Choose an asset and timeframe to trade</span>
          </li>
          <li>
            <span className="step-number">3</span>
            <span className="step-text">Adjust the upper and lower bounds with the bull/bear slider or type in your own numbers</span>
          </li>
          <li>
            <span className="step-number">4</span>
            <span className="step-text">Draw your chart prediction for the future!</span>
          </li>
          <li>
            <span className="step-number">5</span>
            <span className="step-text">Choose your stake amount</span>
          </li>
          <li>
            <span className="step-number">6</span>
            <span className="step-text">Submit your prediction</span>
          </li>
          <li>
            <span className="step-number">7</span>
            <span className="step-text">Track your performance over time</span>
          </li>
        </ol>

        <div className="beta-notice">
          <div className="beta-badge">BETA</div>
          <p>We are currently beta testing. Full launch coming soon!</p>
        </div>

        <div className="disclaimer">
          This site is optimized for desktop. Use at your own risk.
        </div>
      </div>
    </div>
  )
}

export default InstructionsPanel
