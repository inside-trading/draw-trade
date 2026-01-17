import React, { useState, useEffect, useMemo, memo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'
import api from '../config/api'
import { formatLocalDate } from '../utils/dateUtils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
)

const TIMEFRAME_LABELS = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly'
}

function TradeDetailModal({ tradeId, onClose }) {
  const [trade, setTrade] = useState(null)
  const [predictionSeries, setPredictionSeries] = useState([])
  const [actualPrices, setActualPrices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchTradeDetails = async () => {
      if (!tradeId) return

      setLoading(true)
      try {
        const response = await api.get(`/api/trades/${tradeId}/details`)
        setTrade(response.data.trade)
        setPredictionSeries(response.data.predictionSeries)
        setActualPrices(response.data.actualPrices)
        setError(null)
      } catch (err) {
        setError('Failed to load trade details')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchTradeDetails()
  }, [tradeId])

  const chartData = useMemo(() => {
    if (!predictionSeries.length) {
      return { labels: [], datasets: [] }
    }

    const predictionData = predictionSeries.map(p => ({
      x: new Date(p.timestamp),
      y: p.price
    }))

    const actualData = actualPrices.map(p => ({
      x: new Date(p.timestamp),
      y: p.price
    }))

    return {
      datasets: [
        {
          label: 'Prediction',
          data: predictionData,
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0, 212, 255, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.1,
          borderDash: [5, 5]
        },
        {
          label: 'Actual Price',
          data: actualData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.1
        }
      ]
    }
  }, [predictionSeries, actualPrices])

  const chartOptions = useMemo(() => {
    // Calculate min/max from both series
    const allPrices = [
      ...predictionSeries.map(p => p.price),
      ...actualPrices.map(p => p.price)
    ]
    const minPrice = allPrices.length ? Math.min(...allPrices) : 0
    const maxPrice = allPrices.length ? Math.max(...allPrices) : 100
    const padding = (maxPrice - minPrice) * 0.1

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#e0e0e0',
            usePointStyle: true
          }
        },
        title: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(26, 32, 44, 0.95)',
          titleColor: '#00d4ff',
          bodyColor: '#e0e0e0',
          borderColor: '#2d3748',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            displayFormats: {
              minute: 'HH:mm',
              hour: 'HH:mm',
              day: 'MMM d',
              week: 'MMM d',
              month: 'MMM yyyy'
            }
          },
          grid: {
            color: 'rgba(45, 55, 72, 0.5)',
            drawBorder: false
          },
          ticks: {
            color: '#8892b0',
            maxTicksLimit: 8
          }
        },
        y: {
          position: 'right',
          min: minPrice - padding,
          max: maxPrice + padding,
          grid: {
            color: 'rgba(45, 55, 72, 0.5)',
            drawBorder: false
          },
          ticks: {
            color: '#8892b0',
            callback: function(value) {
              return '$' + value.toFixed(2)
            }
          }
        }
      }
    }
  }, [predictionSeries, actualPrices])

  if (!tradeId) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content trade-detail-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>

        {loading ? (
          <div className="loading-state">Loading trade details...</div>
        ) : error ? (
          <div className="error-state">{error}</div>
        ) : trade ? (
          <>
            <div className="modal-header">
              <h2>{trade.symbol} Prediction</h2>
              <span className={`status-badge status-${trade.status}`}>
                {trade.status === 'completed' ? 'Completed' :
                 trade.status === 'closed' ? 'Closed Early' : 'Active'}
              </span>
            </div>

            <div className="trade-info-grid">
              <div className="trade-info-item">
                <span className="info-label">Trader</span>
                <span className="info-value">{trade.userName}</span>
              </div>
              <div className="trade-info-item">
                <span className="info-label">Timeframe</span>
                <span className="info-value">{TIMEFRAME_LABELS[trade.timeframe]}</span>
              </div>
              <div className="trade-info-item">
                <span className="info-label">MSPE</span>
                <span className="info-value mspe-value">{trade.mspe?.toFixed(4) || '-'}</span>
              </div>
              <div className="trade-info-item">
                <span className="info-label">Staked</span>
                <span className="info-value">{trade.stakedTokens?.toLocaleString()} tokens</span>
              </div>
              <div className="trade-info-item">
                <span className="info-label">Rewards</span>
                <span className="info-value">{trade.rewardsEarned?.toLocaleString() || 0} tokens</span>
              </div>
              <div className="trade-info-item">
                <span className="info-label">Profit</span>
                <span className={`info-value ${(trade.profit || 0) >= 0 ? 'positive' : 'negative'}`}>
                  {(trade.profit || 0) >= 0 ? '+' : ''}{trade.profit?.toLocaleString() || 0} tokens
                </span>
              </div>
              <div className="trade-info-item">
                <span className="info-label">Created</span>
                <span className="info-value">{formatLocalDate(trade.createdAt)}</span>
              </div>
              {trade.status === 'active' && (
                <div className="trade-info-item">
                  <span className="info-label">Progress</span>
                  <span className="info-value">{trade.progress}%</span>
                </div>
              )}
            </div>

            <div className="chart-section">
              <h3>Prediction vs Actual Price</h3>
              <div className="chart-container" style={{ height: '300px' }}>
                {predictionSeries.length > 0 ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <div className="no-data-message">No price data available</div>
                )}
              </div>
              {actualPrices.length === 0 && predictionSeries.length > 0 && (
                <p className="chart-note">Actual price data will appear as the prediction progresses.</p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default memo(TradeDetailModal)
