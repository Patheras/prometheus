'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Code, Database, Zap, ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Home() {
  const router = useRouter()
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    // Check API health
    fetch('/api/health')
      .then((res) => res.json())
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'))
  }, [])

  const features = [
    {
      icon: Code,
      title: 'Code Analysis',
      description: 'AST-based parsing, complexity analysis, and code smell detection',
      color: 'text-blue-400',
    },
    {
      icon: Database,
      title: 'Memory Engine',
      description: 'Hybrid search with FTS5 keyword and vector similarity',
      color: 'text-purple-400',
    },
    {
      icon: Zap,
      title: 'Runtime Engine',
      description: 'Intelligent model selection with cascading fallback',
      color: 'text-yellow-400',
    },
    {
      icon: Activity,
      title: 'Self-Improvement',
      description: 'Continuous learning and pattern application',
      color: 'text-green-400',
    },
  ]

  return (
    <main className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center p-8">
      <div className="max-w-6xl w-full space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#5E6AD2]/10 border border-[#5E6AD2]/20">
            <div className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500 animate-pulse' : apiStatus === 'offline' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-sm text-zinc-300">
              {apiStatus === 'checking' && 'Checking API status...'}
              {apiStatus === 'online' && 'System Online'}
              {apiStatus === 'offline' && 'API Offline'}
            </span>
          </div>

          <h1 className="text-6xl font-bold bg-gradient-to-r from-[#5E6AD2] via-[#7C85E3] to-[#9B9FED] bg-clip-text text-transparent">
            Prometheus
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Self-improving meta-agent system for managing and evolving software projects
          </p>

          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => router.push('/dashboard')}>
              Open Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="https://github.com/your-org/prometheus" target="_blank">
                View on GitHub
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="hover:border-[#5E6AD2]/40 transition-all">
              <CardHeader>
                <feature.icon className={`h-8 w-8 ${feature.color} mb-2`} />
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status Section */}
        <Card>
          <CardHeader>
            <CardTitle>System Components</CardTitle>
            <CardDescription>All engines operational</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                'Memory Engine',
                'Runtime Engine',
                'Analysis Engine',
                'Decision Engine',
                'Evolution Engine',
                'Queue System',
              ].map((component) => (
                <div
                  key={component}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm text-zinc-200">{component}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-zinc-500">
          <p>
            Frontend: <span className="text-zinc-400">localhost:3000</span> | Backend API:{' '}
            <span className="text-zinc-400">localhost:3001</span>
          </p>
        </div>
      </div>
    </main>
  )
}

