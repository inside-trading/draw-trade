import { NextRequest, NextResponse } from 'next/server'
import {
  convertDrawingToPrediction,
  savePrediction,
  getVisitorActivePrediction,
  storePriceHistory
} from '@/lib/db/predictions'
import { fetchCurrentBTCPrice } from '@/lib/api/coingecko'
import { SubmitPredictionRequest, TimeWindow, TIME_WINDOW_CONFIGS } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body: SubmitPredictionRequest = await request.json()
    const {
      visitorId,
      timeWindow,
      drawingPoints,
      canvasWidth,
      canvasHeight,
      priceRangeMin,
      priceRangeMax,
    } = body

    // Validate required fields
    if (!visitorId || !timeWindow || !drawingPoints || !canvasWidth || !canvasHeight) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate time window
    if (!TIME_WINDOW_CONFIGS[timeWindow as TimeWindow]) {
      return NextResponse.json(
        { error: 'Invalid time window' },
        { status: 400 }
      )
    }

    // Validate drawing has enough points
    if (!Array.isArray(drawingPoints) || drawingPoints.length < 2) {
      return NextResponse.json(
        { error: 'Drawing must have at least 2 points' },
        { status: 400 }
      )
    }

    // Check if visitor already has an active prediction
    const existingPrediction = getVisitorActivePrediction(visitorId)
    if (existingPrediction) {
      return NextResponse.json(
        { error: 'You already have an active prediction. Wait for it to settle.' },
        { status: 409 }
      )
    }

    // Get current BTC price - this is the SERVER's view of the price at submission time
    const currentPrice = await fetchCurrentBTCPrice()
    const submittedAt = Date.now() // Server-authoritative timestamp

    // Store this price in history for later settlement
    storePriceHistory(submittedAt, currentPrice)

    // Convert drawing to timestamped predictions on the server
    // The timestamps are based on server's submittedAt, not client's
    const predictionPoints = convertDrawingToPrediction(
      drawingPoints,
      canvasWidth,
      canvasHeight,
      priceRangeMin,
      priceRangeMax,
      timeWindow as TimeWindow,
      submittedAt
    )

    if (predictionPoints.length === 0) {
      return NextResponse.json(
        { error: 'Drawing is too small to generate a valid prediction' },
        { status: 400 }
      )
    }

    // Save prediction to database
    const prediction = savePrediction(
      visitorId,
      timeWindow as TimeWindow,
      predictionPoints,
      currentPrice
    )

    return NextResponse.json({
      success: true,
      prediction: {
        id: prediction.id,
        submittedAt: prediction.submittedAt,
        timeWindow: prediction.timeWindow,
        status: prediction.status,
        startPrice: prediction.startPrice,
        pointCount: prediction.points.length,
        // Don't send full points array to reduce payload
        firstPointTimestamp: prediction.points[0]?.timestamp,
        lastPointTimestamp: prediction.points[prediction.points.length - 1]?.timestamp,
      },
    })
  } catch (error) {
    console.error('Error submitting prediction:', error)
    return NextResponse.json(
      { error: 'Failed to submit prediction' },
      { status: 500 }
    )
  }
}
