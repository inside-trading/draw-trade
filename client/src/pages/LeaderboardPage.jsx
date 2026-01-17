import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../config/api'
import TradeDetailModal from '../components/TradeDetailModal'
import { formatLocalDate } from '../utils/dateUtils'

const TIMEFRAME_LABELS = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly'
}

export default function LeaderboardPage({ currentUserId }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [topTrades, setTopTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('leaderboard') // 'leaderboard' or 'trades'
  const [selectedTradeId, setSelectedTradeId] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [leaderboardRes, tradesRes] = await Promise.all([
          api.get('/api/leaderboard'),
          api.get('/api/trades/top-profitable?limit=20')
        ])
        setLeaderboard(leaderboardRes.data.leaderboard)
        setTopTrades(tradesRes.data.trades)
        setError(null)
      } catch (err) {
        setError('Failed to load data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // Refresh every minute
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  const getRankBadge = (rank) => {
    if (rank === 1) return <span className="rank-badge gold">1st</span>
    if (rank === 2) return <span className="rank-badge silver">2nd</span>
    if (rank === 3) return <span className="rank-badge bronze">3rd</span>
    return <span className="rank-badge">#{rank}</span>
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">Loading leaderboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="error-state">{error}</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Leaderboard</h1>
        <Link to="/" className="back-link">Back to Trading</Link>
      </div>

      {/* Tab Navigation */}
      <div className="leaderboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Top Traders
        </button>
        <button
          className={`tab-btn ${activeTab === 'trades' ? 'active' : ''}`}
          onClick={() => setActiveTab('trades')}
        >
          Most Profitable Trades
        </button>
      </div>

      {activeTab === 'leaderboard' ? (
        <>
          <div className="leaderboard-intro">
            <p>
              Traders are ranked by their <strong>Time-Weighted MSPE</strong> -
              a metric that weighs recent predictions more heavily (30-day half-life).
              Lower is better!
            </p>
          </div>

          {/* Top 3 Podium */}
          {leaderboard.length >= 3 && (
            <div className="podium">
              <div className="podium-place second">
                <div className="podium-avatar">{leaderboard[1].displayName.charAt(0).toUpperCase()}</div>
                <div className="podium-name">{leaderboard[1].displayName}</div>
                <div className="podium-mspe">{leaderboard[1].timeWeightedMspe?.toFixed(4) || '-'}</div>
                <div className="podium-balance">{leaderboard[1].tokenBalance.toLocaleString()} tokens</div>
                <div className="podium-stand">2</div>
              </div>
              <div className="podium-place first">
                <div className="podium-crown">👑</div>
                <div className="podium-avatar gold">{leaderboard[0].displayName.charAt(0).toUpperCase()}</div>
                <div className="podium-name">{leaderboard[0].displayName}</div>
                <div className="podium-mspe">{leaderboard[0].timeWeightedMspe?.toFixed(4) || '-'}</div>
                <div className="podium-balance">{leaderboard[0].tokenBalance.toLocaleString()} tokens</div>
                <div className="podium-stand gold">1</div>
              </div>
              <div className="podium-place third">
                <div className="podium-avatar">{leaderboard[2].displayName.charAt(0).toUpperCase()}</div>
                <div className="podium-name">{leaderboard[2].displayName}</div>
                <div className="podium-mspe">{leaderboard[2].timeWeightedMspe?.toFixed(4) || '-'}</div>
                <div className="podium-balance">{leaderboard[2].tokenBalance.toLocaleString()} tokens</div>
                <div className="podium-stand">3</div>
              </div>
            </div>
          )}

          {/* Full Leaderboard Table */}
          <div className="leaderboard-table-container">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Trader</th>
                  <th>TW-MSPE</th>
                  <th>Predictions</th>
                  <th>Token Balance</th>
                  <th>Profit/Loss</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map(entry => (
                  <tr
                    key={entry.userId}
                    className={currentUserId === entry.userId ? 'current-user' : ''}
                  >
                    <td>{getRankBadge(entry.rank)}</td>
                    <td className="trader-cell">
                      <div className="trader-avatar">{entry.displayName.charAt(0).toUpperCase()}</div>
                      <span className="trader-name">
                        {entry.displayName}
                        {currentUserId === entry.userId && <span className="you-badge">You</span>}
                      </span>
                    </td>
                    <td className="mspe-cell">{entry.timeWeightedMspe?.toFixed(4) || '-'}</td>
                    <td>{entry.predictionCount}</td>
                    <td className="balance-cell">{entry.tokenBalance.toLocaleString()}</td>
                    <td className={`pl-cell ${entry.profitLoss >= 0 ? 'positive' : 'negative'}`}>
                      {entry.profitLoss >= 0 ? '+' : ''}{entry.profitLoss.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {leaderboard.length === 0 && (
              <div className="empty-state">
                No traders on the leaderboard yet. Be the first to make a prediction!
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="leaderboard-intro">
            <p>
              The most profitable trades of all time. Click on a trade to see the
              prediction overlaid with the actual price movement.
            </p>
          </div>

          <div className="leaderboard-table-container">
            <table className="leaderboard-table trades-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Trader</th>
                  <th>Asset</th>
                  <th>Timeframe</th>
                  <th>Staked</th>
                  <th>Rewards</th>
                  <th>Profit</th>
                  <th>MSPE</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {topTrades.map((trade, index) => (
                  <tr
                    key={trade.id}
                    className="clickable-row"
                    onClick={() => setSelectedTradeId(trade.id)}
                  >
                    <td>{getRankBadge(index + 1)}</td>
                    <td className="trader-cell">
                      <div className="trader-avatar">{trade.userName.charAt(0).toUpperCase()}</div>
                      <span className="trader-name">{trade.userName}</span>
                    </td>
                    <td className="symbol-cell">{trade.symbol}</td>
                    <td>{TIMEFRAME_LABELS[trade.timeframe] || trade.timeframe}</td>
                    <td>{trade.stakedTokens?.toLocaleString()}</td>
                    <td>{trade.rewardsEarned?.toLocaleString()}</td>
                    <td className={`pl-cell ${trade.profit >= 0 ? 'positive' : 'negative'}`}>
                      {trade.profit >= 0 ? '+' : ''}{trade.profit?.toLocaleString()}
                    </td>
                    <td className="mspe-cell">{trade.mspe?.toFixed(4) || '-'}</td>
                    <td className="date-cell">{formatLocalDate(trade.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {topTrades.length === 0 && (
              <div className="empty-state">
                No completed trades yet. Complete a prediction to see it here!
              </div>
            )}
          </div>
        </>
      )}

      <div className="leaderboard-footer">
        <p>Rankings update automatically as predictions are scored.</p>
      </div>

      {/* Trade Detail Modal */}
      {selectedTradeId && (
        <TradeDetailModal
          tradeId={selectedTradeId}
          onClose={() => setSelectedTradeId(null)}
        />
      )}
    </div>
  )
}
