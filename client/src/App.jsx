import React, { useState, useEffect, useCallback, useMemo } from 'react'
import SearchBar from './components/SearchBar'
import PriceChart from './components/PriceChart'
import DrawingCanvas from './components/DrawingCanvas'
import AuthHeader from './components/AuthHeader'
import PredictionsTable from './components/PredictionsTable'
import InstructionsPanel from './components/InstructionsPanel'
import ScoringPanel from './components/ScoringPanel'
import { useAuth } from './hooks/useAuth'
import api from './config/api'

const TIMEFRAMES = [
  { id: 'hourly', label: 'Hourly', interval: '1m', lookback: '1d' },
  { id: 'daily', label: 'Daily', interval: '5m', lookback: '5d' },
  { id: 'weekly', label: 'Weekly', interval: '1h', lookback: '1mo' },
  { id: 'monthly', label: 'Monthly', interval: '1d', lookback: '6mo' },
  { id: 'yearly', label: 'Yearly', interval: '1d', lookback: '1y' }
]

const PRICE_POLL_INTERVAL = 30000

function App() {
  const { user, isLoading: authLoading, isAuthenticated, refetch: refetchAuth, login, register, logout, error: authError, clearError } = useAuth()
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
  const [customMin, setCustomMin] = useState('')
  const [customMax, setCustomMax] = useState('')
  const [stakedTokens, setStakedTokens] = useState(0)
  const [predictionsTableKey, setPredictionsTableKey] = useState(0)
  const [userPrediction, setUserPrediction] = useState(null)
  const [liveScore, setLiveScore] = useState(null)

  const displayBounds = useMemo(() => {
    if (!chartBounds) return null
    
    const currentPrice = chartBounds.lastPrice
    const historicalRange = chartBounds.maxPrice - chartBounds.minPrice
    const basePadding = historicalRange * 0.15
    const extraExpansion = historicalRange * 0.35
    
    const sliderNormalized = (sentimentSlider - 50) / 50
    
    const upside = basePadding + extraExpansion * Math.max(0, sliderNormalized)
    const downside = basePadding + extraExpansion * Math.max(0, -sliderNormalized)
    
    let min = Math.max(0, currentPrice - (currentPrice - chartBounds.minPrice) - downside)
    let max = currentPrice + (chartBounds.maxPrice - currentPrice) + upside
    
    if (customMin !== '' && !isNaN(parseFloat(customMin))) {
      min = Math.max(0, parseFloat(customMin))
    }
    if (customMax !== '' && !isNaN(parseFloat(customMax))) {
      max = parseFloat(customMax)
    }
    
    if (max <= min) {
      max = min + historicalRange * 0.1
    }
    
    return { min, max }
  }, [chartBounds, sentimentSlider, customMin, customMax])

  const fetchPriceData = useCallback(async (symbol, tf) => {
    setLoading(true)
    setError(null)
    try {
      const config = TIMEFRAMES.find(t => t.id === tf)
      const response = await api.get(`/api/prices/${symbol}`, {
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
      const response = await api.get(`/api/predictions/${symbol}`, {
        params: { timeframe: tf }
      })
      setPredictions(response.data.predictions || [])
      setAveragePrediction(response.data.average || [])
      setPredictionCount(response.data.count || 0)
    } catch (err) {
      console.error('Failed to fetch predictions:', err)
    }
  }, [])

  const fetchUserPrediction = useCallback(async (symbol, tf) => {
    if (!isAuthenticated) {
      setUserPrediction(null)
      return
    }
    try {
      const response = await api.get(`/api/user/prediction/${symbol}`, {
        params: { timeframe: tf },
        withCredentials: true
      })
      if (response.data.prediction) {
        setUserPrediction(response.data.prediction.priceSeries)
        setLiveScore({
          mspe: response.data.prediction.accuracyScore,
          status: response.data.prediction.status,
          predictionId: response.data.prediction.id,
          nTotal: response.data.prediction.priceSeries?.length || 0
        })
      } else {
        setUserPrediction(null)
        setLiveScore(null)
      }
    } catch (err) {
      console.error('Failed to fetch user prediction:', err)
      setUserPrediction(null)
    }
  }, [isAuthenticated])

  const updateScore = useCallback(async () => {
    if (!liveScore?.predictionId || !chartBounds?.lastPrice) return
    try {
      const response = await api.post(`/api/predictions/${liveScore.predictionId}/score`, {
        currentPrice: chartBounds.lastPrice
      })
      setLiveScore(prev => ({
        ...prev,
        mspe: response.data.mspe,
        status: response.data.status,
        progress: response.data.progress,
        nElapsed: response.data.nElapsed,
        nTotal: response.data.nTotal
      }))
    } catch (err) {
      console.error('Failed to update score:', err)
    }
  }, [liveScore?.predictionId, chartBounds?.lastPrice])

  useEffect(() => {
    if (selectedAsset) {
      fetchPriceData(selectedAsset.symbol, timeframe)
      fetchPredictions(selectedAsset.symbol, timeframe)
      fetchUserPrediction(selectedAsset.symbol, timeframe)
    }
  }, [selectedAsset, timeframe, fetchPriceData, fetchPredictions, fetchUserPrediction])

  useEffect(() => {
    if (!selectedAsset) return
    
    const pollInterval = setInterval(() => {
      fetchPriceData(selectedAsset.symbol, timeframe)
      if (liveScore?.predictionId) {
        updateScore()
      }
    }, PRICE_POLL_INTERVAL)
    
    return () => clearInterval(pollInterval)
  }, [selectedAsset, timeframe, fetchPriceData, liveScore?.predictionId, updateScore])

  const handleAssetSelect = (asset) => {
    setSelectedAsset(asset)
    setPriceData([])
    setPredictions([])
    setAveragePrediction([])
    setSentimentSlider(50)
    setCustomMin('')
    setCustomMax('')
    setUserPrediction(null)
    setLiveScore(null)
  }

  const handleTimeframeChange = (tf) => {
    setTimeframe(tf)
    setPredictions([])
    setAveragePrediction([])
  }

  const handlePredictionSubmit = async (drawnPoints, canvasDimensions) => {
    if (!selectedAsset || drawnPoints.length === 0) return
    
    try {
      const response = await api.post('/api/predictions', {
        symbol: selectedAsset.symbol,
        assetName: selectedAsset.name,
        timeframe: timeframe,
        points: drawnPoints,
        chartBounds: chartBounds,
        canvasDimensions: canvasDimensions,
        stakedTokens: stakedTokens
      }, { withCredentials: true })
      
      await fetchPredictions(selectedAsset.symbol, timeframe)
      setPredictionsTableKey(k => k + 1)
      setStakedTokens(0)
      refetchAuth()
      return response.data
    } catch (err) {
      console.error('Failed to submit prediction:', err)
      throw err
    }
  }

  const handleAssetFromTable = (symbol, assetName) => {
    setSelectedAsset({ symbol, name: assetName || symbol })
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <div className="header-text">
            <h1>Draw Trade</h1>
            <p>Draw your price predictions and see how they compare</p>
          </div>
          <AuthHeader
            user={user}
            isAuthenticated={isAuthenticated}
            isLoading={authLoading}
            onLogin={login}
            onRegister={register}
            onLogout={logout}
            error={authError}
            onClearError={clearError}
          />
        </div>
      </header>

      <InstructionsPanel />

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
            onChange={(e) => {
              setSentimentSlider(parseInt(e.target.value))
              setCustomMin('')
              setCustomMax('')
            }}
            className="sentiment-slider"
            disabled={!selectedAsset || priceData.length === 0}
          />
          <div className="price-inputs">
            <div className="price-input-group">
              <label>Min $</label>
              <input
                type="number"
                value={customMin !== '' ? customMin : (displayBounds?.min?.toFixed(2) || '')}
                onChange={(e) => setCustomMin(e.target.value)}
                onBlur={() => {
                  if (customMin !== '' && !isNaN(parseFloat(customMin))) {
                    setCustomMin(parseFloat(customMin).toFixed(2))
                  }
                }}
                className="price-text-input"
                disabled={!selectedAsset || priceData.length === 0}
                step="0.01"
                placeholder="Auto"
              />
            </div>
            <div className="price-input-group">
              <label>Max $</label>
              <input
                type="number"
                value={customMax !== '' ? customMax : (displayBounds?.max?.toFixed(2) || '')}
                onChange={(e) => setCustomMax(e.target.value)}
                onBlur={() => {
                  if (customMax !== '' && !isNaN(parseFloat(customMax))) {
                    setCustomMax(parseFloat(customMax).toFixed(2))
                  }
                }}
                className="price-text-input"
                disabled={!selectedAsset || priceData.length === 0}
                step="0.01"
                placeholder="Auto"
              />
            </div>
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
          isAuthenticated={isAuthenticated}
          userTokenBalance={user?.tokenBalance || 0}
          stakedTokens={stakedTokens}
          onStakeChange={setStakedTokens}
          userPrediction={userPrediction}
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
          {liveScore && (
            <div className="info-item live-score">
              <div className="label">Your MSPE</div>
              <div className={`value ${liveScore.mspe !== null && liveScore.mspe < 10 ? 'up' : 'down'}`}>
                {liveScore.mspe !== null ? liveScore.mspe.toFixed(4) : '-'}
                {liveScore.progress && <span className="progress-indicator"> ({liveScore.progress}%)</span>}
              </div>
            </div>
          )}
          <div className="info-item predictions-count">
            <div className="label">Community Predictions</div>
            <div className="value">{predictionCount}</div>
          </div>
        </div>
      )}

      <PredictionsTable
        key={predictionsTableKey}
        currentSymbol={selectedAsset?.symbol}
        onAssetClick={handleAssetFromTable}
        currentUserId={user?.id}
        currentPrice={chartBounds?.lastPrice}
        onRefreshAuth={refetchAuth}
      />

      <ScoringPanel />
    </div>
  )
}

export default App
