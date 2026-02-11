'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Canvas, { WidgetConfig } from '@/components/canvas/Canvas'
import DashboardLibrary, { WidgetType } from '@/components/canvas/DashboardLibrary'
import { renderWidget } from '@/components/widgets/WidgetRegistry'
import { Button } from '@/components/ui/button'
import { LayoutGrid, Library } from 'lucide-react'

export default function DashboardPage() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  const [showLibrary, setShowLibrary] = useState(false)
  const [editMode, setEditMode] = useState(true)

  // Load widgets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('prometheus-dashboard-widgets')
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
          layout: { i: 'repo-status-1', x: 0, y: 0, w: 4, h: 2 },
        },
        {
          id: 'metrics-1',
          type: 'metrics-chart',
          title: 'Code Quality Metrics',
          layout: { i: 'metrics-1', x: 4, y: 0, w: 8, h: 3 },
        },
        {
          id: 'consultation-1',
          type: 'consultation-list',
          title: 'Pending Consultations',
          layout: { i: 'consultation-1', x: 0, y: 2, w: 6, h: 3 },
        },
      ])
    }
  }, [])

  // Save widgets to localStorage
  const handleLayoutChange = (updatedWidgets: WidgetConfig[]) => {
    setWidgets(updatedWidgets)
    localStorage.setItem('prometheus-dashboard-widgets', JSON.stringify(updatedWidgets))
  }

  const handleAddWidget = (widgetType: WidgetType) => {
    const newWidget: WidgetConfig = {
      id: `${widgetType.id}-${Date.now()}`,
      type: widgetType.id,
      title: widgetType.name,
      layout: {
        i: `${widgetType.id}-${Date.now()}`,
        x: 0,
        y: Infinity, // Add to bottom
        w: widgetType.defaultSize.w,
        h: widgetType.defaultSize.h,
      },
    }

    const updatedWidgets = [...widgets, newWidget]
    setWidgets(updatedWidgets)
    localStorage.setItem('prometheus-dashboard-widgets', JSON.stringify(updatedWidgets))
    setShowLibrary(false)
  }

  const handleRemoveWidget = (id: string) => {
    const updatedWidgets = widgets.filter((w) => w.id !== id)
    setWidgets(updatedWidgets)
    localStorage.setItem('prometheus-dashboard-widgets', JSON.stringify(updatedWidgets))
  }

  return (
    <AppLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
            <p className="text-sm text-zinc-400">
              Customize your workspace with widgets
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={editMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEditMode(!editMode)}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              {editMode ? 'Lock Layout' : 'Edit Layout'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLibrary(!showLibrary)}
            >
              <Library className="h-4 w-4 mr-2" />
              Widget Library
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 p-6 overflow-auto">
            <Canvas
              widgets={widgets}
              onLayoutChange={handleLayoutChange}
              onRemoveWidget={handleRemoveWidget}
              renderWidget={renderWidget}
              editable={editMode}
            />
          </div>

          {/* Library Sidebar */}
          {showLibrary && (
            <div className="w-80 border-l border-white/[0.08] bg-[#0A0A0B]">
              <DashboardLibrary onAddWidget={handleAddWidget} />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
