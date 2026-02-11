'use client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Activity,
  Code,
  Database,
  Zap,
  GitBranch,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import AppLayout from '@/components/layout/AppLayout'
import { useEffect, useState } from 'react'

interface Stats {
  repositories: number
  codeQuality: number
  activeTasks: number
  memoryUsage: string
  chunksIndexed: number
}

interface ActivityItem {
  type: 'success' | 'warning' | 'info'
  message: string
  time: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, activityRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/activity'),
        ])

        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStats(statsData)
        }

        if (activityRes.ok) {
          const activityData = await activityRes.json()
          setActivities(activityData.activities || [])
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const statCards = stats
    ? [
        {
          name: 'Repositories',
          value: stats.repositories.toString(),
          change: '+1 this week',
          icon: GitBranch,
          color: 'text-blue-400',
        },
        {
          name: 'Code Quality',
          value: `${stats.codeQuality}%`,
          change: '+5% from last week',
          icon: Code,
          color: 'text-emerald-400',
        },
        {
          name: 'Active Tasks',
          value: stats.activeTasks.toString(),
          change: '4 pending approval',
          icon: Activity,
          color: 'text-amber-400',
        },
        {
          name: 'Memory Usage',
          value: stats.memoryUsage,
          change: `${stats.chunksIndexed.toLocaleString()} chunks indexed`,
          icon: Database,
          color: 'text-purple-400',
        },
      ]
    : []

  return (
    <AppLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-zinc-400">
            Monitor Prometheus activity and system health
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-4 text-center text-zinc-400 py-8">
              Loading stats...
            </div>
          ) : (
            statCards.map((stat) => (
              <Card key={stat.name} className="hover:border-[#5E6AD2]/40 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-400">
                    {stat.name}
                  </CardTitle>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                  <p className="text-xs text-zinc-500">{stat.change}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest events from Prometheus</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.length === 0 ? (
                  <div className="text-center text-zinc-400 py-4">
                    No recent activity
                  </div>
                ) : (
                  activities.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                    >
                      {activity.type === 'success' && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      )}
                      {activity.type === 'warning' && (
                        <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      )}
                      {activity.type === 'info' && (
                        <Activity className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200">{activity.message}</p>
                        <p className="text-xs text-zinc-500 mt-1">{activity.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Code className="h-4 w-4 mr-2" />
                Analyze Code Quality
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <GitBranch className="h-4 w-4 mr-2" />
                Add Repository
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Zap className="h-4 w-4 mr-2" />
                Run Performance Test
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <TrendingUp className="h-4 w-4 mr-2" />
                View Metrics
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Prometheus engine health</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'Memory Engine', status: 'operational', icon: Database },
                { name: 'Runtime Engine', status: 'operational', icon: Zap },
                { name: 'Analysis Engine', status: 'operational', icon: Code },
                { name: 'Queue System', status: 'operational', icon: Activity },
              ].map((service) => (
                <div
                  key={service.name}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                >
                  <service.icon className="h-5 w-5 text-zinc-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {service.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      <span className="text-xs text-zinc-500 capitalize">
                        {service.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
