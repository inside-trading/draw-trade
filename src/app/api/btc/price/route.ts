import { NextResponse } from 'next/server'
import { fetchCurrentBTCPrice } from '@/lib/api/coingecko'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const price = await fetchCurrentBTCPrice()
    const timestamp = Date.now()

    return NextResponse.json({
      success: true,
      price,
      timestamp,
    })
  } catch (error) {
    console.error('Error fetching BTC price:', error)
    return NextResponse.json(
      { error: 'Failed to fetch BTC price' },
      { status: 500 }
    )
  }
}
