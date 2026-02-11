'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  GitBranch,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'

interface Repository {
  id: string
  name: string
  url: string
  branch: string
  status: 'healthy' | 'warning' | 'error'
  lastActivity: number
  issuesCount: number
  createdAt: number
}

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)

  useEffect(() => {
    loadRepositories()
  }, [])

  const loadRepositories = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/repositories')
      if (response.ok) {
        const data = await response.json()
        setRepositories(data.repositories || [])
      }
    } catch (error) {
      console.error('Failed to load repositories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this repository?')) return

    try {
      const response = await fetch(`/api/repositories/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setRepositories((prev) => prev.filter((r) => r.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete repository:', error)
    }
  }

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const getStatusIcon = (status: Repository['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-400" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-400" />
    }
  }

  const getStatusColor = (status: Repository['status']) => {
    switch (status) {
      case 'healthy':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'warning':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'error':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    }
  }

  return (
    <AppLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Repositories</h1>
            <p className="text-zinc-400">
              Manage and monitor your code repositories
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={loadRepositories}
              disabled={isLoading}
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="lg" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Add Repository
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Total Repositories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{repositories.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Healthy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">
                {repositories.filter((r) => r.status === 'healthy').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">
                {repositories.filter((r) => r.status === 'warning').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Total Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {repositories.reduce((sum, r) => sum + r.issuesCount, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Repositories List */}
        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <RefreshCw className="w-8 h-8 text-zinc-500 animate-spin mx-auto mb-4" />
                <p className="text-zinc-400">Loading repositories...</p>
              </CardContent>
            </Card>
          ) : repositories.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <GitBranch className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No repositories yet</h3>
                <p className="text-zinc-400 mb-4">
                  Add your first repository to start monitoring
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Repository
                </Button>
              </CardContent>
            </Card>
          ) : (
            repositories.map((repo) => (
              <Card key={repo.id} className="hover:border-[#5E6AD2]/40 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Status Icon */}
                      <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                        {getStatusIcon(repo.status)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{repo.name}</h3>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                              repo.status
                            )}`}
                          >
                            {repo.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-zinc-400 mb-3">
                          <div className="flex items-center gap-1.5">
                            <GitBranch className="w-4 h-4" />
                            <span>{repo.branch}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            <span>{formatTime(repo.lastActivity)}</span>
                          </div>
                          {repo.issuesCount > 0 && (
                            <div className="flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4" />
                              <span>{repo.issuesCount} issues</span>
                            </div>
                          )}
                        </div>

                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#5E6AD2] hover:text-[#7C85E3] flex items-center gap-1.5 transition-colors"
                        >
                          {repo.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        Analyze
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(repo.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  )
}
