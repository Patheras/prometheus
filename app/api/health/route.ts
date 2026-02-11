import { NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
    })

    if (!response.ok) {
      return NextResponse.json(
        { status: 'unhealthy', error: 'API server not responding' },
        { status: 503 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { status: 'unhealthy', error: 'Failed to connect to API server' },
      { status: 503 }
    )
  }
}
