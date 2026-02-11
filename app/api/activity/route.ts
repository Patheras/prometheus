import { NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export async function GET() {
  try {
    // For now, return mock data since backend doesn't have activity endpoint yet
    // TODO: Implement real activity tracking in backend
    const activities = [
      {
        type: 'success',
        message: 'Code quality analysis completed for main branch',
        time: '2 minutes ago',
        timestamp: Date.now() - 2 * 60 * 1000,
      },
      {
        type: 'warning',
        message: 'Consultation required: High-impact refactoring detected',
        time: '15 minutes ago',
        timestamp: Date.now() - 15 * 60 * 1000,
      },
      {
        type: 'success',
        message: 'Pattern applied: OpenClaw memory optimization',
        time: '1 hour ago',
        timestamp: Date.now() - 60 * 60 * 1000,
      },
      {
        type: 'info',
        message: 'New repository registered: prometheus-admin-portal',
        time: '2 hours ago',
        timestamp: Date.now() - 2 * 60 * 60 * 1000,
      },
    ]

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('Failed to fetch activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    )
  }
}
