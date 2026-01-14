// Time window options for predictions
export type TimeWindow = '1h' | '24h' | '7d' | '30d' | '1y'

// CoinGecko granularity mapping
export interface TimeWindowConfig {
  label: string
  coingeckoDays: number // days parameter for CoinGecko API
  intervalMs: number // milliseconds between prediction points
  predictionDuration: number // how far into future to predict (ms)
  displayFormat: string // for showing timestamps
}

export const TIME_WINDOW_CONFIGS: Record<TimeWindow, TimeWindowConfig> = {
  '1h': {
    label: '1 Hour',
    coingeckoDays: 1, // CoinGecko minimum, we'll slice to 1h
    intervalMs: 60 * 1000, // 1 minute
    predictionDuration: 10 * 60 * 1000, // predict 10 minutes ahead
    displayFormat: 'HH:mm',
  },
  '24h': {
    label: '24 Hours',
    coingeckoDays: 1,
    intervalMs: 5 * 60 * 1000, // 5 minutes
    predictionDuration: 2 * 60 * 60 * 1000, // predict 2 hours ahead
    displayFormat: 'HH:mm',
  },
  '7d': {
    label: '7 Days',
    coingeckoDays: 7,
    intervalMs: 60 * 60 * 1000, // 1 hour
    predictionDuration: 12 * 60 * 60 * 1000, // predict 12 hours ahead
    displayFormat: 'MMM d HH:mm',
  },
  '30d': {
    label: '30 Days',
    coingeckoDays: 30,
    intervalMs: 60 * 60 * 1000, // 1 hour
    predictionDuration: 3 * 24 * 60 * 60 * 1000, // predict 3 days ahead
    displayFormat: 'MMM d HH:mm',
  },
  '1y': {
    label: '1 Year',
    coingeckoDays: 365,
    intervalMs: 24 * 60 * 60 * 1000, // 1 day
    predictionDuration: 30 * 24 * 60 * 60 * 1000, // predict 30 days ahead
    displayFormat: 'MMM d, yyyy',
  },
}

// Price point from CoinGecko (simplified - just time and price)
export interface PricePoint {
  time: number // Unix timestamp in seconds
  price: number
}

// A single prediction point (what user predicts at a specific time)
export interface PredictionPoint {
  timestamp: number // Unix timestamp in ms
  predictedPrice: number
  actualPrice: number | null // filled in when settled
  score: number | null // filled in when settled: 1 / (predicted - actual)²
}

// Prediction status
export type PredictionStatus = 'pending' | 'active' | 'settled'

// A complete prediction submission
export interface Prediction {
  id: string
  visitorId: string
  submittedAt: number // server timestamp in ms
  timeWindow: TimeWindow
  status: PredictionStatus
  points: PredictionPoint[]
  totalScore: number | null // sum of all point scores when settled
  startPrice: number // BTC price at submission time
}

// Live price update from Twelve Data WebSocket
export interface LivePriceUpdate {
  symbol: string
  price: number
  timestamp: number // Unix timestamp in ms
}

// Visitor session (stored in localStorage on client)
export interface VisitorSession {
  id: string
  createdAt: number
  totalScore: number
  predictionsCount: number
}

// Drawing coordinates from canvas
export interface DrawingPoint {
  x: number
  y: number
}

// API response types
export interface SubmitPredictionRequest {
  visitorId: string
  timeWindow: TimeWindow
  drawingPoints: DrawingPoint[]
  canvasWidth: number
  canvasHeight: number
  priceRangeMin: number
  priceRangeMax: number
}

export interface SubmitPredictionResponse {
  success: boolean
  prediction?: Prediction
  error?: string
}

export interface GetPredictionResponse {
  prediction: Prediction | null
  currentPrice: number | null
}
