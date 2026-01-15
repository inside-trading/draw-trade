import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const TIMEFRAME_LABELS = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly'
}

export default function PredictionsTable({ currentSymbol, onAssetClick }) {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  
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
      
      const response = await axios.get('/api/predictions/all', { params })
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

  const getPriceChange = (start, end) => {
    const change = ((end - start) / start) * 100
    const sign = change >= 0 ? '+' : ''
    return { value: `${sign}${change.toFixed(1)}%`, isPositive: change >= 0 }
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
        <input
          type="text"
          placeholder="Filter by user ID..."
          value={filters.user_id}
          onChange={(e) => handleFilterChange('user_id', e.target.value)}
          className="filter-input"
        />
        <button 
          onClick={() => {
            setFilters({ symbol: '', timeframe: '', user_id: '' })
            setPage(1)
          }}
          className="clear-filters-btn"
        >
          Clear Filters
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
                <th onClick={() => handleSort('start_price')}>
                  Start <SortIcon column="start_price" />
                </th>
                <th onClick={() => handleSort('end_price')}>
                  Target <SortIcon column="end_price" />
                </th>
                <th>Change</th>
                <th onClick={() => handleSort('staked_tokens')}>
                  Staked <SortIcon column="staked_tokens" />
                </th>
                <th onClick={() => handleSort('accuracy_score')}>
                  Score <SortIcon column="accuracy_score" />
                </th>
                <th onClick={() => handleSort('created_at')}>
                  Date <SortIcon column="created_at" />
                </th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((pred) => {
                const change = getPriceChange(pred.startPrice, pred.endPrice)
                return (
                  <tr key={pred.id}>
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
                    <td>{formatPrice(pred.startPrice)}</td>
                    <td>{formatPrice(pred.endPrice)}</td>
                    <td className={change.isPositive ? 'positive' : 'negative'}>
                      {change.value}
                    </td>
                    <td>{pred.stakedTokens > 0 ? pred.stakedTokens.toLocaleString() : '-'}</td>
                    <td className="score-cell">{pred.accuracyScore !== null ? pred.accuracyScore.toFixed(2) : '-'}</td>
                    <td className="date-cell">{formatDate(pred.createdAt)}</td>
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
