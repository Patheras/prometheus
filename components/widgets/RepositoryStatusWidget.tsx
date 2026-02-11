'use client'
import { GitBranch, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function RepositoryStatusWidget() {
  const repositories = [
    {
      name: 'prometheus-core',
      status: 'healthy',
      lastActivity: '2 min ago',
      issues: 0,
    },
    {
      name: 'admin-portal',
      status: 'warning',
      lastActivity: '15 min ago',
      issues: 3,
    },
    {
      name: 'anots-integration',
      status: 'healthy',
      lastActivity: '1 hour ago',
      issues: 0,
    },
  ]

  return (
    <div className="space-y-3">
      {repositories.map((repo) => (
        <div
          key={repo.name}
          className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-zinc-400" />
              <span className="text-sm font-medium text-white">{repo.name}</span>
            </div>
            {repo.status === 'healthy' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-400" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <Clock className="h-3 w-3" />
              {repo.lastActivity}
            </div>
            {repo.issues > 0 && (
              <Badge variant="warning" className="text-[10px]">
                {repo.issues} issues
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
