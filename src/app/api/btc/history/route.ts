import { NextRequest, NextResponse } from 'next/server'
import { fetchBTCHistory } from '@/lib/api/coingecko'
import { TimeWindow, TIME_WINDOW_CONFIGS } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeWindow = searchParams.get('timeWindow') as TimeWindow | null

    if (!timeWindow || !TIME_WINDOW_CONFIGS[timeWindow]) {
      return NextResponse.json(
        { error: 'Invalid or missing timeWindow parameter' },
        { status: 400 }
      )
    }

    const history = await fetchBTCHistory(timeWindow)

    return NextResponse.json({
      success: true,
      data: history,
      timeWindow,
    })
  } catch (error) {
    console.error('Error fetching BTC history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch BTC history' },
      { status: 500 }
    )
  }
}
