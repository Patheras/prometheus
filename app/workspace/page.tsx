'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AppLayout from '@/components/layout/AppLayout'
import Canvas, { WidgetConfig } from '@/components/canvas/Canvas'
import DashboardLibrary from '@/components/canvas/DashboardLibrary'
import { renderWidget } from '@/components/widgets/WidgetRegistry'

export default function WorkspacePage() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  const [showLibrary, setShowLibrary] = useState(false)

  // Load widgets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('workspace-widgets')
    if (saved) {
      try {
        setWidgets(JSON.parse(saved))
      } catch (error) {
        console.error('Failed to load widgets:', error)
      }
    } else {
      // Default widgets
      setWidgets([
        {
          id: 'repo-status-1',
          type: 'repository-status',
          title: 'Repository Status',
          layout: { i: 'repo-status-1', x: 0, y: 0, w: 6, h: 3 },
        },
        {
          id: 'metrics-1',
          type: 'metrics-chart',
          title: 'Performance Metrics',
          layout: { i: 'metrics-1', x: 6, y: 0, w: 6, h: 3 },
        },
        {
          id: 'consultations-1',
          type: 'consultation-list',
          title: 'Recent Consultations',
          layout: { i: 'consultations-1', x: 0, y: 3, w: 12, h: 4 },
        },
      ])
    }
  }, [])

  // Save widgets to localStorage
  const handleLayoutChange = (updatedWidgets: WidgetConfig[]) => {
    setWidgets(updatedWidgets)
    localStorage.setItem('workspace-widgets', JSON.stringify(updatedWidgets))
  }

  const handleAddWidget = (widget: WidgetConfig) => {
    const newWidgets = [...widgets, widget]
    setWidgets(newWidgets)
    localStorage.setItem('workspace-widgets', JSON.stringify(newWidgets))
    setShowLibrary(false)
  }

  const handleRemoveWidget = (id: string) => {
    const newWidgets = widgets.filter((w) => w.id !== id)
    setWidgets(newWidgets)
    localStorage.setItem('workspace-widgets', JSON.stringify(newWidgets))
  }

  return (
    <AppLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.08]">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Workspace</h1>
            <p className="text-zinc-400">
              Customize your dashboard with widgets
            </p>
          </div>
          <Button
            onClick={() => setShowLibrary(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Widget
          </Button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-8">
          <Canvas
            widgets={widgets}
            onLayoutChange={handleLayoutChange}
            onRemoveWidget={handleRemoveWidget}
            renderWidget={renderWidget}
            editable={true}
          />
        </div>

        {/* Dashboard Library Modal */}
        {showLibrary && (
          <DashboardLibrary
            onClose={() => setShowLibrary(false)}
            onAddWidget={handleAddWidget}
            existingWidgets={widgets}
          />
        )}
      </div>
    </AppLayout>
  )
}
