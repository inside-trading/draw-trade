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

function PriceChart({ data, symbol, timeframe, displayBounds }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return { labels: [], datasets: [] }
    }

    return {
      labels: data.map(d => new Date(d.timestamp)),
      datasets: [
        {
          label: symbol,
          data: data.map(d => d.close),
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0, 212, 255, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.1
        }
      ]
    }
  }, [data, symbol])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: `${symbol} Price Chart`,
        color: '#e0e0e0',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(26, 32, 44, 0.95)',
        titleColor: '#00d4ff',
        bodyColor: '#e0e0e0',
        borderColor: '#2d3748',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: function(context) {
            return `$${context.parsed.y.toFixed(2)}`
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeframe === 'hourly' ? 'minute' : 
                timeframe === 'daily' ? 'hour' : 
                timeframe === 'weekly' ? 'day' : 
                timeframe === 'monthly' ? 'week' : 'month',
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
        min: displayBounds ? displayBounds.min : undefined,
        max: displayBounds ? displayBounds.max : undefined,
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
  }), [symbol, timeframe, displayBounds])

  if (!data || data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8892b0' }}>
        Loading price data...
      </div>
    )
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <Line data={chartData} options={options} />
    </div>
  )
}

export default memo(PriceChart)
