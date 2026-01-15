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
            <span className="step-text">Choose an asset and timeline to trade</span>
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
      </div>

      <div className="instructions-panel scoring-panel">
        <h3>Scoring System</h3>
        <div className="scoring-explanation">
          <p className="scoring-intro">
            Your accuracy score measures how close your prediction is to the actual price movement.
          </p>

          <div className="formula-box">
            <div className="formula-label">Score Formula:</div>
            <div className="formula">
              Score = <span className="sigma">Σ</span> <span className="fraction"><span className="numerator">1</span><span className="denominator">(actual - predicted)²</span></span>
            </div>
          </div>

          <div className="scoring-details">
            <p>
              <strong>Higher scores are better.</strong> For each time point in your prediction:
            </p>
            <ul>
              <li>The closer your predicted price is to the actual price, the higher your score</li>
              <li>Scores are summed across all time periods</li>
              <li>Perfect predictions approach infinity (capped for display)</li>
              <li>Scores update live as the market moves</li>
            </ul>
          </div>

          <div className="rewards-info">
            <h4>Rewards</h4>
            <p>
              When your prediction period ends, you earn tokens based on your accuracy score multiplied by your staked amount.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InstructionsPanel
