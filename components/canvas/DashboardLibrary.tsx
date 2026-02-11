'use client'
import { useState } from 'react'
import {
  BarChart3,
  Code,
  FileText,
  GitBranch,
  Activity,
  Database,
  Zap,
  TrendingUp,
  Search,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface WidgetType {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  category: 'metrics' | 'code' | 'workflow' | 'system'
  defaultSize: { w: number; h: number }
}

const widgetTypes: WidgetType[] = [
  {
    id: 'metrics-chart',
    name: 'Metrics Chart',
    description: 'Time series visualization for performance metrics',
    icon: BarChart3,
    category: 'metrics',
    defaultSize: { w: 6, h: 3 },
  },
  {
    id: 'code-viewer',
    name: 'Code Viewer',
    description: 'Display code snippets with syntax highlighting',
    icon: Code,
    category: 'code',
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: 'consultation-list',
    name: 'Consultations',
    description: 'Pending consultation requests from Prometheus',
    icon: FileText,
    category: 'workflow',
    defaultSize: { w: 4, h: 3 },
  },
  {
    id: 'repository-status',
    name: 'Repository Status',
    description: 'Health and activity status of repositories',
    icon: GitBranch,
    category: 'system',
    defaultSize: { w: 4, h: 2 },
  },
  {
    id: 'audit-log',
    name: 'Audit Log',
    description: 'Recent system activities and changes',
    icon: Activity,
    category: 'system',
    defaultSize: { w: 6, h: 3 },
  },
  {
    id: 'memory-usage',
    name: 'Memory Usage',
    description: 'Memory engine statistics and usage',
    icon: Database,
    category: 'system',
    defaultSize: { w: 3, h: 2 },
  },
  {
    id: 'runtime-stats',
    name: 'Runtime Stats',
    description: 'LLM model usage and performance',
    icon: Zap,
    category: 'system',
    defaultSize: { w: 3, h: 2 },
  },
  {
    id: 'quality-trends',
    name: 'Quality Trends',
    description: 'Code quality metrics over time',
    icon: TrendingUp,
    category: 'metrics',
    defaultSize: { w: 6, h: 3 },
  },
]

interface Props {
  onAddWidget: (widgetType: WidgetType) => void
}

export default function DashboardLibrary({ onAddWidget }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categories = [
    { id: 'metrics', name: 'Metrics', count: widgetTypes.filter((w) => w.category === 'metrics').length },
    { id: 'code', name: 'Code', count: widgetTypes.filter((w) => w.category === 'code').length },
    { id: 'workflow', name: 'Workflow', count: widgetTypes.filter((w) => w.category === 'workflow').length },
    { id: 'system', name: 'System', count: widgetTypes.filter((w) => w.category === 'system').length },
  ]

  const filteredWidgets = widgetTypes.filter((widget) => {
    const matchesSearch =
      searchQuery === '' ||
      widget.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      widget.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = !selectedCategory || widget.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/[0.08]">
        <h2 className="text-xl font-bold text-white mb-2">Dashboard Library</h2>
        <p className="text-sm text-zinc-400">
          Drag widgets to your canvas or click to add
        </p>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-white/[0.08]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search widgets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-[#111113] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/40 transition-all"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="p-4 border-b border-white/[0.08]">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
              <Badge variant="secondary" className="ml-2">
                {category.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Widget List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredWidgets.map((widget) => (
          <Card
            key={widget.id}
            className="cursor-pointer hover:border-[#5E6AD2]/40 transition-all group"
            onClick={() => onAddWidget(widget)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#5E6AD2]/10 border border-[#5E6AD2]/20 group-hover:bg-[#5E6AD2]/20 transition-colors">
                    <widget.icon className="h-5 w-5 text-[#5E6AD2]" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{widget.name}</CardTitle>
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {widget.category}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="text-xs">
                {widget.description}
              </CardDescription>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {widget.defaultSize.w}x{widget.defaultSize.h} grid
                </span>
                <Button size="sm" variant="ghost" className="h-7 text-xs">
                  Add to Canvas
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredWidgets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-zinc-400">No widgets found</p>
          </div>
        )}
      </div>
    </div>
  )
}

export { widgetTypes }
export type { WidgetType }
