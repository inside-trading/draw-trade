import React, { useRef, useState, useEffect, useCallback } from 'react'

function DrawingCanvas({ enabled, chartBounds, averagePrediction, onSubmit, timeframe }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawnPoints, setDrawnPoints] = useState([])
  const [submitting, setSubmitting] = useState(false)

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

    ctx.fillStyle = '#151a24'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(45, 55, 72, 0.5)'
    ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      const y = (height / 5) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    if (chartBounds && enabled) {
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      const startY = height * 0.5
      ctx.beginPath()
      ctx.moveTo(0, startY)
      ctx.lineTo(30, startY)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = '#00d4ff'
      ctx.beginPath()
      ctx.arc(0, startY, 6, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#8892b0'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'right'
      const priceRange = chartBounds.maxPrice - chartBounds.minPrice
      const padding = priceRange * 0.1
      const displayMax = chartBounds.maxPrice + padding
      const displayMin = chartBounds.minPrice - padding
      
      for (let i = 0; i <= 4; i++) {
        const price = displayMax - (i / 4) * (displayMax - displayMin)
        const y = (height / 4) * i
        ctx.fillText('$' + price.toFixed(2), width - 5, y + 4)
      }
    }

    if (averagePrediction && averagePrediction.length > 1) {
      ctx.strokeStyle = 'rgba(128, 128, 128, 0.8)'
      ctx.lineWidth = 3
      ctx.beginPath()
      
      const priceRange = chartBounds.maxPrice - chartBounds.minPrice
      const padding = priceRange * 0.1
      const displayMax = chartBounds.maxPrice + padding
      const displayMin = chartBounds.minPrice - padding
      
      averagePrediction.forEach((point, index) => {
        const x = (index / (averagePrediction.length - 1)) * width
        const y = height - ((point.price - displayMin) / (displayMax - displayMin)) * height
        
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
  }, [chartBounds, averagePrediction, drawnPoints, enabled])

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
        height: canvas.height
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
      <div className="canvas-header">
        <h3>Draw Your Prediction</h3>
        <p>Continue the price line from the left edge</p>
      </div>
      
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
