import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../config/api'

export default function LeaderboardPage({ currentUserId }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await api.get('/api/leaderboard')
        setLeaderboard(response.data.leaderboard)
        setError(null)
      } catch (err) {
        setError('Failed to load leaderboard')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
    // Refresh every minute
    const interval = setInterval(fetchLeaderboard, 60000)
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

      <div className="leaderboard-intro">
        <p>
          Traders are ranked by their <strong>Mean MSPE</strong> (Mean of Mean Squared Percentage Error) -
          the average prediction accuracy across all positions. Lower is better!
        </p>
      </div>

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <div className="podium">
          <div className="podium-place second">
            <div className="podium-avatar">{leaderboard[1].displayName.charAt(0).toUpperCase()}</div>
            <div className="podium-name">{leaderboard[1].displayName}</div>
            <div className="podium-mspe">{leaderboard[1].meanMspe?.toFixed(4) || '-'}</div>
            <div className="podium-balance">{leaderboard[1].tokenBalance.toLocaleString()} tokens</div>
            <div className="podium-stand">2</div>
          </div>
          <div className="podium-place first">
            <div className="podium-crown">👑</div>
            <div className="podium-avatar gold">{leaderboard[0].displayName.charAt(0).toUpperCase()}</div>
            <div className="podium-name">{leaderboard[0].displayName}</div>
            <div className="podium-mspe">{leaderboard[0].meanMspe?.toFixed(4) || '-'}</div>
            <div className="podium-balance">{leaderboard[0].tokenBalance.toLocaleString()} tokens</div>
            <div className="podium-stand gold">1</div>
          </div>
          <div className="podium-place third">
            <div className="podium-avatar">{leaderboard[2].displayName.charAt(0).toUpperCase()}</div>
            <div className="podium-name">{leaderboard[2].displayName}</div>
            <div className="podium-mspe">{leaderboard[2].meanMspe?.toFixed(4) || '-'}</div>
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
              <th>Mean MSPE</th>
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
                <td className="mspe-cell">{entry.meanMspe?.toFixed(4) || '-'}</td>
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

      <div className="leaderboard-footer">
        <p>Rankings update automatically as predictions are scored.</p>
      </div>
    </div>
  )
}
