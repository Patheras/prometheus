'use client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Code, AlertTriangle, TrendingUp, FileCode } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { useState } from 'react'

export default function AnalysisPage() {
  const [analyzing, setAnalyzing] = useState(false)

  return (
    <AppLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Code Analysis</h1>
          <p className="text-zinc-400">
            Analyze code quality, detect technical debt, and get optimization suggestions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-blue-400" />
                Quality Analysis
              </CardTitle>
              <CardDescription>AST-based code quality checks</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                disabled={analyzing}
                onClick={() => setAnalyzing(true)}
              >
                Run Analysis
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Debt Detection
              </CardTitle>
              <CardDescription>Find technical debt patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                variant="outline"
                disabled={analyzing}
              >
                Detect Debt
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                Optimization
              </CardTitle>
              <CardDescription>Get improvement suggestions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                variant="outline"
                disabled={analyzing}
              >
                Optimize
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>Recent analysis findings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center text-zinc-400 py-8">
              <FileCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No analysis results yet</p>
              <p className="text-sm mt-2">Run an analysis to see results here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
