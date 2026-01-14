import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'

const TIMEFRAME_CONFIG = {
  hourly: { duration: 60 * 60 * 1000, labels: 6, format: 'HH:mm' },
  daily: { duration: 24 * 60 * 60 * 1000, labels: 6, format: 'HH:mm' },
  weekly: { duration: 7 * 24 * 60 * 60 * 1000, labels: 7, format: 'ddd' },
  monthly: { duration: 30 * 24 * 60 * 60 * 1000, labels: 5, format: 'MMM d' },
  yearly: { duration: 365 * 24 * 60 * 60 * 1000, labels: 6, format: 'MMM' }
}

function formatDate(date, format, timeframe) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  if (timeframe === 'hourly' || timeframe === 'daily') {
    const hours = date.getHours().toString().padStart(2, '0')
    const mins = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${mins}`
  } else if (timeframe === 'weekly') {
    return days[date.getDay()]
  } else if (timeframe === 'monthly') {
    return `${months[date.getMonth()]} ${date.getDate()}`
  } else {
    return months[date.getMonth()]
  }
}

function DrawingCanvas({ enabled, chartBounds, displayBounds, averagePrediction, onSubmit, timeframe }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawnPoints, setDrawnPoints] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const priceRange = useMemo(() => {
    if (!displayBounds) return { min: 0, max: 100 }
    return { min: displayBounds.min, max: displayBounds.max }
  }, [displayBounds])

  const timeRange = useMemo(() => {
    const now = new Date()
    const config = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG.daily
    const endTime = new Date(now.getTime() + config.duration)
    return { start: now, end: endTime, labels: config.labels }
  }, [timeframe])

  const getCanvasPoint = useCallback((e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }, [])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    const bottomPadding = 30
    const rightPadding = 60
    const drawableWidth = width - rightPadding
    const drawableHeight = height - bottomPadding

    ctx.fillStyle = '#151a24'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(45, 55, 72, 0.5)'
    ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      const y = (drawableHeight / 5) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(drawableWidth, y)
      ctx.stroke()
    }

    for (let i = 0; i <= timeRange.labels; i++) {
      const x = (drawableWidth / timeRange.labels) * i
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, drawableHeight)
      ctx.stroke()
    }

    if (enabled) {
      const lastPriceY = chartBounds ? 
        drawableHeight - ((chartBounds.lastPrice - priceRange.min) / (priceRange.max - priceRange.min)) * drawableHeight :
        drawableHeight * 0.5
      
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(0, lastPriceY)
      ctx.lineTo(30, lastPriceY)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = '#00d4ff'
      ctx.beginPath()
      ctx.arc(0, lastPriceY, 6, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#8892b0'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'right'
      
      for (let i = 0; i <= 4; i++) {
        const price = priceRange.max - (i / 4) * (priceRange.max - priceRange.min)
        const y = (drawableHeight / 4) * i
        ctx.fillText('$' + price.toFixed(2), width - 5, y + 4)
      }

      ctx.textAlign = 'center'
      for (let i = 0; i <= timeRange.labels; i++) {
        const progress = i / timeRange.labels
        const timestamp = new Date(timeRange.start.getTime() + progress * (timeRange.end.getTime() - timeRange.start.getTime()))
        const x = (drawableWidth / timeRange.labels) * i
        const label = formatDate(timestamp, '', timeframe)
        ctx.fillText(label, x, height - 10)
      }
    }

    if (averagePrediction && averagePrediction.length > 1 && chartBounds) {
      ctx.strokeStyle = 'rgba(128, 128, 128, 0.8)'
      ctx.lineWidth = 3
      ctx.beginPath()
      
      averagePrediction.forEach((point, index) => {
        const x = (index / (averagePrediction.length - 1)) * drawableWidth
        const y = drawableHeight - ((point.price - priceRange.min) / (priceRange.max - priceRange.min)) * drawableHeight
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()

      ctx.fillStyle = 'rgba(128, 128, 128, 0.6)'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('Community Average', 10, 20)
    }

    if (drawnPoints.length > 1) {
      ctx.strokeStyle = '#ff6b6b'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(drawnPoints[0].x, drawnPoints[0].y)
      
      for (let i = 1; i < drawnPoints.length; i++) {
        ctx.lineTo(drawnPoints[i].x, drawnPoints[i].y)
      }
      ctx.stroke()
    }
  }, [chartBounds, averagePrediction, drawnPoints, enabled, priceRange, timeRange, timeframe])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const resizeCanvas = () => {
      const container = canvas.parentElement
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      drawCanvas()
    }
    
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [drawCanvas])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  const startDrawing = (e) => {
    if (!enabled) return
    setIsDrawing(true)
    const point = getCanvasPoint(e)
    setDrawnPoints([point])
  }

  const draw = (e) => {
    if (!isDrawing || !enabled) return
    const point = getCanvasPoint(e)
    setDrawnPoints(prev => [...prev, point])
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const handleClear = () => {
    setDrawnPoints([])
  }

  const handleSubmit = async () => {
    if (drawnPoints.length < 2 || !chartBounds) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    setSubmitting(true)
    try {
      await onSubmit(drawnPoints, {
        width: canvas.width,
        height: canvas.height,
        priceMin: priceRange.min,
        priceMax: priceRange.max,
        bottomPadding: 30,
        rightPadding: 60
      })
      setDrawnPoints([])
    } catch (err) {
      console.error('Submit error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleTouchStart = (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    startDrawing({ clientX: touch.clientX, clientY: touch.clientY })
  }

  const handleTouchMove = (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    draw({ clientX: touch.clientX, clientY: touch.clientY })
  }

  return (
    <div className="drawing-canvas-container">
      <div className="canvas-controls">
        <button 
          className="canvas-btn clear" 
          onClick={handleClear}
          disabled={drawnPoints.length === 0 || submitting}
        >
          Clear
        </button>
        <button 
          className="canvas-btn submit" 
          onClick={handleSubmit}
          disabled={drawnPoints.length < 2 || submitting || !enabled}
        >
          {submitting ? 'Submitting...' : 'Submit Prediction'}
        </button>
      </div>
      
      <div className="drawing-area">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={stopDrawing}
          style={{ 
            cursor: enabled ? 'crosshair' : 'not-allowed',
            opacity: enabled ? 1 : 0.5
          }}
        />
      </div>
    </div>
  )
}

export default DrawingCanvas
