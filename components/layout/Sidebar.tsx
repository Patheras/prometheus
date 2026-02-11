'use client'
import { useState } from 'react'
import {
  LayoutDashboard,
  Code,
  Database,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  GitBranch,
  FileCode,
  BarChart3,
  LayoutGrid,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  isOpen: boolean
  onToggle: () => void
}

export default function Sidebar({ isOpen, onToggle }: Props) {
  const pathname = usePathname()

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Custom Canvas',
      href: '/canvas',
      icon: LayoutGrid,
    },
    {
      name: 'Self-Evolution',
      href: '/evolution',
      icon: Sparkles,
    },
    {
      name: 'Workspace',
      href: '/workspace',
      icon: LayoutDashboard,
    },
    {
      name: 'Repositories',
      href: '/repositories',
      icon: GitBranch,
    },
    {
      name: 'Code Analysis',
      href: '/analysis',
      icon: Code,
    },
    {
      name: 'Consultations',
      href: '/consultations',
      icon: FileCode,
    },
    {
      name: 'Metrics',
      href: '/metrics',
      icon: BarChart3,
    },
    {
      name: 'Memory',
      href: '/memory',
      icon: Database,
    },
    {
      name: 'Runtime',
      href: '/runtime',
      icon: Zap,
    },
    {
      name: 'Activity',
      href: '/activity',
      icon: Activity,
    },
  ]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  if (!isOpen) {
    return (
      <div className="w-16 h-screen bg-[#0A0A0B] border-r border-white/[0.08] flex flex-col py-4 gap-2">
        {/* Toggle button */}
        <button
          onClick={onToggle}
          className="mx-2 p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
          title="Open sidebar"
        >
          <ChevronRight className="h-5 w-5 text-zinc-400" />
        </button>

        {/* Icon navigation */}
        <nav className="flex-1 flex flex-col items-center gap-2 px-2">
          {navigation.map(({ name, href, icon: Icon }) => {
            const active = isActive(href)

            return (
              <Link key={href} href={href}>
                <div
                  className={`p-3 rounded-xl transition-all duration-200 ${
                    active
                      ? 'bg-[#5E6AD2]/20 text-[#5E6AD2]'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                  title={name}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Settings icon */}
        <div className="px-2">
          <Link href="/settings">
            <div className="p-3 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors">
              <Settings className="h-5 w-5" />
            </div>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <aside className="w-64 h-screen bg-[#0A0A0B] border-r border-white/[0.08] flex flex-col transition-all duration-300">
      {/* Header with Toggle */}
      <div className="p-6 border-b border-white/[0.08] flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">Navigation</h2>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
          title="Close sidebar"
        >
          <ChevronLeft className="h-4 w-4 text-zinc-400" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigation.map(({ name, href, icon: Icon }) => {
          const active = isActive(href)

          return (
            <Link key={href} href={href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  active
                    ? 'bg-[#5E6AD2]/20 border border-[#5E6AD2]/40 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-[#5E6AD2]' : ''}`} />
                <span className="text-sm font-medium">{name}</span>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Settings */}
      <div className="p-3 border-t border-white/[0.08]">
        <Link href="/settings">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors">
            <Settings className="h-5 w-5" />
            <span className="text-sm font-medium">Settings</span>
          </div>
        </Link>
      </div>
    </aside>
  )
}
