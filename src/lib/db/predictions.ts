import { getDatabase } from './index'
import {
  Prediction,
  PredictionPoint,
  TimeWindow,
  PredictionStatus,
  DrawingPoint,
  TIME_WINDOW_CONFIGS
} from '@/types'
import { v4 as uuidv4 } from 'uuid'

/**
 * Convert canvas drawing coordinates to timestamped price predictions
 * This runs on the server with server-authoritative timestamps
 */
export function convertDrawingToPrediction(
  drawingPoints: DrawingPoint[],
  canvasWidth: number,
  canvasHeight: number,
  priceRangeMin: number,
  priceRangeMax: number,
  timeWindow: TimeWindow,
  submittedAt: number // Server timestamp in ms
): PredictionPoint[] {
  if (drawingPoints.length < 2) return []

  const config = TIME_WINDOW_CONFIGS[timeWindow]
  const predictionDuration = config.predictionDuration
  const intervalMs = config.intervalMs

  // Sort drawing points by x coordinate
  const sortedPoints = [...drawingPoints].sort((a, b) => a.x - b.x)

  // Find the x range of the drawing
  const minX = sortedPoints[0].x
  const maxX = sortedPoints[sortedPoints.length - 1].x
  const drawingWidth = maxX - minX

  if (drawingWidth < 5) return [] // Too small

  // Calculate number of prediction points
  const numPoints = Math.floor(predictionDuration / intervalMs)
  const predictionPoints: PredictionPoint[] = []

  for (let i = 0; i < numPoints; i++) {
    // Map index to drawing x position
    const ratio = i / (numPoints - 1)
    const targetX = minX + ratio * drawingWidth

    // Calculate timestamp for this point
    const timestamp = submittedAt + (i * intervalMs)

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
    const predictedPrice = priceRangeMax - (y / canvasHeight) * (priceRangeMax - priceRangeMin)

    predictionPoints.push({
      timestamp,
      predictedPrice: Math.round(predictedPrice * 100) / 100,
      actualPrice: null,
      score: null,
    })
  }

  return predictionPoints
}

/**
 * Save a new prediction to the database
 */
export function savePrediction(
  visitorId: string,
  timeWindow: TimeWindow,
  points: PredictionPoint[],
  startPrice: number
): Prediction {
  const db = getDatabase()
  const id = uuidv4()
  const submittedAt = Date.now()

  // Ensure visitor exists
  db.prepare(`
    INSERT OR IGNORE INTO visitors (id, created_at)
    VALUES (?, ?)
  `).run(visitorId, submittedAt)

  // Insert prediction
  db.prepare(`
    INSERT INTO predictions (id, visitor_id, submitted_at, time_window, status, start_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, visitorId, submittedAt, timeWindow, 'active', startPrice)

  // Insert points
  const insertPoint = db.prepare(`
    INSERT INTO prediction_points (prediction_id, timestamp, predicted_price)
    VALUES (?, ?, ?)
  `)

  const insertMany = db.transaction((pts: PredictionPoint[]) => {
    for (const point of pts) {
      insertPoint.run(id, point.timestamp, point.predictedPrice)
    }
  })
  insertMany(points)

  // Update visitor stats
  db.prepare(`
    UPDATE visitors SET predictions_count = predictions_count + 1 WHERE id = ?
  `).run(visitorId)

  return {
    id,
    visitorId,
    submittedAt,
    timeWindow,
    status: 'active',
    points,
    totalScore: null,
    startPrice,
  }
}

/**
 * Get a prediction by ID
 */
export function getPrediction(id: string): Prediction | null {
  const db = getDatabase()

  const row = db.prepare(`
    SELECT * FROM predictions WHERE id = ?
  `).get(id) as {
    id: string
    visitor_id: string
    submitted_at: number
    time_window: string
    status: string
    start_price: number
    total_score: number | null
  } | undefined

  if (!row) return null

  const points = db.prepare(`
    SELECT timestamp, predicted_price, actual_price, score
    FROM prediction_points
    WHERE prediction_id = ?
    ORDER BY timestamp
  `).all(id) as Array<{
    timestamp: number
    predicted_price: number
    actual_price: number | null
    score: number | null
  }>

  return {
    id: row.id,
    visitorId: row.visitor_id,
    submittedAt: row.submitted_at,
    timeWindow: row.time_window as TimeWindow,
    status: row.status as PredictionStatus,
    points: points.map(p => ({
      timestamp: p.timestamp,
      predictedPrice: p.predicted_price,
      actualPrice: p.actual_price,
      score: p.score,
    })),
    totalScore: row.total_score,
    startPrice: row.start_price,
  }
}

/**
 * Get all active predictions that need settlement updates
 */
export function getActivePredictions(): Prediction[] {
  const db = getDatabase()

  const rows = db.prepare(`
    SELECT id FROM predictions WHERE status = 'active'
  `).all() as { id: string }[]

  return rows.map(row => getPrediction(row.id)).filter(Boolean) as Prediction[]
}

/**
 * Update a prediction point with actual price and calculate score
 * Score = 1 / (predicted - actual)²
 * Capped to prevent infinity when prediction equals actual
 */
export function settlePredictionPoint(
  predictionId: string,
  timestamp: number,
  actualPrice: number
): number {
  const db = getDatabase()

  // Get the predicted price for this point
  const point = db.prepare(`
    SELECT predicted_price FROM prediction_points
    WHERE prediction_id = ? AND timestamp = ?
  `).get(predictionId, timestamp) as { predicted_price: number } | undefined

  if (!point) return 0

  // Calculate score: 1 / (predicted - actual)²
  const diff = point.predicted_price - actualPrice
  const diffSquared = diff * diff

  // Cap score to prevent infinity (when diff is very small)
  // Max score of 1,000,000 when prediction is within $0.001
  const score = diffSquared < 0.000001 ? 1000000 : 1 / diffSquared

  // Update the point
  db.prepare(`
    UPDATE prediction_points
    SET actual_price = ?, score = ?
    WHERE prediction_id = ? AND timestamp = ?
  `).run(actualPrice, score, predictionId, timestamp)

  return score
}

/**
 * Check if all points in a prediction are settled and finalize if so
 */
export function checkAndFinalizePrediction(predictionId: string): boolean {
  const db = getDatabase()

  // Check if any points still need settlement
  const unsettled = db.prepare(`
    SELECT COUNT(*) as count FROM prediction_points
    WHERE prediction_id = ? AND actual_price IS NULL
  `).get(predictionId) as { count: number }

  if (unsettled.count > 0) return false

  // Calculate total score
  const result = db.prepare(`
    SELECT SUM(score) as total FROM prediction_points
    WHERE prediction_id = ?
  `).get(predictionId) as { total: number }

  // Update prediction status
  db.prepare(`
    UPDATE predictions
    SET status = 'settled', total_score = ?
    WHERE id = ?
  `).run(result.total, predictionId)

  // Update visitor total score
  const prediction = db.prepare(`
    SELECT visitor_id FROM predictions WHERE id = ?
  `).get(predictionId) as { visitor_id: string }

  db.prepare(`
    UPDATE visitors
    SET total_score = total_score + ?
    WHERE id = ?
  `).run(result.total, prediction.visitor_id)

  return true
}

/**
 * Store a price in the history table
 */
export function storePriceHistory(timestamp: number, price: number): void {
  const db = getDatabase()

  db.prepare(`
    INSERT OR REPLACE INTO price_history (timestamp, price)
    VALUES (?, ?)
  `).run(timestamp, price)
}

/**
 * Get historical price closest to a timestamp
 */
export function getPriceAtTimestamp(timestamp: number): number | null {
  const db = getDatabase()

  // Find closest price within 1 minute
  const result = db.prepare(`
    SELECT price FROM price_history
    WHERE timestamp BETWEEN ? AND ?
    ORDER BY ABS(timestamp - ?)
    LIMIT 1
  `).get(timestamp - 60000, timestamp + 60000, timestamp) as { price: number } | undefined

  return result?.price ?? null
}

/**
 * Get visitor stats
 */
export function getVisitorStats(visitorId: string): { totalScore: number; predictionsCount: number } | null {
  const db = getDatabase()

  const result = db.prepare(`
    SELECT total_score, predictions_count FROM visitors WHERE id = ?
  `).get(visitorId) as { total_score: number; predictions_count: number } | undefined

  if (!result) return null

  return {
    totalScore: result.total_score,
    predictionsCount: result.predictions_count,
  }
}

/**
 * Get active prediction for a visitor (if any)
 */
export function getVisitorActivePrediction(visitorId: string): Prediction | null {
  const db = getDatabase()

  const row = db.prepare(`
    SELECT id FROM predictions
    WHERE visitor_id = ? AND status = 'active'
    ORDER BY submitted_at DESC
    LIMIT 1
  `).get(visitorId) as { id: string } | undefined

  if (!row) return null

  return getPrediction(row.id)
}
