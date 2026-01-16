import React from 'react'
import { Link } from 'react-router-dom'

export default function ScoringPage() {
  return (
    <div className="page-container scoring-page">
      <div className="page-header">
        <h1>Scoring System</h1>
        <Link to="/" className="back-link">Back to Trade</Link>
      </div>

      <div className="scoring-panel-full">
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

      <div className="scoring-examples">
        <h2>Understanding Your Score</h2>

        <div className="example-grid">
          <div className="example-card">
            <h3>Excellent Prediction</h3>
            <div className="example-mspe good">MSPE &lt; 1.0</div>
            <p>Your predicted path closely follows the actual price movement. You'll earn significant rewards.</p>
          </div>

          <div className="example-card">
            <h3>Good Prediction</h3>
            <div className="example-mspe moderate">MSPE 1.0 - 5.0</div>
            <p>Your prediction captures the general trend with some deviation. Solid returns expected.</p>
          </div>

          <div className="example-card">
            <h3>Fair Prediction</h3>
            <div className="example-mspe fair">MSPE 5.0 - 10.0</div>
            <p>Noticeable difference between prediction and actual prices. Moderate rewards.</p>
          </div>

          <div className="example-card">
            <h3>Poor Prediction</h3>
            <div className="example-mspe poor">MSPE &gt; 10.0</div>
            <p>Significant deviation from actual prices. Lower payoff, but still a learning opportunity.</p>
          </div>
        </div>
      </div>

      <div className="scoring-tips">
        <h2>Tips for Better Predictions</h2>
        <ul>
          <li><strong>Study the historical pattern:</strong> Look at how the asset has moved in the past before drawing your prediction.</li>
          <li><strong>Consider volatility:</strong> High-volatility assets tend to have larger price swings.</li>
          <li><strong>Draw smooth curves:</strong> Erratic predictions are less likely to match actual price movements.</li>
          <li><strong>Use the sentiment slider:</strong> Adjust bounds based on your bullish or bearish outlook.</li>
          <li><strong>Start with longer timeframes:</strong> They tend to be more predictable than short-term movements.</li>
        </ul>
      </div>
    </div>
  )
}
