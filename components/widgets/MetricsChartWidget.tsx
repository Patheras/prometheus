'use client'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  config?: {
    metricName?: string
    timeRange?: string
  }
}

export default function MetricsChartWidget({ config }: Props) {
  const metricName = config?.metricName || 'Response Time'
  const timeRange = config?.timeRange || 'Last 24 hours'

  // Mock data
  const data = [
    { time: '00:00', value: 120 },
    { time: '04:00', value: 95 },
    { time: '08:00', value: 180 },
    { time: '12:00', value: 150 },
    { time: '16:00', value: 200 },
    { time: '20:00', value: 140 },
  ]

  const currentValue = data[data.length - 1]?.value || 0
  const previousValue = data[data.length - 2]?.value || 0
  const change = ((currentValue - previousValue) / previousValue) * 100
  const isPositive = change > 0

  return (
    <div className="h-full flex flex-col">
      {/* Stats */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white">{currentValue}ms</span>
          <div
            className={`flex items-center gap-1 text-sm ${
              isPositive ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-1">{timeRange}</p>
      </div>

      {/* Simple Chart */}
      <div className="flex-1 flex items-end gap-2">
        {data.map((point, index) => {
          const maxValue = Math.max(...data.map((d) => d.value))
          const height = (point.value / maxValue) * 100

          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-gradient-to-t from-[#5E6AD2] to-[#7C85E3] rounded-t transition-all hover:opacity-80"
                style={{ height: `${height}%` }}
              />
              <span className="text-[10px] text-zinc-600">{point.time}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
