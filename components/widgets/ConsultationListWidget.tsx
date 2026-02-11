'use client'
import { FileText, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function ConsultationListWidget() {
  const consultations = [
    {
      id: '1',
      title: 'High-impact refactoring detected',
      description: 'Prometheus suggests extracting common patterns',
      priority: 'high',
      createdAt: '10 min ago',
    },
    {
      id: '2',
      title: 'Architecture change proposal',
      description: 'Migrate to event-driven architecture',
      priority: 'medium',
      createdAt: '1 hour ago',
    },
  ]

  return (
    <div className="space-y-3">
      {consultations.map((consultation) => (
        <div
          key={consultation.id}
          className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-start gap-2 mb-2">
            <FileText className="h-4 w-4 text-[#5E6AD2] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-white mb-1">
                {consultation.title}
              </h4>
              <p className="text-xs text-zinc-400 line-clamp-2">
                {consultation.description}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  consultation.priority === 'high' ? 'destructive' : 'warning'
                }
                className="text-[10px]"
              >
                {consultation.priority}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <Clock className="h-3 w-3" />
                {consultation.createdAt}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs">
              Review
            </Button>
          </div>
        </div>
      ))}

      {consultations.length === 0 && (
        <div className="text-center py-8">
          <AlertCircle className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">No pending consultations</p>
        </div>
      )}
    </div>
  )
}
