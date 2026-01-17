import React from 'react'
import { Link } from 'react-router-dom'

export default function ScoringPage() {
  return (
    <div className="page-container scoring-page">
      <div className="page-header">
        <h1>Scoring & Rewards</h1>
        <Link to="/" className="back-link">Back to Trade</Link>
      </div>

      <div className="scoring-panel-full">
        <div className="scoring-content">
          <div className="scoring-column">
            <p className="scoring-intro">
              Your rewards are based on two factors: <strong>prediction accuracy</strong> and <strong>being contrarian</strong>.
              Make accurate predictions that differ from the crowd to maximize your earnings.
            </p>

            <div className="formula-box">
              <div className="formula-label">Accuracy Score (MSPE):</div>
              <div className="formula">
                MSPE = <span className="fraction"><span className="numerator">1</span><span className="denominator">N</span></span> <span className="sigma">Σ</span> <span className="fraction"><span className="numerator">(actual - predicted)²</span><span className="denominator">actual</span></span>
              </div>
              <div className="formula-note">
                Lower MSPE = more accurate prediction
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-label">Contrarian Score:</div>
              <div className="formula">
                Contrarian = 1 - |correlation with meta-prediction|
              </div>
              <div className="formula-note">
                Higher score = more unique prediction (0.5 to 1.0)
              </div>
            </div>
          </div>

          <div className="scoring-column">
            <div className="formula-box payoff-box">
              <div className="formula-label">Payoff Formula:</div>
              <div className="formula payoff-formula">
                Payoff = Stake × Accuracy × Contrarian × Progress
              </div>
            </div>

            <div className="scoring-details">
              <p><strong>Breaking it down:</strong></p>
              <ul>
                <li><strong>Accuracy Multiplier</strong> = N ÷ (1 + MSPE), capped at 10×</li>
                <li><strong>Contrarian Bonus</strong> = 1.0× to 2.0× based on uniqueness</li>
                <li><strong>Progress Factor</strong> = 100% if held to completion, reduced for early close</li>
              </ul>
            </div>

            <div className="rewards-info">
              <h4>Payoff Bounds</h4>
              <p>
                Minimum: 10% of stake | Maximum: 100× stake
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="scoring-examples">
        <h2>Meta-Prediction & Contrarian Rewards</h2>

        <div className="meta-explanation">
          <p>
            All user predictions are aggregated into a <strong>meta-prediction</strong> for each asset.
            This represents the "crowd consensus" of where the price will go.
          </p>
          <p>
            When you make a prediction that <strong>differs from the meta-prediction AND turns out to be accurate</strong>,
            you earn bonus rewards. This incentivizes independent thinking over following the herd.
          </p>
        </div>

        <h2 style={{marginTop: '2rem'}}>Understanding Your Score</h2>

        <div className="example-grid">
          <div className="example-card">
            <h3>Best Case</h3>
            <div className="example-mspe good">Accurate + Contrarian</div>
            <p>Low MSPE and high contrarian score. You predicted correctly while others were wrong. Maximum rewards!</p>
          </div>

          <div className="example-card">
            <h3>Good</h3>
            <div className="example-mspe moderate">Accurate + Consensus</div>
            <p>Low MSPE but similar to meta-prediction. You were right, but so was everyone else. Solid returns.</p>
          </div>

          <div className="example-card">
            <h3>Risky</h3>
            <div className="example-mspe fair">Inaccurate + Contrarian</div>
            <p>High MSPE but different from meta. You went against the crowd but were wrong. Lower rewards.</p>
          </div>

          <div className="example-card">
            <h3>Worst Case</h3>
            <div className="example-mspe poor">Inaccurate + Consensus</div>
            <p>High MSPE and similar to meta. Wrong prediction following the crowd. Minimum rewards.</p>
          </div>
        </div>
      </div>

      <div className="scoring-examples">
        <h2>Early Close vs Full Completion</h2>

        <div className="example-grid" style={{gridTemplateColumns: 'repeat(2, 1fr)'}}>
          <div className="example-card">
            <h3>Full Completion</h3>
            <div className="example-mspe good">100% Progress</div>
            <p>Hold your prediction for the entire timeframe to receive full rewards. Button shows "Collect rewards" when ready.</p>
          </div>

          <div className="example-card">
            <h3>Early Close</h3>
            <div className="example-mspe fair">5-99% Progress</div>
            <p>Close early after 5% progress for partial rewards. Progress factor reduces payoff proportionally.</p>
          </div>
        </div>
      </div>

      <div className="scoring-tips">
        <h2>Tips for Better Predictions</h2>
        <ul>
          <li><strong>Think independently:</strong> Don't just follow the crowd - unique accurate predictions earn bonus rewards.</li>
          <li><strong>Study the historical pattern:</strong> Look at how the asset has moved in the past before drawing your prediction.</li>
          <li><strong>Consider volatility:</strong> High-volatility assets tend to have larger price swings.</li>
          <li><strong>Draw smooth curves:</strong> Erratic predictions are less likely to match actual price movements.</li>
          <li><strong>Hold to completion:</strong> Early closes reduce your progress factor and final payoff.</li>
          <li><strong>Start with crypto:</strong> Crypto markets are open 24/7, while stocks only trade during market hours.</li>
        </ul>
      </div>

      <div className="scoring-tips">
        <h2>Market Hours</h2>
        <ul>
          <li><strong>Crypto (BTC, ETH, etc.):</strong> Trade and collect rewards 24/7</li>
          <li><strong>Stocks & Commodities:</strong> 9:30 AM - 4:00 PM Eastern, Monday-Friday only</li>
        </ul>
      </div>
    </div>
  )
}
