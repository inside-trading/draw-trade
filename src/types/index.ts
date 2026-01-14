export type AssetType = 'stock' | 'crypto' | 'commodity'

export type TimeWindow = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Asset {
  symbol: string
  name: string
  type: AssetType
  exchange?: string
}

export interface PricePoint {
  time: number // Unix timestamp in seconds
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface PredictionPoint {
  time: number // Unix timestamp in seconds
  price: number
}

export interface Prediction {
  id: string
  assetSymbol: string
  timeWindow: TimeWindow
  points: PredictionPoint[]
  createdAt: number
  sessionId: string
}

export interface AveragePrediction {
  assetSymbol: string
  timeWindow: TimeWindow
  points: PredictionPoint[]
  predictionCount: number
}

// Chart drawing state
export interface DrawingState {
  isDrawing: boolean
  points: { x: number; y: number }[]
  startTime: number
  endTime: number
  startPrice: number
}

// Time window configurations
export interface TimeWindowConfig {
  label: string
  historyBars: number
  futureBars: number
  intervalMs: number
  barLabel: string
}

export const TIME_WINDOW_CONFIGS: Record<TimeWindow, TimeWindowConfig> = {
  hourly: {
    label: 'Hourly',
    historyBars: 60,
    futureBars: 60,
    intervalMs: 60 * 1000, // 1 minute
    barLabel: 'minute',
  },
  daily: {
    label: 'Daily',
    historyBars: 24,
    futureBars: 24,
    intervalMs: 60 * 60 * 1000, // 1 hour
    barLabel: 'hour',
  },
  weekly: {
    label: 'Weekly',
    historyBars: 7 * 24,
    futureBars: 7 * 24,
    intervalMs: 60 * 60 * 1000, // 1 hour
    barLabel: 'hour',
  },
  monthly: {
    label: 'Monthly',
    historyBars: 30,
    futureBars: 30,
    intervalMs: 24 * 60 * 60 * 1000, // 1 day
    barLabel: 'day',
  },
  yearly: {
    label: 'Yearly',
    historyBars: 365,
    futureBars: 365,
    intervalMs: 24 * 60 * 60 * 1000, // 1 day
    barLabel: 'day',
  },
}
