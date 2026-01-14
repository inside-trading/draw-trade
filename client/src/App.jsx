import React, { useState, useEffect, useCallback, useMemo } from 'react'
import SearchBar from './components/SearchBar'
import PriceChart from './components/PriceChart'
import DrawingCanvas from './components/DrawingCanvas'
import axios from 'axios'

const TIMEFRAMES = [
  { id: 'hourly', label: 'Hourly', interval: '1m', lookback: '1d' },
  { id: 'daily', label: 'Daily', interval: '5m', lookback: '5d' },
  { id: 'weekly', label: 'Weekly', interval: '1h', lookback: '1mo' },
  { id: 'monthly', label: 'Monthly', interval: '1d', lookback: '6mo' },
  { id: 'yearly', label: 'Yearly', interval: '1d', lookback: '1y' }
]

function App() {
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [timeframe, setTimeframe] = useState('daily')
  const [priceData, setPriceData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [predictions, setPredictions] = useState([])
  const [averagePrediction, setAveragePrediction] = useState([])
  const [predictionCount, setPredictionCount] = useState(0)
  const [chartBounds, setChartBounds] = useState(null)
  const [sentimentSlider, setSentimentSlider] = useState(50)

  const displayBounds = useMemo(() => {
    if (!chartBounds) return null
    
    const currentPrice = chartBounds.lastPrice
    const historicalRange = chartBounds.maxPrice - chartBounds.minPrice
    const basePadding = historicalRange * 0.15
    const extraExpansion = historicalRange * 0.35
    
    const sliderNormalized = (sentimentSlider - 50) / 50
    
    const upside = basePadding + extraExpansion * Math.max(0, sliderNormalized)
    const downside = basePadding + extraExpansion * Math.max(0, -sliderNormalized)
    
    return {
      min: Math.max(0, currentPrice - (currentPrice - chartBounds.minPrice) - downside),
      max: currentPrice + (chartBounds.maxPrice - currentPrice) + upside
    }
  }, [chartBounds, sentimentSlider])

  const fetchPriceData = useCallback(async (symbol, tf) => {
    setLoading(true)
    setError(null)
    try {
      const config = TIMEFRAMES.find(t => t.id === tf)
      const response = await axios.get(`/api/prices/${symbol}`, {
        params: {
          interval: config.interval,
          period: config.lookback
        }
      })
      setPriceData(response.data.prices)
      setChartBounds({
        minPrice: response.data.minPrice,
        maxPrice: response.data.maxPrice,
        lastPrice: response.data.lastPrice,
        lastTimestamp: response.data.lastTimestamp
      })
    } catch (err) {
      setError('Failed to fetch price data. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPredictions = useCallback(async (symbol, tf) => {
    try {
      const response = await axios.get(`/api/predictions/${symbol}`, {
        params: { timeframe: tf }
      })
      setPredictions(response.data.predictions || [])
      setAveragePrediction(response.data.average || [])
      setPredictionCount(response.data.count || 0)
    } catch (err) {
      console.error('Failed to fetch predictions:', err)
    }
  }, [])

  useEffect(() => {
    if (selectedAsset) {
      fetchPriceData(selectedAsset.symbol, timeframe)
      fetchPredictions(selectedAsset.symbol, timeframe)
    }
  }, [selectedAsset, timeframe, fetchPriceData, fetchPredictions])

  const handleAssetSelect = (asset) => {
    setSelectedAsset(asset)
    setPriceData([])
    setPredictions([])
    setAveragePrediction([])
    setSentimentSlider(50)
  }

  const handleTimeframeChange = (tf) => {
    setTimeframe(tf)
    setPredictions([])
    setAveragePrediction([])
  }

  const handlePredictionSubmit = async (drawnPoints, canvasDimensions) => {
    if (!selectedAsset || drawnPoints.length === 0) return
    
    try {
      const response = await axios.post('/api/predictions', {
        symbol: selectedAsset.symbol,
        timeframe: timeframe,
        points: drawnPoints,
        chartBounds: chartBounds,
        canvasDimensions: canvasDimensions
      })
      
      await fetchPredictions(selectedAsset.symbol, timeframe)
      return response.data
    } catch (err) {
      console.error('Failed to submit prediction:', err)
      throw err
    }
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>Draw Trade</h1>
        <p>Draw your price predictions and see how they compare</p>
      </header>

      <div className="controls-section">
        <SearchBar onSelect={handleAssetSelect} selectedAsset={selectedAsset} />
        
        <div className="timeframe-buttons">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.id}
              className={`timeframe-btn ${timeframe === tf.id ? 'active' : ''}`}
              onClick={() => handleTimeframeChange(tf.id)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="prediction-controls">
        <div className="sentiment-slider-container">
          <div className="sentiment-labels">
            <span className="bearish-label">Bearish</span>
            <span className="sentiment-value">
              {sentimentSlider < 30 ? 'Very Bearish' : 
               sentimentSlider < 45 ? 'Bearish' : 
               sentimentSlider <= 55 ? 'Neutral' : 
               sentimentSlider <= 70 ? 'Bullish' : 'Very Bullish'}
            </span>
            <span className="bullish-label">Bullish</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={sentimentSlider}
            onChange={(e) => setSentimentSlider(parseInt(e.target.value))}
            className="sentiment-slider"
            disabled={!selectedAsset || priceData.length === 0}
          />
          <div className="price-range-display">
            <span>${displayBounds?.min?.toFixed(2) || '0.00'}</span>
            <span>${displayBounds?.max?.toFixed(2) || '100.00'}</span>
          </div>
        </div>
      </div>

      <div className="chart-section">
        <div className="price-chart-container">
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
            </div>
          )}
          {selectedAsset ? (
            <PriceChart 
              data={priceData} 
              symbol={selectedAsset.symbol}
              timeframe={timeframe}
              displayBounds={displayBounds}
            />
          ) : (
            <div className="no-data">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.5 18.5l6-6 4 4L22 6.92 20.59 5.5l-7.09 8-4-4L2 17l1.5 1.5z"/>
              </svg>
              <p>Select an asset to view price chart</p>
            </div>
          )}
        </div>

        <DrawingCanvas 
          enabled={selectedAsset !== null && priceData.length > 0}
          chartBounds={chartBounds}
          displayBounds={displayBounds}
          averagePrediction={averagePrediction}
          onSubmit={handlePredictionSubmit}
          timeframe={timeframe}
        />
      </div>

      {selectedAsset && chartBounds && (
        <div className="info-bar">
          <div className="info-item">
            <div className="label">Asset</div>
            <div className="value">{selectedAsset.symbol}</div>
          </div>
          <div className="info-item">
            <div className="label">Current Price</div>
            <div className="value">${chartBounds.lastPrice?.toFixed(2)}</div>
          </div>
          <div className="info-item">
            <div className="label">Timeframe</div>
            <div className="value">{TIMEFRAMES.find(t => t.id === timeframe)?.label}</div>
          </div>
          <div className="info-item predictions-count">
            <div className="label">Community Predictions</div>
            <div className="value">{predictionCount}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
