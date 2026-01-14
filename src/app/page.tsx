'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { TimeWindow, PricePoint, DrawingPoint, Prediction } from '@/types'
import TimeWindowSelector from '@/components/TimeWindowSelector'
import { v4 as uuidv4 } from 'uuid'

// Dynamic import for chart component (requires browser APIs)
const PriceChartWithDrawing = dynamic(
  () => import('@/components/PriceChartWithDrawing'),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

function ChartSkeleton() {
  return (
    <div className="w-full h-[400px] bg-chart-bg rounded-lg border border-slate-700 animate-pulse flex items-center justify-center">
      <div className="text-slate-500">Loading chart...</div>
    </div>
  )
}

// Get or create visitor ID
function getVisitorId(): string {
  if (typeof window === 'undefined') return ''

  let visitorId = localStorage.getItem('drawTradeVisitorId')
  if (!visitorId) {
    visitorId = uuidv4()
    localStorage.setItem('drawTradeVisitorId', visitorId)
  }
  return visitorId
}

export default function Home() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h')
  const [priceData, setPriceData] = useState<PricePoint[]>([])
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [visitorId, setVisitorId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activePrediction, setActivePrediction] = useState<Prediction | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Initialize visitor ID on client
  useEffect(() => {
    setVisitorId(getVisitorId())
  }, [])

  // Fetch historical price data
  const fetchPriceData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/btc/history?timeWindow=${timeWindow}`)
      const data = await response.json()

      if (data.success) {
        setPriceData(data.data)
      } else {
        setError('Failed to load price data')
      }
    } catch (err) {
      console.error('Error fetching price data:', err)
      setError('Failed to load price data')
    } finally {
      setIsLoading(false)
    }
  }, [timeWindow])

  // Fetch current price
  const fetchCurrentPrice = useCallback(async () => {
    try {
      const response = await fetch('/api/btc/price')
      const data = await response.json()

      if (data.success) {
        setCurrentPrice(data.price)
      }
    } catch (err) {
      console.error('Error fetching current price:', err)
    }
  }, [])

  // Fetch active prediction for visitor
  const fetchActivePrediction = useCallback(async () => {
    if (!visitorId) return

    // For now, we'll check via the prediction endpoint
    // In production, you'd have a dedicated endpoint
  }, [visitorId])

  // Initial data fetch
  useEffect(() => {
    fetchPriceData()
    fetchCurrentPrice()
  }, [fetchPriceData, fetchCurrentPrice])

  // Poll for current price every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchCurrentPrice, 30000)
    return () => clearInterval(interval)
  }, [fetchCurrentPrice])

  // Poll for prediction updates if there's an active prediction
  useEffect(() => {
    if (!activePrediction) return

    const pollPrediction = async () => {
      try {
        const response = await fetch(`/api/predictions/${activePrediction.id}`)
        const data = await response.json()

        if (data.success && data.prediction) {
          setActivePrediction(data.prediction)

          // Check if prediction is fully settled
          if (data.prediction.status === 'settled') {
            // Prediction complete - could show a summary
          }
        }
      } catch (err) {
        console.error('Error polling prediction:', err)
      }
    }

    // Poll every 10 seconds
    const interval = setInterval(pollPrediction, 10000)
    return () => clearInterval(interval)
  }, [activePrediction])

  // Handle time window change
  const handleTimeWindowChange = useCallback((window: TimeWindow) => {
    if (activePrediction) return // Don't allow changing while prediction is active
    setTimeWindow(window)
  }, [activePrediction])

  // Handle prediction submission
  const handleSubmitPrediction = useCallback(async (
    drawingPoints: DrawingPoint[],
    canvasWidth: number,
    canvasHeight: number,
    priceRangeMin: number,
    priceRangeMax: number
  ) => {
    if (!visitorId || drawingPoints.length < 2) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visitorId,
          timeWindow,
          drawingPoints,
          canvasWidth,
          canvasHeight,
          priceRangeMin,
          priceRangeMax,
        }),
      })

      const data = await response.json()

      if (data.success && data.prediction) {
        // Fetch the full prediction with points
        const fullResponse = await fetch(`/api/predictions/${data.prediction.id}`)
        const fullData = await fullResponse.json()

        if (fullData.success && fullData.prediction) {
          setActivePrediction(fullData.prediction)
        }
      } else {
        setError(data.error || 'Failed to submit prediction')
      }
    } catch (err) {
      console.error('Error submitting prediction:', err)
      setError('Failed to submit prediction')
    } finally {
      setIsSubmitting(false)
    }
  }, [visitorId, timeWindow])

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-amber-500">
                Draw Trade
              </h1>
              <p className="text-slate-400 text-sm">Predict Bitcoin&apos;s Future</p>
            </div>
            {error && (
              <div className="text-red-400 text-sm bg-red-400/10 px-3 py-1 rounded">
                {error}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Time Window Selector */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-white mb-2">Historical View</h2>
            <TimeWindowSelector
              selected={timeWindow}
              onChange={handleTimeWindowChange}
              disabled={!!activePrediction}
            />
          </div>
          {activePrediction && (
            <div className="text-right">
              <span className="text-slate-400 text-sm">Prediction Status</span>
              <div className={`text-lg font-medium ${
                activePrediction.status === 'settled' ? 'text-emerald-500' : 'text-amber-500'
              }`}>
                {activePrediction.status === 'settled' ? 'Settled' : 'Active'}
              </div>
            </div>
          )}
        </div>

        {/* Chart Area */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <PriceChartWithDrawing
            timeWindow={timeWindow}
            priceData={priceData}
            onSubmitPrediction={handleSubmitPrediction}
            isSubmitting={isSubmitting}
            activePrediction={activePrediction}
            currentPrice={currentPrice}
          />
        )}

        {/* Instructions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                1
              </div>
              <h3 className="font-medium text-white">Choose Timeframe</h3>
            </div>
            <p className="text-slate-400 text-sm">
              Select how much historical data to view. Your prediction window scales accordingly.
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                2
              </div>
              <h3 className="font-medium text-white">Draw Prediction</h3>
            </div>
            <p className="text-slate-400 text-sm">
              Draw your prediction on the canvas. The closer you predict, the higher your score.
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                3
              </div>
              <h3 className="font-medium text-white">Watch Results</h3>
            </div>
            <p className="text-slate-400 text-sm">
              Your score increases as the actual price matches your prediction. Check back to see results!
            </p>
          </div>
        </div>

        {/* Scoring Explanation */}
        <div className="mt-8 bg-slate-800/30 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-medium text-white mb-3">How Scoring Works</h3>
          <p className="text-slate-400 text-sm mb-4">
            Your prediction is converted into price points at regular intervals. As time passes,
            we compare your predicted price to the actual Bitcoin price at each point.
          </p>
          <div className="bg-slate-900 rounded p-4 font-mono text-sm text-slate-300">
            Score = 1 / (predicted_price - actual_price)²
          </div>
          <p className="text-slate-500 text-sm mt-3">
            The closer your prediction, the higher your score. Perfect predictions earn maximum points!
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm">
              draw.trade | doodle.trade | squiggle.trade
            </p>
            <p className="text-slate-600 text-sm">
              Predictions are for entertainment only. Not financial advice.
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
