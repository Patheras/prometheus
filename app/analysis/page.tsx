'use client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Code, AlertTriangle, TrendingUp, FileCode, Sparkles, GitBranch } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { useState, useEffect } from 'react'

interface Repository {
  id: string
  name: string
  url: string
  branch: string
  status: string
}

export default function AnalysisPage() {
  const [analyzing, setAnalyzing] = useState(false)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [selectedRepo, setSelectedRepo] = useState<string>('self')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRepositories() {
      try {
        const res = await fetch('/api/repositories')
        if (res.ok) {
          const data = await res.json()
          setRepositories(data.repositories || [])
        }
      } catch (error) {
        console.error('Failed to fetch repositories:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchRepositories()
  }, [])

  const handleAnalyze = async (type: string) => {
    setAnalyzing(true)
    // TODO: Call analysis API
    setTimeout(() => setAnalyzing(false), 2000)
  }

  return (
    <AppLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Code Analysis</h1>
          <p className="text-zinc-400">
            Analyze code quality, detect technical debt, and get optimization suggestions
          </p>
        </div>

        {/* Repository Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Target</CardTitle>
            <CardDescription>Choose which codebase to analyze</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Self-improvement option */}
              <button
                onClick={() => setSelectedRepo('self')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedRepo === 'self'
                    ? 'border-[#5E6AD2] bg-[#5E6AD2]/10'
                    : 'border-white/[0.08] hover:border-white/[0.16] bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles className="h-5 w-5 text-[#5E6AD2]" />
                  <span className="font-medium text-white">Prometheus (Self)</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Analyze and improve my own codebase
                </p>
              </button>

              {/* Repository options */}
              {repositories.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => setSelectedRepo(repo.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedRepo === repo.id
                      ? 'border-[#5E6AD2] bg-[#5E6AD2]/10'
                      : 'border-white/[0.08] hover:border-white/[0.16] bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <GitBranch className="h-5 w-5 text-blue-400" />
                    <span className="font-medium text-white">{repo.name}</span>
                  </div>
                  <p className="text-xs text-zinc-400">{repo.branch}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

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
                onClick={() => handleAnalyze('quality')}
              >
                {analyzing ? 'Analyzing...' : 'Run Analysis'}
              </Button>
              <p className="text-xs text-zinc-500 mt-2">
                {selectedRepo === 'self' 
                  ? 'Analyze Prometheus codebase' 
                  : `Analyze ${repositories.find(r => r.id === selectedRepo)?.name || 'repository'}`
                }
              </p>
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
                onClick={() => handleAnalyze('debt')}
              >
                Detect Debt
              </Button>
              <p className="text-xs text-zinc-500 mt-2">
                Find TODOs, FIXMEs, and code smells
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                {selectedRepo === 'self' ? 'Self-Improvement' : 'Optimization'}
              </CardTitle>
              <CardDescription>
                {selectedRepo === 'self' 
                  ? 'Improve my own code' 
                  : 'Get improvement suggestions'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                variant="outline"
                disabled={analyzing}
                onClick={() => handleAnalyze('optimize')}
              >
                {selectedRepo === 'self' ? 'Self-Improve' : 'Optimize'}
              </Button>
              <p className="text-xs text-zinc-500 mt-2">
                {selectedRepo === 'self' 
                  ? 'Dev/Prod safe improvements' 
                  : 'Performance & architecture tips'
                }
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              {selectedRepo === 'self' 
                ? 'Self-analysis findings and improvement suggestions' 
                : 'Recent analysis findings'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center text-zinc-400 py-8">
              <FileCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No analysis results yet</p>
              <p className="text-sm mt-2">
                {selectedRepo === 'self' 
                  ? 'Run self-analysis to see how I can improve my own code' 
                  : 'Run an analysis to see results here'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
