'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Asset, TimeWindow, PredictionPoint, AveragePrediction } from '@/types'
import AssetSearch from '@/components/AssetSearch'
import TimeWindowSelector from '@/components/TimeWindowSelector'
import { v4 as uuidv4 } from 'uuid'

// Dynamic import for chart component (requires browser APIs)
const PriceChartWithDrawing = dynamic(
  () => import('@/components/PriceChartWithDrawing'),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

function ChartSkeleton() {
  return (
    <div className="w-full h-[500px] bg-chart-bg rounded-lg border border-slate-700 animate-pulse flex items-center justify-center">
      <div className="text-slate-500">Loading chart...</div>
    </div>
  )
}

// Get or create session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  let sessionId = localStorage.getItem('drawTradeSessionId')
  if (!sessionId) {
    sessionId = uuidv4()
    localStorage.setItem('drawTradeSessionId', sessionId)
  }
  return sessionId
}

// Domain-specific branding
function getDomainBranding(): { name: string; tagline: string; color: string } {
  if (typeof window === 'undefined') {
    return { name: 'Draw Trade', tagline: 'Predict the Future', color: 'text-amber-500' }
  }

  const hostname = window.location.hostname

  if (hostname.includes('doodle')) {
    return {
      name: 'Doodle Trade',
      tagline: 'Sketch Your Success',
      color: 'text-purple-500',
    }
  }
  if (hostname.includes('squiggle')) {
    return {
      name: 'Squiggle Trade',
      tagline: 'Scribble to Profits',
      color: 'text-emerald-500',
    }
  }

  return {
    name: 'Draw Trade',
    tagline: 'Predict the Future',
    color: 'text-amber-500',
  }
}

export default function Home() {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('daily')
  const [averagePrediction, setAveragePrediction] = useState<AveragePrediction | null>(null)
  const [predictionCount, setPredictionCount] = useState(0)
  const [sessionId, setSessionId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmitMessage, setLastSubmitMessage] = useState<string>('')
  const [branding, setBranding] = useState(getDomainBranding())

  // Initialize session ID on client
  useEffect(() => {
    setSessionId(getSessionId())
    setBranding(getDomainBranding())
  }, [])

  // Fetch average prediction when asset or time window changes
  const fetchAveragePrediction = useCallback(async () => {
    if (!selectedAsset) return

    try {
      const response = await fetch(
        `/api/predictions?assetSymbol=${selectedAsset.symbol}&timeWindow=${timeWindow}`
      )
      const data = await response.json()

      if (data.averagePrediction) {
        setAveragePrediction(data.averagePrediction)
      } else {
        setAveragePrediction(null)
      }
      setPredictionCount(data.predictionCount || 0)
    } catch (error) {
      console.error('Error fetching average prediction:', error)
      setAveragePrediction(null)
      setPredictionCount(0)
    }
  }, [selectedAsset, timeWindow])

  useEffect(() => {
    fetchAveragePrediction()
  }, [fetchAveragePrediction])

  // Handle prediction submission
  const handlePredictionComplete = useCallback(async (points: PredictionPoint[]) => {
    if (!selectedAsset || !sessionId || points.length < 2) return

    setIsSubmitting(true)
    setLastSubmitMessage('')

    try {
      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetSymbol: selectedAsset.symbol,
          timeWindow,
          points,
          sessionId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setLastSubmitMessage('Prediction saved!')
        // Refresh average prediction
        await fetchAveragePrediction()
      } else {
        setLastSubmitMessage('Failed to save prediction')
      }
    } catch (error) {
      console.error('Error saving prediction:', error)
      setLastSubmitMessage('Error saving prediction')
    } finally {
      setIsSubmitting(false)
      // Clear message after 3 seconds
      setTimeout(() => setLastSubmitMessage(''), 3000)
    }
  }, [selectedAsset, timeWindow, sessionId, fetchAveragePrediction])

  // Handle asset selection
  const handleAssetSelect = useCallback((asset: Asset) => {
    setSelectedAsset(asset)
    setAveragePrediction(null)
    setPredictionCount(0)
  }, [])

  // Handle time window change
  const handleTimeWindowChange = useCallback((window: TimeWindow) => {
    setTimeWindow(window)
    setAveragePrediction(null)
    setPredictionCount(0)
  }, [])

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${branding.color}`}>
                {branding.name}
              </h1>
              <p className="text-slate-400 text-sm">{branding.tagline}</p>
            </div>
            <div className="flex items-center gap-4">
              {lastSubmitMessage && (
                <span className={`text-sm ${lastSubmitMessage.includes('Error') || lastSubmitMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                  {lastSubmitMessage}
                </span>
              )}
              {isSubmitting && (
                <span className="text-sm text-slate-400">Saving...</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-6">
          <AssetSearch onSelect={handleAssetSelect} selectedAsset={selectedAsset} />
          <TimeWindowSelector selected={timeWindow} onChange={handleTimeWindowChange} />
        </div>

        {/* Chart Area */}
        {selectedAsset ? (
          <PriceChartWithDrawing
            asset={selectedAsset}
            timeWindow={timeWindow}
            onPredictionComplete={handlePredictionComplete}
            averagePrediction={averagePrediction}
            predictionCount={predictionCount}
          />
        ) : (
          <div className="w-full h-[500px] bg-chart-bg rounded-lg border border-slate-700 flex items-center justify-center">
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
              <h2 className="text-xl font-medium text-white mb-2">Select an Asset</h2>
              <p className="text-slate-400">
                Search for a stock, crypto, or commodity to start predicting
              </p>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                1
              </div>
              <h3 className="font-medium text-white">Select Asset</h3>
            </div>
            <p className="text-slate-400 text-sm">
              Search for any NASDAQ or NYSE stock, or choose Bitcoin, Ethereum, Gold, or Silver.
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                2
              </div>
              <h3 className="font-medium text-white">Choose Timeframe</h3>
            </div>
            <p className="text-slate-400 text-sm">
              Select hourly, daily, weekly, monthly, or yearly predictions based on your outlook.
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                3
              </div>
              <h3 className="font-medium text-white">Draw Prediction</h3>
            </div>
            <p className="text-slate-400 text-sm">
              Draw your price prediction on the canvas. See the crowd average in grey for guidance.
            </p>
          </div>
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
