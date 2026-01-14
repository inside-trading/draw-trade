import { NextRequest, NextResponse } from 'next/server'
import { getPrediction } from '@/lib/db/predictions'
import { fetchCurrentBTCPrice } from '@/lib/api/coingecko'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Missing prediction ID' },
        { status: 400 }
      )
    }

    const prediction = getPrediction(id)

    if (!prediction) {
      return NextResponse.json(
        { error: 'Prediction not found' },
        { status: 404 }
      )
    }

    // Get current price for comparison
    let currentPrice: number | null = null
    try {
      currentPrice = await fetchCurrentBTCPrice()
    } catch {
      // Continue without current price if fetch fails
    }

    // Calculate running score for settled points
    const settledPoints = prediction.points.filter(p => p.actualPrice !== null)
    const runningScore = settledPoints.reduce((sum, p) => sum + (p.score || 0), 0)

    return NextResponse.json({
      success: true,
      prediction: {
        ...prediction,
        runningScore,
        settledPointCount: settledPoints.length,
        totalPointCount: prediction.points.length,
      },
      currentPrice,
    })
  } catch (error) {
    console.error('Error fetching prediction:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prediction' },
      { status: 500 }
    )
  }
}
