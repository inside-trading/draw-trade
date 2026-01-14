import { NextRequest, NextResponse } from 'next/server'
import { savePrediction, getAveragePrediction, getPredictionCount } from '@/lib/db/predictions'
import { PredictionPoint, TimeWindow } from '@/types'

// POST - Save a new prediction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { assetSymbol, timeWindow, points, sessionId } = body as {
      assetSymbol: string
      timeWindow: TimeWindow
      points: PredictionPoint[]
      sessionId: string
    }

    if (!assetSymbol || !timeWindow || !points || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!Array.isArray(points) || points.length === 0) {
      return NextResponse.json(
        { error: 'Points must be a non-empty array' },
        { status: 400 }
      )
    }

    const prediction = savePrediction(assetSymbol, timeWindow, points, sessionId)

    return NextResponse.json({
      success: true,
      prediction: {
        id: prediction.id,
        assetSymbol: prediction.assetSymbol,
        timeWindow: prediction.timeWindow,
        pointCount: prediction.points.length,
        createdAt: prediction.createdAt,
      },
    })
  } catch (error) {
    console.error('Error saving prediction:', error)
    return NextResponse.json(
      { error: 'Failed to save prediction' },
      { status: 500 }
    )
  }
}

// GET - Get average prediction and count
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assetSymbol = searchParams.get('assetSymbol')
    const timeWindow = searchParams.get('timeWindow') as TimeWindow | null

    if (!assetSymbol || !timeWindow) {
      return NextResponse.json(
        { error: 'Missing assetSymbol or timeWindow' },
        { status: 400 }
      )
    }

    const averagePrediction = getAveragePrediction(assetSymbol, timeWindow)
    const predictionCount = getPredictionCount(assetSymbol, timeWindow)

    return NextResponse.json({
      averagePrediction,
      predictionCount,
    })
  } catch (error) {
    console.error('Error fetching predictions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    )
  }
}
