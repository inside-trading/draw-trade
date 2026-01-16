import React, { useState, useEffect, useCallback } from 'react'
import api from '../config/api'

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

export default function PredictionsTable({ currentSymbol, onAssetClick, currentUserId, currentPrice, onRefreshAuth }) {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [closingId, setClosingId] = useState(null)

  const [filters, setFilters] = useState({
    symbol: '',
    timeframe: '',
    user_id: ''
  })
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')

  const fetchPredictions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = {
        page,
        per_page: 15,
        sort_by: sortBy,
        sort_order: sortOrder
      }

      if (filters.symbol) params.symbol = filters.symbol
      if (filters.timeframe) params.timeframe = filters.timeframe
      if (filters.user_id) params.user_id = filters.user_id

      const response = await api.get('/api/predictions/all', { params })
      setPredictions(response.data.predictions)
      setTotalPages(response.data.pages)
      setTotal(response.data.total)
    } catch (err) {
      setError('Failed to load predictions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, filters, sortBy, sortOrder])

  useEffect(() => {
    fetchPredictions()
  }, [fetchPredictions])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchPredictions, 30000)
    return () => clearInterval(interval)
  }, [fetchPredictions])

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
    setPage(1)
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleClosePosition = async (predictionId, priceToUse) => {
    if (!priceToUse) {
      alert('Current price not available. Please try again.')
      return
    }

    if (!window.confirm('Are you sure you want to close this position early? You will receive a prorated payoff.')) {
      return
    }

    setClosingId(predictionId)
    try {
      const response = await api.post(`/api/predictions/${predictionId}/close`, {
        currentPrice: priceToUse
      }, { withCredentials: true })

      if (response.data.success) {
        alert(`Position closed! Payoff: ${response.data.payoff} tokens`)
        fetchPredictions()
        if (onRefreshAuth) onRefreshAuth()
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to close position'
      alert(message)
    } finally {
      setClosingId(null)
    }
  }

  const formatDate = (isoString) => {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatPrice = (price) => {
    if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    return `$${price.toFixed(2)}`
  }

  const formatPayoff = (payoff) => {
    if (payoff === null || payoff === undefined) return '-'
    return payoff.toLocaleString()
  }

  const getPriceChange = (start, end) => {
    const change = ((end - start) / start) * 100
    const sign = change >= 0 ? '+' : ''
    return { value: `${sign}${change.toFixed(1)}%`, isPositive: change >= 0 }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'active': return 'status-active'
      case 'completed': return 'status-completed'
      case 'closed': return 'status-closed'
      default: return ''
    }
  }

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <span className="sort-icon">⇅</span>
    return <span className="sort-icon active">{sortOrder === 'desc' ? '↓' : '↑'}</span>
  }

  return (
    <div className="predictions-table-container">
      <div className="table-header">
        <h2>Community Predictions</h2>
        <span className="prediction-count">{total} predictions</span>
      </div>

      <div className="table-filters">
        <input
          type="text"
          placeholder="Filter by symbol..."
          value={filters.symbol}
          onChange={(e) => handleFilterChange('symbol', e.target.value.toUpperCase())}
          className="filter-input"
        />
        <select
          value={filters.timeframe}
          onChange={(e) => handleFilterChange('timeframe', e.target.value)}
          className="filter-select"
        >
          <option value="">All Timeframes</option>
          {Object.entries(TIMEFRAME_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={filters.user_id ? 'mine' : ''}
          onChange={(e) => handleFilterChange('user_id', e.target.value === 'mine' ? currentUserId : '')}
          className="filter-select"
        >
          <option value="">All Users</option>
          {currentUserId && <option value="mine">My Predictions</option>}
        </select>
        <button
          onClick={() => {
            setFilters({ symbol: '', timeframe: '', user_id: '' })
            setPage(1)
          }}
          className="clear-filters-btn"
        >
          Clear
        </button>
      </div>

      {loading ? (
        <div className="table-loading">Loading predictions...</div>
      ) : error ? (
        <div className="table-error">{error}</div>
      ) : predictions.length === 0 ? (
        <div className="table-empty">No predictions found</div>
      ) : (
        <>
          <table className="predictions-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('symbol')}>
                  Asset <SortIcon column="symbol" />
                </th>
                <th>User</th>
                <th onClick={() => handleSort('timeframe')}>
                  Timeframe <SortIcon column="timeframe" />
                </th>
                <th onClick={() => handleSort('staked_tokens')}>
                  Staked <SortIcon column="staked_tokens" />
                </th>
                <th>Status</th>
                <th>Progress</th>
                <th onClick={() => handleSort('accuracy_score')}>
                  MSPE <SortIcon column="accuracy_score" />
                </th>
                <th>Est. Payoff</th>
                <th onClick={() => handleSort('created_at')}>
                  Date <SortIcon column="created_at" />
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((pred) => {
                const isOwn = currentUserId && pred.userId === currentUserId
                const canClose = isOwn && pred.status === 'active' && pred.progress >= 5

                return (
                  <tr key={pred.id} className={isOwn ? 'own-prediction' : ''}>
                    <td>
                      <button
                        className="asset-link"
                        onClick={() => onAssetClick?.(pred.symbol, pred.assetName)}
                      >
                        {pred.symbol}
                      </button>
                    </td>
                    <td className="user-cell">{pred.userName}</td>
                    <td>{TIMEFRAME_LABELS[pred.timeframe] || pred.timeframe}</td>
                    <td>{pred.stakedTokens > 0 ? pred.stakedTokens.toLocaleString() : '-'}</td>
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
                      ) : pred.status === 'completed' ? (
                        <span className="progress-complete">100%</span>
                      ) : pred.status === 'closed' ? (
                        <span className="progress-closed">Closed</span>
                      ) : '-'}
                    </td>
                    <td className="mspe-cell">
                      {pred.mspe !== null ? pred.mspe.toFixed(4) : '-'}
                    </td>
                    <td className="payoff-cell">
                      {pred.status === 'completed' || pred.status === 'closed' ? (
                        <span className="payoff-final">{formatPayoff(pred.rewardsEarned)}</span>
                      ) : (
                        <span className="payoff-estimate">~{formatPayoff(pred.estimatedPayoff)}</span>
                      )}
                    </td>
                    <td className="date-cell">{formatDate(pred.createdAt)}</td>
                    <td>
                      {canClose && (
                        <button
                          className="close-btn"
                          onClick={() => handleClosePosition(pred.id, currentPrice || pred.startPrice)}
                          disabled={closingId === pred.id}
                        >
                          {closingId === pred.id ? '...' : 'Close'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="table-pagination">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="pagination-btn"
              >
                Previous
              </button>
              <span className="page-info">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
