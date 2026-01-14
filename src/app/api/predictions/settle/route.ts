import { NextRequest, NextResponse } from 'next/server'
import {
  getActivePredictions,
  settlePredictionPoint,
  checkAndFinalizePrediction,
  storePriceHistory,
} from '@/lib/db/predictions'
import { fetchCurrentBTCPrice } from '@/lib/api/coingecko'

export const dynamic = 'force-dynamic'

/**
 * Settlement endpoint - should be called periodically (e.g., every minute)
 * Settles all prediction points that have timestamps <= now
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: verify API key for security
    const authHeader = request.headers.get('authorization')
    const apiKey = process.env.SETTLEMENT_API_KEY

    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const now = Date.now()

    // Get current BTC price
    const currentPrice = await fetchCurrentBTCPrice()

    // Store price in history
    storePriceHistory(now, currentPrice)

    // Get all active predictions
    const activePredictions = getActivePredictions()

    let settledPointsCount = 0
    let finalizedPredictionsCount = 0
    const errors: string[] = []

    for (const prediction of activePredictions) {
      try {
        // Find points that need settlement (timestamp <= now and no actual price yet)
        const pointsToSettle = prediction.points.filter(
          p => p.timestamp <= now && p.actualPrice === null
        )

        for (const point of pointsToSettle) {
          // Use current price for settlement
          // In a more sophisticated system, we'd look up the exact price at point.timestamp
          settlePredictionPoint(prediction.id, point.timestamp, currentPrice)
          settledPointsCount++
        }

        // Check if prediction is fully settled
        if (checkAndFinalizePrediction(prediction.id)) {
          finalizedPredictionsCount++
        }
      } catch (error) {
        errors.push(`Error settling prediction ${prediction.id}: ${error}`)
      }
    }

    return NextResponse.json({
      success: true,
      settledAt: now,
      currentPrice,
      activePredictionsCount: activePredictions.length,
      settledPointsCount,
      finalizedPredictionsCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error in settlement:', error)
    return NextResponse.json(
      { error: 'Settlement failed' },
      { status: 500 }
    )
  }
}
