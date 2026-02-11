import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/stats/memory`)
    
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Memory stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch memory stats' },
      { status: 500 }
    )
  }
}
