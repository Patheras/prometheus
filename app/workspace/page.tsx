'use client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Folder, File, GitBranch, Clock } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'

export default function WorkspacePage() {
  return (
    <AppLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Workspace</h1>
          <p className="text-zinc-400">
            Browse and manage your codebase files
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Total Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">342</div>
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
              <div className="text-2xl font-bold text-white">287</div>
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
              <div className="text-2xl font-bold text-white">3</div>
              <p className="text-xs text-zinc-500 mt-1">Active branches</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>File Browser</CardTitle>
            <CardDescription>Browse your codebase structure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { name: 'src/', type: 'folder', files: 156 },
                { name: 'components/', type: 'folder', files: 42 },
                { name: 'app/', type: 'folder', files: 28 },
                { name: 'lib/', type: 'folder', files: 18 },
                { name: 'package.json', type: 'file', size: '2.4 KB' },
                { name: 'tsconfig.json', type: 'file', size: '1.2 KB' },
              ].map((item, index) => (
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
