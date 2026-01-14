import { LivePriceUpdate } from '@/types'

const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price'

type PriceCallback = (update: LivePriceUpdate) => void

/**
 * Twelve Data WebSocket client for real-time BTC price
 * This runs on the server to feed prices for prediction settlement
 */
export class TwelveDataWebSocket {
  private ws: WebSocket | null = null
  private apiKey: string
  private callbacks: Set<PriceCallback> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    this.ws = new WebSocket(`${TWELVE_DATA_WS_URL}?apikey=${this.apiKey}`)

    this.ws.onopen = () => {
      console.log('Twelve Data WebSocket connected')
      this.reconnectAttempts = 0

      // Subscribe to BTC/USD
      this.subscribe('BTC/USD')
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // Handle price updates
        if (data.event === 'price') {
          const update: LivePriceUpdate = {
            symbol: data.symbol,
            price: parseFloat(data.price),
            timestamp: data.timestamp * 1000, // Convert to ms
          }

          this.callbacks.forEach(cb => cb(update))
        }
      } catch (error) {
        console.error('Error parsing Twelve Data message:', error)
      }
    }

    this.ws.onerror = (error) => {
      console.error('Twelve Data WebSocket error:', error)
    }

    this.ws.onclose = () => {
      console.log('Twelve Data WebSocket closed')
      this.attemptReconnect()
    }
  }

  private subscribe(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'subscribe',
        params: {
          symbols: symbol,
        },
      }))
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
      setTimeout(() => this.connect(), delay)
    }
  }

  onPrice(callback: PriceCallback): () => void {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Singleton instance for server-side use
let wsInstance: TwelveDataWebSocket | null = null

export function getTwelveDataWS(): TwelveDataWebSocket {
  if (!wsInstance) {
    const apiKey = process.env.TWELVE_DATA_API_KEY
    if (!apiKey) {
      throw new Error('TWELVE_DATA_API_KEY environment variable is required')
    }
    wsInstance = new TwelveDataWebSocket(apiKey)
  }
  return wsInstance
}
