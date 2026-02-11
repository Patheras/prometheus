import { WidgetConfig } from '../canvas/Canvas'
import MetricsChartWidget from './MetricsChartWidget'
import RepositoryStatusWidget from './RepositoryStatusWidget'
import ConsultationListWidget from './ConsultationListWidget'

// Widget registry - maps widget types to their components
export const widgetRegistry: Record<
  string,
  React.ComponentType<{ config?: Record<string, unknown> }>
> = {
  'metrics-chart': MetricsChartWidget,
  'repository-status': RepositoryStatusWidget,
  'consultation-list': ConsultationListWidget,
  // Placeholder widgets for other types
  'code-viewer': () => (
    <div className="flex items-center justify-center h-full text-zinc-400">
      Code Viewer Widget
    </div>
  ),
  'audit-log': () => (
    <div className="flex items-center justify-center h-full text-zinc-400">
      Audit Log Widget
    </div>
  ),
  'memory-usage': () => (
    <div className="flex items-center justify-center h-full text-zinc-400">
      Memory Usage Widget
    </div>
  ),
  'runtime-stats': () => (
    <div className="flex items-center justify-center h-full text-zinc-400">
      Runtime Stats Widget
    </div>
  ),
  'quality-trends': () => (
    <div className="flex items-center justify-center h-full text-zinc-400">
      Quality Trends Widget
    </div>
  ),
}

export function renderWidget(widget: WidgetConfig) {
  const WidgetComponent = widgetRegistry[widget.type]
  if (!WidgetComponent) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400">
        Unknown widget type: {widget.type}
      </div>
    )
  }
  return <WidgetComponent config={widget.config} />
}
