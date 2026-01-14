import { PricePoint, TimeWindow, TIME_WINDOW_CONFIGS } from '@/types'

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3'

interface CoinGeckoMarketChartResponse {
  prices: [number, number][] // [timestamp_ms, price]
}

/**
 * Fetch historical BTC price data from CoinGecko
 * Returns data formatted for our chart
 */
export async function fetchBTCHistory(timeWindow: TimeWindow): Promise<PricePoint[]> {
  const config = TIME_WINDOW_CONFIGS[timeWindow]

  const url = `${COINGECKO_API_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=${config.coingeckoDays}`

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
    next: { revalidate: 60 }, // Cache for 60 seconds
  })

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`)
  }

  const data: CoinGeckoMarketChartResponse = await response.json()

  // Convert to our format
  let points: PricePoint[] = data.prices.map(([timestamp, price]) => ({
    time: Math.floor(timestamp / 1000), // Convert to seconds
    price: price,
  }))

  // For 1h view, slice to just the last hour
  if (timeWindow === '1h') {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    points = points.filter(p => p.time * 1000 >= oneHourAgo)
  }

  return points
}

/**
 * Fetch current BTC price from CoinGecko
 */
export async function fetchCurrentBTCPrice(): Promise<number> {
  const url = `${COINGECKO_API_BASE}/simple/price?ids=bitcoin&vs_currencies=usd`

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
    cache: 'no-store', // Always get fresh price
  })

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`)
  }

  const data = await response.json()
  return data.bitcoin.usd
}
