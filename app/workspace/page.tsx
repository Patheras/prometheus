'use client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Folder, File, GitBranch, Clock, Sparkles } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { useState, useEffect } from 'react'

interface Repository {
  id: string
  name: string
  url: string
  branch: string
}

export default function WorkspacePage() {
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

  return (
    <AppLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Workspace</h1>
          <p className="text-zinc-400">
            Browse and manage codebase files
          </p>
        </div>

        {/* Repository Selection */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedRepo('self')}
            className={`px-4 py-2 rounded-lg border transition-all whitespace-nowrap flex items-center gap-2 ${
              selectedRepo === 'self'
                ? 'border-[#5E6AD2] bg-[#5E6AD2]/10 text-white'
                : 'border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/[0.16]'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Prometheus (Self)
          </button>
          {repositories.map((repo) => (
            <button
              key={repo.id}
              onClick={() => setSelectedRepo(repo.id)}
              className={`px-4 py-2 rounded-lg border transition-all whitespace-nowrap flex items-center gap-2 ${
                selectedRepo === repo.id
                  ? 'border-[#5E6AD2] bg-[#5E6AD2]/10 text-white'
                  : 'border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/[0.16]'
              }`}
            >
              <GitBranch className="h-4 w-4" />
              {repo.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Total Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {selectedRepo === 'self' ? '342' : '156'}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Indexed files</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Code Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {selectedRepo === 'self' ? '287' : '124'}
              </div>
              <p className="text-xs text-zinc-500 mt-1">TypeScript/JavaScript</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Last Scan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">2m</div>
              <p className="text-xs text-zinc-500 mt-1">ago</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Branches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {selectedRepo === 'self' ? '1' : '3'}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {selectedRepo === 'self' ? 'main' : 'Active branches'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>File Browser</CardTitle>
            <CardDescription>
              {selectedRepo === 'self' 
                ? 'Browse Prometheus codebase structure' 
                : `Browse ${repositories.find(r => r.id === selectedRepo)?.name || 'repository'} structure`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(selectedRepo === 'self' 
                ? [
                    { name: 'src/', type: 'folder', files: 156 },
                    { name: 'components/', type: 'folder', files: 42 },
                    { name: 'app/', type: 'folder', files: 28 },
                    { name: 'lib/', type: 'folder', files: 18 },
                    { name: 'package.json', type: 'file', size: '2.4 KB' },
                    { name: 'tsconfig.json', type: 'file', size: '1.2 KB' },
                  ]
                : [
                    { name: 'src/', type: 'folder', files: 89 },
                    { name: 'tests/', type: 'folder', files: 24 },
                    { name: 'docs/', type: 'folder', files: 12 },
                    { name: 'README.md', type: 'file', size: '8.4 KB' },
                    { name: 'package.json', type: 'file', size: '1.8 KB' },
                  ]
              ).map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  {item.type === 'folder' ? (
                    <Folder className="h-5 w-5 text-blue-400 flex-shrink-0" />
                  ) : (
                    <File className="h-5 w-5 text-zinc-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200">{item.name}</p>
                    <p className="text-xs text-zinc-500">
                      {item.type === 'folder' ? `${item.files} files` : item.size}
                    </p>
                  </div>
                  {item.type === 'folder' && (
                    <GitBranch className="h-4 w-4 text-zinc-500" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
