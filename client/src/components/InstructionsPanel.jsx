import React from 'react'

function InstructionsPanel() {
  return (
    <div className="instructions-section">
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
          This site is offered as-is. Use at your own risk.
        </div>
      </div>

      <div className="instructions-panel scoring-panel">
        <h3>Scoring System</h3>
        <div className="scoring-explanation">
          <p className="scoring-intro">
            Your score measures the accuracy of your prediction relative to actual price movement.
          </p>

          <div className="formula-box">
            <div className="formula-label">Score Formula:</div>
            <div className="formula">
              Score = <span className="fraction"><span className="numerator">(actual - predicted)²</span><span className="denominator">actual</span></span>
            </div>
          </div>

          <div className="scoring-details">
            <p>
              <strong>Lower scores are better.</strong> For each time point:
            </p>
            <ul>
              <li>The closer your predicted price is to the actual price, the lower your score</li>
              <li>Dividing by actual price normalizes across different asset values</li>
              <li>Perfect predictions result in a score of 0</li>
              <li>Scores update live as the market moves</li>
            </ul>
          </div>

          <div className="formula-box payoff-box">
            <div className="formula-label">Payoff Formula:</div>
            <div className="formula">
              Payoff = (Stake × ALPHA) - Score
            </div>
            <div className="formula-note">
              ALPHA = Community average score (ranges 1-100)
            </div>
          </div>

          <div className="rewards-info">
            <h4>Rewards</h4>
            <p>
              Beat the community average to earn tokens! Your payoff depends on how your score compares to other predictions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InstructionsPanel
