import { getDatabase } from './index'
import { Prediction, PredictionPoint, TimeWindow, AveragePrediction, TIME_WINDOW_CONFIGS } from '@/types'
import { v4 as uuidv4 } from 'uuid'

// Save a new prediction
export function savePrediction(
  assetSymbol: string,
  timeWindow: TimeWindow,
  points: PredictionPoint[],
  sessionId: string
): Prediction {
  const db = getDatabase()
  const id = uuidv4()
  const createdAt = Math.floor(Date.now() / 1000)

  // Insert prediction
  const insertPrediction = db.prepare(`
    INSERT INTO predictions (id, asset_symbol, time_window, session_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `)
  insertPrediction.run(id, assetSymbol, timeWindow, sessionId, createdAt)

  // Insert points
  const insertPoint = db.prepare(`
    INSERT INTO prediction_points (prediction_id, time, price)
    VALUES (?, ?, ?)
  `)

  const insertMany = db.transaction((pts: PredictionPoint[]) => {
    for (const point of pts) {
      insertPoint.run(id, point.time, point.price)
    }
  })
  insertMany(points)

  return {
    id,
    assetSymbol,
    timeWindow,
    points,
    createdAt,
    sessionId,
  }
}

// Get prediction count for an asset and time window
export function getPredictionCount(assetSymbol: string, timeWindow: TimeWindow): number {
  const db = getDatabase()
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM predictions
    WHERE asset_symbol = ? AND time_window = ?
  `).get(assetSymbol, timeWindow) as { count: number }

  return result.count
}

// Calculate average prediction for an asset and time window
export function getAveragePrediction(
  assetSymbol: string,
  timeWindow: TimeWindow
): AveragePrediction | null {
  const db = getDatabase()

  // Get all predictions for this asset and time window
  const predictions = db.prepare(`
    SELECT id FROM predictions
    WHERE asset_symbol = ? AND time_window = ?
    ORDER BY created_at DESC
    LIMIT 1000
  `).all(assetSymbol, timeWindow) as { id: string }[]

  if (predictions.length === 0) {
    return null
  }

  const predictionIds = predictions.map(p => p.id)
  const placeholders = predictionIds.map(() => '?').join(',')

  // Get all points for these predictions
  const points = db.prepare(`
    SELECT time, price FROM prediction_points
    WHERE prediction_id IN (${placeholders})
    ORDER BY time
  `).all(...predictionIds) as { time: number; price: number }[]

  if (points.length === 0) {
    return null
  }

  // Group points by time and calculate averages
  const timeGroups = new Map<number, number[]>()

  for (const point of points) {
    if (!timeGroups.has(point.time)) {
      timeGroups.set(point.time, [])
    }
    timeGroups.get(point.time)!.push(point.price)
  }

  // Calculate average for each time
  const config = TIME_WINDOW_CONFIGS[timeWindow]
  const intervalSeconds = config.intervalMs / 1000
  const now = Math.floor(Date.now() / 1000)

  // Create a normalized time series
  const averagePoints: PredictionPoint[] = []
  const sortedTimes = Array.from(timeGroups.keys()).sort((a, b) => a - b)

  // Interpolate to create smooth average line
  for (const time of sortedTimes) {
    const prices = timeGroups.get(time)!
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length

    averagePoints.push({
      time,
      price: Math.round(avgPrice * 100) / 100,
    })
  }

  // If we have data, interpolate gaps
  if (averagePoints.length >= 2) {
    const interpolatedPoints: PredictionPoint[] = []
    const startTime = averagePoints[0].time
    const endTime = averagePoints[averagePoints.length - 1].time

    for (let t = startTime; t <= endTime; t += intervalSeconds) {
      // Find surrounding points
      const before = averagePoints.filter(p => p.time <= t).pop()
      const after = averagePoints.find(p => p.time >= t)

      if (before && after && before !== after) {
        // Linear interpolation
        const ratio = (t - before.time) / (after.time - before.time)
        const price = before.price + ratio * (after.price - before.price)
        interpolatedPoints.push({ time: t, price: Math.round(price * 100) / 100 })
      } else if (before) {
        interpolatedPoints.push({ time: t, price: before.price })
      } else if (after) {
        interpolatedPoints.push({ time: t, price: after.price })
      }
    }

    return {
      assetSymbol,
      timeWindow,
      points: interpolatedPoints.length > 0 ? interpolatedPoints : averagePoints,
      predictionCount: predictions.length,
    }
  }

  return {
    assetSymbol,
    timeWindow,
    points: averagePoints,
    predictionCount: predictions.length,
  }
}

// Get recent predictions for an asset
export function getRecentPredictions(
  assetSymbol: string,
  timeWindow: TimeWindow,
  limit: number = 10
): Prediction[] {
  const db = getDatabase()

  const predictions = db.prepare(`
    SELECT * FROM predictions
    WHERE asset_symbol = ? AND time_window = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(assetSymbol, timeWindow, limit) as Array<{
    id: string
    asset_symbol: string
    time_window: string
    session_id: string
    created_at: number
  }>

  return predictions.map(p => {
    const points = db.prepare(`
      SELECT time, price FROM prediction_points
      WHERE prediction_id = ?
      ORDER BY time
    `).all(p.id) as PredictionPoint[]

    return {
      id: p.id,
      assetSymbol: p.asset_symbol,
      timeWindow: p.time_window as TimeWindow,
      points,
      createdAt: p.created_at,
      sessionId: p.session_id,
    }
  })
}
