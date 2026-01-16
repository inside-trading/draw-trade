import React from 'react'

function ScoringPanel() {
  return (
    <div className="scoring-section">
      <div className="scoring-panel-full">
        <h3>Scoring System</h3>
        <div className="scoring-content">
          <div className="scoring-column">
            <p className="scoring-intro">
              Your prediction accuracy is measured using the Mean Squared Percentage Error (MSPE) computed over the entire path of your prediction.
            </p>

            <div className="formula-box">
              <div className="formula-label">Squared Percentage Error (at each time point):</div>
              <div className="formula">
                SPE = <span className="fraction"><span className="numerator">(actual - predicted)²</span><span className="denominator">actual</span></span>
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-label">Mean Squared Percentage Error:</div>
              <div className="formula">
                MSPE = <span className="fraction"><span className="numerator">1</span><span className="denominator">N</span></span> <span className="sigma">Σ</span> SPE
              </div>
              <div className="formula-note">
                Where N = number of time points in your prediction
              </div>
            </div>
          </div>

          <div className="scoring-column">
            <div className="scoring-details">
              <p>
                <strong>Lower MSPE is better.</strong> For each time point in your prediction:
              </p>
              <ul>
                <li>The closer your predicted price is to the actual price, the lower your error</li>
                <li>Dividing by actual price normalizes across different asset values</li>
                <li>Perfect predictions result in an MSPE of 0</li>
                <li>MSPE updates live as the market moves</li>
              </ul>
            </div>

            <div className="formula-box payoff-box">
              <div className="formula-label">Payoff Formula:</div>
              <div className="formula">
                Payoff = <span className="fraction"><span className="numerator">Stake × N</span><span className="denominator">MSPE</span></span>
              </div>
              <div className="formula-note">
                Lower MSPE = Higher rewards!
              </div>
            </div>

            <div className="rewards-info">
              <h4>Rewards</h4>
              <p>
                The more accurate your prediction path, the higher your payoff. Beat other traders by minimizing your Mean Squared Percentage Error!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScoringPanel
