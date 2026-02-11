'use client'
import { useState, useCallback } from 'react'
import GridLayout, { Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { X, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface WidgetConfig {
  id: string
  type: string
  title: string
  layout: Layout
  config?: Record<string, unknown>
}

interface Props {
  widgets: WidgetConfig[]
  onLayoutChange?: (widgets: WidgetConfig[]) => void
  onRemoveWidget?: (id: string) => void
  renderWidget: (widget: WidgetConfig) => React.ReactNode
  editable?: boolean
}

export default function Canvas({
  widgets,
  onLayoutChange,
  onRemoveWidget,
  renderWidget,
  editable = true,
}: Props) {
  const [isDragging, setIsDragging] = useState(false)

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      if (!onLayoutChange) return

      const updatedWidgets = widgets.map((widget) => {
        const layoutItem = newLayout.find((l) => l.i === widget.id)
        if (layoutItem) {
          return {
            ...widget,
            layout: layoutItem,
          }
        }
        return widget
      })

      onLayoutChange(updatedWidgets)
    },
    [widgets, onLayoutChange]
  )

  return (
    <div className="relative w-full h-full">
      <GridLayout
        className="layout"
        layout={widgets.map((w) => w.layout)}
        cols={12}
        rowHeight={80}
        width={1200}
        isDraggable={editable}
        isResizable={editable}
        onLayoutChange={handleLayoutChange}
        onDragStart={() => setIsDragging(true)}
        onDragStop={() => setIsDragging(false)}
        onResizeStart={() => setIsDragging(true)}
        onResizeStop={() => setIsDragging(false)}
        draggableHandle=".drag-handle"
        margin={[16, 16]}
        containerPadding={[0, 0]}
      >
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className={`bg-[#111113] border border-white/[0.08] rounded-xl overflow-hidden transition-all ${
              isDragging ? 'shadow-lg shadow-[#5E6AD2]/20' : ''
            }`}
          >
            {/* Widget Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#0A0A0B]/50">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {editable && (
                  <div className="drag-handle cursor-move p-1 hover:bg-white/[0.05] rounded transition-colors">
                    <GripVertical className="h-4 w-4 text-zinc-500" />
                  </div>
                )}
                <h3 className="text-sm font-semibold text-white truncate">
                  {widget.title}
                </h3>
              </div>
              {editable && onRemoveWidget && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemoveWidget(widget.id)}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Widget Content */}
            <div className="p-4 h-[calc(100%-57px)] overflow-auto">
              {renderWidget(widget)}
            </div>
          </div>
        ))}
      </GridLayout>

      {/* Empty State */}
      {widgets.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/[0.02] border border-white/[0.08] flex items-center justify-center">
              <GripVertical className="h-8 w-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Empty Canvas
            </h3>
            <p className="text-sm text-zinc-400 max-w-sm">
              Add widgets from the Dashboard Library to start building your custom
              workspace
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
