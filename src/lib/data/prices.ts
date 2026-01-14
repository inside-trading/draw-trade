import { PricePoint, TimeWindow, TIME_WINDOW_CONFIGS } from '@/types'

// Base prices for assets (approximate current values for realistic data)
const basePrices: Record<string, number> = {
  // Crypto
  BTC: 97000,
  ETH: 3400,
  // Commodities
  GOLD: 2650,
  SILVER: 30.5,
  // Major stocks
  AAPL: 230,
  MSFT: 420,
  GOOGL: 190,
  GOOG: 192,
  AMZN: 225,
  NVDA: 140,
  META: 590,
  TSLA: 410,
  // Default for others
  DEFAULT: 100,
}

// Volatility multipliers by asset type
const volatilityByType: Record<string, number> = {
  crypto: 0.03,
  commodity: 0.012,
  stock: 0.015,
}

function getBasePrice(symbol: string): number {
  return basePrices[symbol] || basePrices.DEFAULT
}

function getVolatility(symbol: string): number {
  if (['BTC', 'ETH'].includes(symbol)) return volatilityByType.crypto
  if (['GOLD', 'SILVER'].includes(symbol)) return volatilityByType.commodity
  return volatilityByType.stock
}

// Generate realistic OHLC data with random walk
function generateOHLC(
  basePrice: number,
  volatility: number,
  previousClose?: number
): { open: number; high: number; low: number; close: number } {
  const open = previousClose || basePrice * (1 + (Math.random() - 0.5) * volatility * 0.5)
  const change = (Math.random() - 0.5) * volatility * basePrice
  const close = open + change

  // High and low extend beyond open/close
  const range = Math.abs(change) + basePrice * volatility * Math.random() * 0.5
  const high = Math.max(open, close) + range * Math.random() * 0.5
  const low = Math.min(open, close) - range * Math.random() * 0.5

  return {
    open: Math.round(open * 100) / 100,
    high: Math.round(high * 100) / 100,
    low: Math.round(low * 100) / 100,
    close: Math.round(close * 100) / 100,
  }
}

// Generate historical price data for a symbol
export function generateHistoricalPrices(
  symbol: string,
  timeWindow: TimeWindow
): PricePoint[] {
  const config = TIME_WINDOW_CONFIGS[timeWindow]
  const basePrice = getBasePrice(symbol)
  const volatility = getVolatility(symbol)

  const now = Date.now()
  const points: PricePoint[] = []

  let previousClose: number | undefined

  // Generate historical data going backwards
  for (let i = config.historyBars - 1; i >= 0; i--) {
    const time = Math.floor((now - i * config.intervalMs) / 1000)
    const ohlc = generateOHLC(basePrice, volatility, previousClose)
    previousClose = ohlc.close

    points.push({
      time,
      ...ohlc,
      volume: Math.floor(Math.random() * 1000000) + 100000,
    })
  }

  return points
}

// Get the end time for predictions based on time window
export function getPredictionEndTime(timeWindow: TimeWindow): number {
  const config = TIME_WINDOW_CONFIGS[timeWindow]
  const now = Date.now()
  return Math.floor((now + config.futureBars * config.intervalMs) / 1000)
}

// Get the current time in seconds
export function getCurrentTime(): number {
  return Math.floor(Date.now() / 1000)
}

// Format price for display
export function formatPrice(price: number, symbol: string): string {
  if (['BTC', 'ETH'].includes(symbol)) {
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  if (symbol === 'SILVER') {
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  }
  return price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Format timestamp based on time window
export function formatTimestamp(timestamp: number, timeWindow: TimeWindow): string {
  const date = new Date(timestamp * 1000)

  switch (timeWindow) {
    case 'hourly':
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    case 'daily':
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    case 'weekly':
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: '2-digit',
      })
    case 'monthly':
    case 'yearly':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    default:
      return date.toLocaleDateString()
  }
}
