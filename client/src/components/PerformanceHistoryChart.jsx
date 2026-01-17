import React, { useMemo, memo } from 'react'
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

function PerformanceHistoryChart({ history, metric = 'tokenBalance' }) {
  const chartData = useMemo(() => {
    if (!history || history.length === 0) {
      return { labels: [], datasets: [] }
    }

    const metricConfigs = {
      tokenBalance: {
        label: 'Token Balance',
        color: '#00d4ff',
        format: (v) => v.toLocaleString()
      },
      profitLoss: {
        label: 'Profit/Loss',
        color: '#10b981',
        format: (v) => (v >= 0 ? '+' : '') + v.toLocaleString()
      },
      timeWeightedMspe: {
        label: 'TW-MSPE',
        color: '#f59e0b',
        format: (v) => v?.toFixed(4) || '-'
      },
      rank: {
        label: 'Rank',
        color: '#8b5cf6',
        format: (v) => '#' + v
      }
    }

    const config = metricConfigs[metric] || metricConfigs.tokenBalance

    return {
      labels: history.map(h => new Date(h.recordedAt)),
      datasets: [
        {
          label: config.label,
          data: history.map(h => h[metric]),
          borderColor: config.color,
          backgroundColor: config.color.replace(')', ', 0.1)').replace('rgb', 'rgba'),
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.3
        }
      ]
    }
  }, [history, metric])

  const options = useMemo(() => {
    const isRank = metric === 'rank'

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 300
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
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
              const value = context.parsed.y
              if (metric === 'tokenBalance' || metric === 'profitLoss') {
                return `${context.dataset.label}: ${value.toLocaleString()}`
              }
              if (metric === 'rank') {
                return `${context.dataset.label}: #${value}`
              }
              return `${context.dataset.label}: ${value?.toFixed(4) || '-'}`
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
            displayFormats: {
              day: 'MMM d'
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
          reverse: isRank, // Lower rank = better, so reverse for rank
          grid: {
            color: 'rgba(45, 55, 72, 0.5)',
            drawBorder: false
          },
          ticks: {
            color: '#8892b0',
            callback: function(value) {
              if (isRank) return '#' + value
              if (metric === 'timeWeightedMspe' || metric === 'meanMspe') {
                return value.toFixed(4)
              }
              return value.toLocaleString()
            }
          }
        }
      }
    }
  }, [metric])

  if (!history || history.length === 0) {
    return (
      <div className="no-history-message">
        <p>No performance history yet. History is recorded daily.</p>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <Line data={chartData} options={options} />
    </div>
  )
}

export default memo(PerformanceHistoryChart)
