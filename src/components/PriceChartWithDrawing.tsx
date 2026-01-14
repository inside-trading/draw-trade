'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts'
import { TimeWindow, PricePoint, DrawingPoint, TIME_WINDOW_CONFIGS, Prediction } from '@/types'

interface PriceChartWithDrawingProps {
  timeWindow: TimeWindow
  priceData: PricePoint[]
  onSubmitPrediction: (drawingPoints: DrawingPoint[], canvasWidth: number, canvasHeight: number, priceMin: number, priceMax: number) => void
  isSubmitting: boolean
  activePrediction: Prediction | null
  currentPrice: number | null
}

export default function PriceChartWithDrawing({
  timeWindow,
  priceData,
  onSubmitPrediction,
  isSubmitting,
  activePrediction,
  currentPrice,
}: PriceChartWithDrawingProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const priceSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const predictionSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const actualSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<DrawingPoint[]>([])
  const [hasDrawn, setHasDrawn] = useState(false)
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 })

  const config = TIME_WINDOW_CONFIGS[timeWindow]

  // Calculate price range from data
  useEffect(() => {
    if (priceData.length > 0) {
      const prices = priceData.map(d => d.price)
      const min = Math.min(...prices)
      const max = Math.max(...prices)
      const padding = (max - min) * 0.2
      setPriceRange({ min: min - padding, max: max + padding })
    }
  }, [priceData])

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#334155',
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    chartRef.current = chart

    // Historical price line (blue)
    const priceSeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      priceLineVisible: false,
    })
    priceSeriesRef.current = priceSeries

    // User prediction line (amber)
    const predictionSeries = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 3,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    })
    predictionSeriesRef.current = predictionSeries

    // Actual price line for settled points (green)
    const actualSeries = chart.addLineSeries({
      color: '#10b981',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    })
    actualSeriesRef.current = actualSeries

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // Update chart with price data
  useEffect(() => {
    if (!priceSeriesRef.current || priceData.length === 0) return

    const lineData: LineData[] = priceData.map(p => ({
      time: p.time as Time,
      value: p.price,
    }))

    priceSeriesRef.current.setData(lineData)

    // Extend visible range to include prediction area
    if (chartRef.current && priceData.length > 0) {
      const lastTime = priceData[priceData.length - 1].time
      const futureTime = lastTime + (config.predictionDuration / 1000)
      chartRef.current.timeScale().setVisibleRange({
        from: priceData[0].time as Time,
        to: futureTime as Time,
      })
    }
  }, [priceData, config])

  // Update chart with active prediction
  useEffect(() => {
    if (!predictionSeriesRef.current || !actualSeriesRef.current) return

    if (activePrediction) {
      // Show predicted line
      const predictionData: LineData[] = activePrediction.points.map(p => ({
        time: (p.timestamp / 1000) as Time,
        value: p.predictedPrice,
      }))
      predictionSeriesRef.current.setData(predictionData)

      // Show actual prices for settled points
      const settledData: LineData[] = activePrediction.points
        .filter(p => p.actualPrice !== null)
        .map(p => ({
          time: (p.timestamp / 1000) as Time,
          value: p.actualPrice!,
        }))
      actualSeriesRef.current.setData(settledData)
    } else {
      predictionSeriesRef.current.setData([])
      actualSeriesRef.current.setData([])
    }
  }, [activePrediction])

  // Setup drawing canvas
  useEffect(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas || !canvasContainerRef.current) return

    canvas.width = canvasContainerRef.current.clientWidth
    canvas.height = 400

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [timeWindow])

  // Clear drawing when time window changes
  useEffect(() => {
    setDrawingPoints([])
    setHasDrawn(false)
    const canvas = drawingCanvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [timeWindow])

  // Drawing handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activePrediction || isSubmitting) return

    const canvas = drawingCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsDrawing(true)
    setDrawingPoints([{ x, y }])
    setHasDrawn(false)

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [activePrediction, isSubmitting])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = drawingCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setDrawingPoints(prev => {
      const newPoints = [...prev, { x, y }]

      const ctx = canvas.getContext('2d')
      if (ctx && prev.length > 0) {
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        ctx.beginPath()
        ctx.moveTo(prev[prev.length - 1].x, prev[prev.length - 1].y)
        ctx.lineTo(x, y)
        ctx.stroke()
      }

      return newPoints
    })
  }, [isDrawing])

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return
    setIsDrawing(false)
    setHasDrawn(drawingPoints.length > 10) // Need enough points
  }, [isDrawing, drawingPoints.length])

  const handleMouseLeave = useCallback(() => {
    if (isDrawing) {
      handleMouseUp()
    }
  }, [isDrawing, handleMouseUp])

  const clearDrawing = useCallback(() => {
    const canvas = drawingCanvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    setDrawingPoints([])
    setHasDrawn(false)
  }, [])

  const handleSubmit = useCallback(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas || drawingPoints.length < 2) return

    onSubmitPrediction(
      drawingPoints,
      canvas.width,
      canvas.height,
      priceRange.min,
      priceRange.max
    )
  }, [drawingPoints, priceRange, onSubmitPrediction])

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  }

  const lastPrice = priceData.length > 0 ? priceData[priceData.length - 1].price : 0

  // Calculate running score if there's an active prediction
  const runningScore = activePrediction
    ? activePrediction.points.filter(p => p.score !== null).reduce((sum, p) => sum + (p.score || 0), 0)
    : 0

  const settledCount = activePrediction
    ? activePrediction.points.filter(p => p.actualPrice !== null).length
    : 0

  const totalCount = activePrediction?.points.length || 0

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-4">
          <span className="text-3xl font-bold text-orange-500">₿</span>
          <span className="text-2xl font-bold text-white">Bitcoin</span>
          <span className="text-xl text-slate-300">{formatPrice(currentPrice || lastPrice)}</span>
        </div>
        <div className="flex items-center gap-4">
          {hasDrawn && !activePrediction && (
            <>
              <button
                onClick={clearDrawing}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded font-medium text-black transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Prediction'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Score Display for Active Prediction */}
      {activePrediction && (
        <div className="mb-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-sm">Running Score</span>
              <div className="text-2xl font-bold text-amber-500">
                {runningScore.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-sm">Progress</span>
              <div className="text-lg text-slate-300">
                {settledCount} / {totalCount} points settled
              </div>
            </div>
          </div>
          <div className="mt-2 bg-slate-700 rounded-full h-2">
            <div
              className="bg-amber-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${totalCount > 0 ? (settledCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Chart and Drawing Canvas */}
      <div className="relative chart-container overflow-hidden rounded-lg border border-slate-700">
        <div className="flex">
          {/* Price Chart */}
          <div ref={chartContainerRef} className="flex-1" style={{ minWidth: '60%' }} />

          {/* Drawing Canvas */}
          <div
            ref={canvasContainerRef}
            className="relative bg-chart-bg border-l border-slate-700"
            style={{ width: '40%' }}
          >
            <canvas
              ref={drawingCanvasRef}
              className={`absolute inset-0 ${activePrediction ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            />

            {/* Overlay message */}
            {!hasDrawn && !isDrawing && !activePrediction && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center p-6 bg-slate-800/80 rounded-lg backdrop-blur-sm">
                  <svg
                    className="w-12 h-12 mx-auto mb-3 text-amber-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  <p className="text-white font-medium">Draw your prediction</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Predict Bitcoin over the next {config.label.toLowerCase()}
                  </p>
                </div>
              </div>
            )}

            {activePrediction && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center p-6 bg-slate-800/80 rounded-lg backdrop-blur-sm">
                  <div className="animate-pulse">
                    <p className="text-amber-500 font-medium text-lg">Prediction Active</p>
                    <p className="text-slate-400 text-sm mt-1">
                      Watching for results...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Price scale reference */}
            <div className="absolute right-2 top-2 bottom-2 flex flex-col justify-between text-xs text-slate-500 pointer-events-none">
              <span>{formatPrice(priceRange.max)}</span>
              <span>{formatPrice((priceRange.max + priceRange.min) / 2)}</span>
              <span>{formatPrice(priceRange.min)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 px-2 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-blue-500"></div>
          <span className="text-slate-400">Historical Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-amber-500"></div>
          <span className="text-slate-400">Your Prediction</span>
        </div>
        {activePrediction && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-emerald-500" style={{ borderTop: '2px dashed #10b981' }}></div>
            <span className="text-slate-400">Actual Price</span>
          </div>
        )}
      </div>
    </div>
  )
}
