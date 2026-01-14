'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, IChartApi, ISeriesApi, LineData, CandlestickData, Time } from 'lightweight-charts'
import { Asset, TimeWindow, PricePoint, PredictionPoint, AveragePrediction, TIME_WINDOW_CONFIGS } from '@/types'
import { generateHistoricalPrices, formatPrice, getCurrentTime } from '@/lib/data/prices'

interface PriceChartWithDrawingProps {
  asset: Asset
  timeWindow: TimeWindow
  onPredictionComplete: (points: PredictionPoint[]) => void
  averagePrediction: AveragePrediction | null
  predictionCount: number
}

export default function PriceChartWithDrawing({
  asset,
  timeWindow,
  onPredictionComplete,
  averagePrediction,
  predictionCount,
}: PriceChartWithDrawingProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const avgLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const userLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const [priceData, setPriceData] = useState<PricePoint[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([])
  const [hasDrawn, setHasDrawn] = useState(false)
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 })

  const config = TIME_WINDOW_CONFIGS[timeWindow]

  // Generate price data when asset or time window changes
  useEffect(() => {
    const data = generateHistoricalPrices(asset.symbol, timeWindow)
    setPriceData(data)
    setHasDrawn(false)
    setDrawingPoints([])

    if (data.length > 0) {
      const lastPrice = data[data.length - 1].close
      setCurrentPrice(lastPrice)

      // Calculate price range with padding
      const prices = data.flatMap(d => [d.high, d.low])
      const min = Math.min(...prices)
      const max = Math.max(...prices)
      const padding = (max - min) * 0.3
      setPriceRange({ min: min - padding, max: max + padding })
    }
  }, [asset.symbol, timeWindow])

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
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

    // Add candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })
    candlestickSeriesRef.current = candlestickSeries

    // Add average prediction line series (grey)
    const avgLineSeries = chart.addLineSeries({
      color: '#6b7280',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    })
    avgLineSeriesRef.current = avgLineSeries

    // Add user prediction line series (amber)
    const userLineSeries = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 3,
      crosshairMarkerVisible: true,
      priceLineVisible: false,
    })
    userLineSeriesRef.current = userLineSeries

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

  // Update chart data
  useEffect(() => {
    if (!candlestickSeriesRef.current || priceData.length === 0) return

    const candleData: CandlestickData[] = priceData.map(p => ({
      time: p.time as Time,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
    }))

    candlestickSeriesRef.current.setData(candleData)

    // Extend time scale to show future area
    if (chartRef.current) {
      const lastTime = priceData[priceData.length - 1].time
      const futureTime = lastTime + (config.futureBars * config.intervalMs / 1000)
      chartRef.current.timeScale().setVisibleRange({
        from: priceData[0].time as Time,
        to: futureTime as Time,
      })
    }
  }, [priceData, config])

  // Update average prediction line
  useEffect(() => {
    if (!avgLineSeriesRef.current) return

    if (averagePrediction && averagePrediction.points.length > 0) {
      const lineData: LineData[] = averagePrediction.points.map(p => ({
        time: p.time as Time,
        value: p.price,
      }))
      avgLineSeriesRef.current.setData(lineData)
    } else {
      avgLineSeriesRef.current.setData([])
    }
  }, [averagePrediction])

  // Drawing canvas setup
  useEffect(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas || !canvasContainerRef.current) return

    canvas.width = canvasContainerRef.current.clientWidth
    canvas.height = 500

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [asset.symbol, timeWindow])

  // Convert drawing to price series
  const convertDrawingToPrices = useCallback((points: { x: number; y: number }[], lastPriceTime?: number): PredictionPoint[] => {
    if (points.length < 2) return []

    const canvas = drawingCanvasRef.current
    if (!canvas) return []

    const canvasWidth = canvas.width
    const canvasHeight = canvas.height

    if (canvasWidth === 0 || canvasHeight === 0) return []

    const intervalSeconds = config.intervalMs / 1000

    // Start time should be after the last price candle
    const baseTime = lastPriceTime ? lastPriceTime + intervalSeconds : getCurrentTime()
    const futureEndTime = baseTime + (config.futureBars * intervalSeconds)

    // Sort drawing points by x coordinate
    const sortedPoints = [...points].sort((a, b) => a.x - b.x)

    // Find the x range of the drawing
    const minX = sortedPoints[0].x
    const maxX = sortedPoints[sortedPoints.length - 1].x
    const drawingWidth = maxX - minX

    if (drawingWidth < 5) return [] // Too small to be meaningful

    // Generate prediction points at regular intervals
    const predictionPoints: PredictionPoint[] = []
    const numSamples = Math.min(config.futureBars, 200) // Limit samples for performance

    for (let i = 0; i < numSamples; i++) {
      // Map sample index to drawing x position
      const ratio = i / (numSamples - 1)
      const targetX = minX + ratio * drawingWidth

      // Calculate time for this point (strictly increasing)
      const time = Math.floor(baseTime + ratio * (futureEndTime - baseTime))

      // Find surrounding points for interpolation
      let beforePoint = sortedPoints[0]
      let afterPoint = sortedPoints[sortedPoints.length - 1]

      for (let j = 0; j < sortedPoints.length - 1; j++) {
        if (sortedPoints[j].x <= targetX && sortedPoints[j + 1].x >= targetX) {
          beforePoint = sortedPoints[j]
          afterPoint = sortedPoints[j + 1]
          break
        }
      }

      // Interpolate y value
      let y: number
      if (beforePoint.x === afterPoint.x) {
        y = beforePoint.y
      } else {
        const t = (targetX - beforePoint.x) / (afterPoint.x - beforePoint.x)
        y = beforePoint.y + t * (afterPoint.y - beforePoint.y)
      }

      // Convert Y to price (inverted because canvas Y is top-down)
      const price = priceRange.max - (y / canvasHeight) * (priceRange.max - priceRange.min)

      predictionPoints.push({
        time,
        price: Math.round(price * 100) / 100,
      })
    }

    // Ensure strictly ascending times by removing duplicates and keeping only increasing
    const finalPoints: PredictionPoint[] = []
    let lastTime = -1

    for (const point of predictionPoints) {
      if (point.time > lastTime) {
        finalPoints.push(point)
        lastTime = point.time
      }
    }

    return finalPoints
  }, [priceRange, config])

  // Update chart with user's drawing
  const updateUserPredictionLine = useCallback((points: { x: number; y: number }[]) => {
    if (!userLineSeriesRef.current || priceData.length === 0) return

    const lastPriceTime = priceData[priceData.length - 1].time
    const predictionPoints = convertDrawingToPrices(points, lastPriceTime)

    if (predictionPoints.length > 0) {
      // Build line data with connection point, ensuring strictly ascending times
      const lineData: LineData[] = []

      // Add connection point from last price
      lineData.push({
        time: lastPriceTime as Time,
        value: currentPrice,
      })

      // Add prediction points, ensuring each time is strictly greater than the last
      let lastTime = lastPriceTime
      for (const p of predictionPoints) {
        if (p.time > lastTime) {
          lineData.push({
            time: p.time as Time,
            value: p.price,
          })
          lastTime = p.time
        }
      }

      if (lineData.length >= 2) {
        userLineSeriesRef.current.setData(lineData)
      }
    }
  }, [convertDrawingToPrices, priceData, currentPrice])

  // Drawing handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsDrawing(true)
    setDrawingPoints([{ x, y }])
    setHasDrawn(false)

    // Clear previous drawing
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    userLineSeriesRef.current?.setData([])
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = drawingCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setDrawingPoints(prev => {
      const newPoints = [...prev, { x, y }]

      // Draw on canvas
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

      // Update chart line in real-time
      updateUserPredictionLine(newPoints)

      return newPoints
    })
  }, [isDrawing, updateUserPredictionLine])

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return

    setIsDrawing(false)
    setHasDrawn(true)

    // Convert drawing to price series
    const lastPriceTime = priceData.length > 0 ? priceData[priceData.length - 1].time : undefined
    const predictionPoints = convertDrawingToPrices(drawingPoints, lastPriceTime)

    if (predictionPoints.length >= 2) {
      onPredictionComplete(predictionPoints)
    }
  }, [isDrawing, drawingPoints, convertDrawingToPrices, onPredictionComplete, priceData])

  const handleMouseLeave = useCallback(() => {
    if (isDrawing) {
      handleMouseUp()
    }
  }, [isDrawing, handleMouseUp])

  const clearDrawing = useCallback(() => {
    const canvas = drawingCanvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    setDrawingPoints([])
    setHasDrawn(false)
    userLineSeriesRef.current?.setData([])
  }, [])

  return (
    <div className="w-full">
      {/* Info bar */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-white">{asset.symbol}</span>
          <span className="text-xl text-slate-300">{formatPrice(currentPrice, asset.symbol)}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {predictionCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-gray-500"></div>
              <span className="text-slate-400">{predictionCount} predictions</span>
            </div>
          )}
          {hasDrawn && (
            <button
              onClick={clearDrawing}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
            >
              Clear Drawing
            </button>
          )}
        </div>
      </div>

      {/* Chart and Drawing Canvas */}
      <div className="relative chart-container overflow-hidden">
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
              className="drawing-canvas absolute inset-0"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            />

            {/* Drawing instructions overlay */}
            {!hasDrawn && !isDrawing && (
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
                  <p className="text-white font-medium">Draw your price prediction</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Click and drag to predict the {config.label.toLowerCase()} price movement
                  </p>
                </div>
              </div>
            )}

            {/* Price scale reference */}
            <div className="absolute right-2 top-2 bottom-2 flex flex-col justify-between text-xs text-slate-500 pointer-events-none">
              <span>{formatPrice(priceRange.max, asset.symbol)}</span>
              <span>{formatPrice((priceRange.max + priceRange.min) / 2, asset.symbol)}</span>
              <span>{formatPrice(priceRange.min, asset.symbol)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 px-2 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-amber-500 rounded"></div>
          <span className="text-slate-400">Your Prediction</span>
        </div>
        {predictionCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-gray-500" style={{ borderTop: '2px dashed #6b7280' }}></div>
            <span className="text-slate-400">Community Average</span>
          </div>
        )}
      </div>
    </div>
  )
}
