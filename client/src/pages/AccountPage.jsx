import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../config/api'
import { formatLocalDate } from '../utils/dateUtils'
import PerformanceHistoryChart from '../components/PerformanceHistoryChart'
import TradeDetailModal from '../components/TradeDetailModal'

const TIMEFRAME_LABELS = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly'
}

const STATUS_LABELS = {
  active: 'Active',
  completed: 'Completed',
  closed: 'Closed Early'
}

export default function AccountPage({ user, isAuthenticated, onRefreshAuth }) {
  const [stats, setStats] = useState(null)
  const [predictions, setPredictions] = useState([])
  const [performanceHistory, setPerformanceHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // 'all', 'active', 'completed'
  const [closingId, setClosingId] = useState(null)
  const [selectedMetric, setSelectedMetric] = useState('tokenBalance')
  const [selectedTradeId, setSelectedTradeId] = useState(null)

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return

    setLoading(true)
    try {
      const [statsRes, predictionsRes, historyRes] = await Promise.all([
        api.get('/api/user/stats', { withCredentials: true }),
        api.get('/api/user/predictions/detailed', { withCredentials: true }),
        api.get('/api/user/performance-history', { withCredentials: true })
      ])

      setStats(statsRes.data)
      setPredictions(predictionsRes.data.predictions)
      setPerformanceHistory(historyRes.data.history)
      setError(null)
    } catch (err) {
      setError('Failed to load account data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleClosePosition = async (predictionId, startPrice) => {
    if (!window.confirm('Close this position early? You will receive a prorated payoff.')) {
      return
    }

    setClosingId(predictionId)
    try {
      const response = await api.post(`/api/predictions/${predictionId}/close`, {
        currentPrice: startPrice // Use start price as fallback
      }, { withCredentials: true })

      if (response.data.success) {
        alert(`Position closed! Payoff: ${response.data.payoff} tokens`)
        fetchData()
        if (onRefreshAuth) onRefreshAuth()
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to close position')
    } finally {
      setClosingId(null)
    }
  }

  const filteredPredictions = predictions.filter(p => {
    if (filter === 'active') return p.status === 'active'
    if (filter === 'completed') return p.status !== 'active'
    return true
  })

  const getStatusClass = (status) => {
    switch (status) {
      case 'active': return 'status-active'
      case 'completed': return 'status-completed'
      case 'closed': return 'status-closed'
      default: return ''
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="page-container">
        <div className="auth-required">
          <h2>Account</h2>
          <p>Please log in to view your account.</p>
          <Link to="/" className="back-link">Back to Trading</Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">Loading account data...</div>
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
        <h1>My Account</h1>
        <Link to="/" className="back-link">Back to Trading</Link>
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-value">{stats?.user?.tokenBalance?.toLocaleString() || 0}</div>
          <div className="stat-label">Token Balance</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">#{stats?.stats?.rank || '-'}</div>
          <div className="stat-label">Leaderboard Rank</div>
          <div className="stat-sublabel">of {stats?.stats?.totalRankedUsers || 0} users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.stats?.timeWeightedMspe?.toFixed(4) || '-'}</div>
          <div className="stat-label">TW-MSPE</div>
          <div className="stat-sublabel">Mean: {stats?.stats?.meanMspe?.toFixed(4) || '-'}</div>
        </div>
        <div className={`stat-card ${(stats?.stats?.profitLoss || 0) >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-value">
            {(stats?.stats?.profitLoss || 0) >= 0 ? '+' : ''}{stats?.stats?.profitLoss?.toLocaleString() || 0}
          </div>
          <div className="stat-label">Profit/Loss</div>
        </div>
      </div>

      {/* Prediction Stats */}
      <div className="prediction-stats">
        <div className="stat-item">
          <span className="stat-num">{stats?.stats?.totalPredictions || 0}</span>
          <span className="stat-text">Total Predictions</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">{stats?.stats?.activePredictions || 0}</span>
          <span className="stat-text">Active</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">{stats?.stats?.completedPredictions || 0}</span>
          <span className="stat-text">Completed</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">{stats?.stats?.totalStaked?.toLocaleString() || 0}</span>
          <span className="stat-text">Total Staked</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">{stats?.stats?.totalRewards?.toLocaleString() || 0}</span>
          <span className="stat-text">Total Rewards</span>
        </div>
      </div>

      {/* Performance History Chart */}
      <div className="performance-history-section">
        <div className="section-header">
          <h2>Performance History</h2>
          <div className="metric-selector">
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="metric-dropdown"
            >
              <option value="tokenBalance">Token Balance</option>
              <option value="profitLoss">Profit/Loss</option>
              <option value="timeWeightedMspe">TW-MSPE</option>
              <option value="rank">Rank</option>
            </select>
          </div>
        </div>
        <div className="performance-chart-container">
          <PerformanceHistoryChart
            history={performanceHistory}
            metric={selectedMetric}
          />
        </div>
      </div>

      {/* Predictions Table */}
      <div className="predictions-section">
        <div className="section-header">
          <h2>My Predictions</h2>
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({predictions.length})
            </button>
            <button
              className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              Active ({predictions.filter(p => p.status === 'active').length})
            </button>
            <button
              className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Completed ({predictions.filter(p => p.status !== 'active').length})
            </button>
          </div>
        </div>

        {filteredPredictions.length === 0 ? (
          <div className="empty-state">
            {filter === 'all' ? 'No predictions yet. Start trading!' : `No ${filter} predictions.`}
          </div>
        ) : (
          <table className="account-predictions-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Timeframe</th>
                <th>Staked</th>
                <th>Status</th>
                <th>Progress</th>
                <th>MSPE</th>
                <th>Payoff</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPredictions.map(pred => (
                <tr
                  key={pred.id}
                  className={pred.status !== 'active' ? 'clickable-row' : ''}
                  onClick={() => pred.status !== 'active' && setSelectedTradeId(pred.id)}
                >
                  <td className="asset-cell">
                    <Link
                      to={`/?symbol=${pred.symbol}`}
                      className="asset-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {pred.symbol}
                    </Link>
                  </td>
                  <td>{TIMEFRAME_LABELS[pred.timeframe] || pred.timeframe}</td>
                  <td>{pred.stakedTokens?.toLocaleString() || '-'}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(pred.status)}`}>
                      {STATUS_LABELS[pred.status] || pred.status}
                    </span>
                  </td>
                  <td>
                    {pred.status === 'active' && pred.progress !== null ? (
                      <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${Math.min(pred.progress, 100)}%` }} />
                        <span className="progress-text">{pred.progress.toFixed(0)}%</span>
                      </div>
                    ) : pred.status === 'completed' ? '100%' : 'Closed'}
                  </td>
                  <td className="mspe-cell">{pred.mspe?.toFixed(4) || '-'}</td>
                  <td className="payoff-cell">
                    {pred.status === 'active' ? (
                      <span className="payoff-estimate">~{pred.estimatedPayoff?.toLocaleString() || '-'}</span>
                    ) : (
                      <span className="payoff-final">{pred.rewardsEarned?.toLocaleString() || 0}</span>
                    )}
                  </td>
                  <td className="date-cell">{formatLocalDate(pred.createdAt)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {pred.status === 'active' && pred.progress >= 5 && (
                      <button
                        className="close-btn"
                        onClick={() => handleClosePosition(pred.id, pred.startPrice)}
                        disabled={closingId === pred.id}
                      >
                        {closingId === pred.id ? '...' : 'Close'}
                      </button>
                    )}
                    {pred.status !== 'active' && (
                      <button
                        className="view-btn"
                        onClick={() => setSelectedTradeId(pred.id)}
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Account Info */}
      <div className="account-info">
        <h3>Account Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Email</span>
            <span className="info-value">{stats?.user?.email}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Member Since</span>
            <span className="info-value">{formatLocalDate(stats?.user?.createdAt)}</span>
          </div>
        </div>
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
