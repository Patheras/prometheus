'use client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  TrendingUp,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Target,
} from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { useState } from 'react'

export default function EvolutionPage() {
  const [analyzing, setAnalyzing] = useState(false)

  return (
    <AppLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-[#5E6AD2]" />
            <h1 className="text-3xl font-bold text-white">Self-Evolution</h1>
          </div>
          <p className="text-zinc-400">
            Prometheus analyzes and improves its own codebase using dev/prod separation
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Improvements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">12</div>
              <p className="text-xs text-zinc-500 mt-1">Applied successfully</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">3</div>
              <p className="text-xs text-zinc-500 mt-1">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">94%</div>
              <p className="text-xs text-zinc-500 mt-1">12 of 13 improvements</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Last Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">2h</div>
              <p className="text-xs text-zinc-500 mt-1">ago</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-400" />
                Self-Analysis
              </CardTitle>
              <CardDescription>
                Analyze my own code with the same standards I use for other projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                disabled={analyzing}
                onClick={() => setAnalyzing(true)}
              >
                {analyzing ? 'Analyzing...' : 'Run Self-Analysis'}
              </Button>
              <p className="text-xs text-zinc-500 mt-3">
                Checks code quality, technical debt, and optimization opportunities
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                Generate Improvements
              </CardTitle>
              <CardDescription>
                Create improvement proposals based on analysis findings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" disabled={analyzing}>
                Generate Proposals
              </Button>
              <p className="text-xs text-zinc-500 mt-3">
                Uses pattern library and best practices to suggest improvements
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-emerald-400" />
                Dev/Prod Workflow
              </CardTitle>
              <CardDescription>
                Safe improvement workflow with testing and rollback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                View Workflow
              </Button>
              <p className="text-xs text-zinc-500 mt-3">
                Test in dev environment before promoting to production
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Improvements */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Improvements</CardTitle>
            <CardDescription>
              Improvements awaiting approval or testing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  title: 'Optimize memory engine query performance',
                  type: 'performance',
                  impact: 'high',
                  status: 'testing',
                  time: '2 hours ago',
                },
                {
                  title: 'Refactor runtime executor error handling',
                  type: 'quality',
                  impact: 'medium',
                  status: 'approval',
                  time: '5 hours ago',
                },
                {
                  title: 'Add caching layer to file scanner',
                  type: 'performance',
                  impact: 'high',
                  status: 'approval',
                  time: '1 day ago',
                },
              ].map((improvement, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {improvement.status === 'testing' ? (
                      <Zap className="h-5 w-5 text-amber-400" />
                    ) : (
                      <Clock className="h-5 w-5 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="text-sm font-medium text-white">
                        {improvement.title}
                      </h4>
                      <Badge
                        variant={
                          improvement.impact === 'high'
                            ? 'default'
                            : 'secondary'
                        }
                        className="flex-shrink-0"
                      >
                        {improvement.impact} impact
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span className="capitalize">{improvement.type}</span>
                      <span>•</span>
                      <span className="capitalize">{improvement.status}</span>
                      <span>•</span>
                      <span>{improvement.time}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      Review
                    </Button>
                    {improvement.status === 'approval' && (
                      <Button size="sm">Approve</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Improvements */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Improvements</CardTitle>
            <CardDescription>Successfully applied improvements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  title: 'Improved chunking algorithm efficiency',
                  impact: 'high',
                  result: '+40% faster indexing',
                  time: '2 days ago',
                },
                {
                  title: 'Reduced memory footprint in queue system',
                  impact: 'medium',
                  result: '-25% memory usage',
                  time: '3 days ago',
                },
                {
                  title: 'Enhanced error messages in analysis engine',
                  impact: 'low',
                  result: 'Better debugging',
                  time: '5 days ago',
                },
              ].map((improvement, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="text-sm font-medium text-white">
                        {improvement.title}
                      </h4>
                      <Badge variant="secondary" className="flex-shrink-0">
                        {improvement.impact} impact
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-emerald-400">{improvement.result}</span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-500">{improvement.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Evolution Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Evolution Metrics</CardTitle>
              <CardDescription>
                How Prometheus has improved over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-zinc-400">Code Quality</span>
                    <span className="text-sm font-medium text-white">87%</span>
                  </div>
                  <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
                      style={{ width: '87%' }}
                    />
                  </div>
                  <p className="text-xs text-emerald-400 mt-1">+12% this month</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-zinc-400">Performance</span>
                    <span className="text-sm font-medium text-white">92%</span>
                  </div>
                  <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{ width: '92%' }}
                    />
                  </div>
                  <p className="text-xs text-emerald-400 mt-1">+8% this month</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-zinc-400">Test Coverage</span>
                    <span className="text-sm font-medium text-white">81%</span>
                  </div>
                  <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                      style={{ width: '81%' }}
                    />
                  </div>
                  <p className="text-xs text-emerald-400 mt-1">+5% this month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pattern Library</CardTitle>
              <CardDescription>
                Learned patterns from successful improvements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: 'Caching Strategy', uses: 8, success: 100 },
                  { name: 'Error Handling', uses: 12, success: 92 },
                  { name: 'Memory Optimization', uses: 5, success: 100 },
                  { name: 'Query Optimization', uses: 7, success: 86 },
                ].map((pattern, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{pattern.name}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Used {pattern.uses} times
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-emerald-400">
                        {pattern.success}%
                      </p>
                      <p className="text-xs text-zinc-500">success</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
