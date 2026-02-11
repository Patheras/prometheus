'use client'
import { Bell, Search, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { useChatContext } from '@/components/chat'

export default function TopBar() {
  const chat = useChatContext()

  return (
    <header className="h-14 border-b border-white/[0.08] bg-[#0A0A0B]/95 backdrop-blur-xl flex items-center justify-between px-6">
      {/* Left - Logo */}
      <Link href="/" className="group">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold text-white tracking-tight transition-all duration-200 hover:opacity-70">
            Prometheus
          </div>
          <Badge variant="secondary" className="text-[10px] px-2 py-0">
            ALPHA
          </Badge>
        </div>
      </Link>

      {/* Center - Search (placeholder) */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search repositories, files..."
            className="w-full h-9 pl-10 pr-4 bg-[#111113] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/40 transition-all"
          />
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2">
        {/* Chat Toggle */}
        <button 
          onClick={chat.toggle}
          className={`relative p-2.5 rounded-xl transition-all duration-200 hover:bg-white/[0.05] active:scale-95 ${
            chat.isOpen ? 'bg-[#5E6AD2]/10 text-[#5E6AD2]' : 'text-zinc-400 hover:text-white'
          }`}
          title={chat.isOpen ? 'Close Chat' : 'Open Chat'}
        >
          <MessageSquare className="h-5 w-5 transition-colors" />
        </button>

        {/* Notifications */}
        <button className="relative p-2.5 rounded-xl transition-all duration-200 hover:bg-white/[0.05] active:scale-95">
          <Bell className="h-5 w-5 text-zinc-400 hover:text-white transition-colors" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#5E6AD2] rounded-full" />
        </button>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111113] border border-white/[0.08]">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs text-zinc-400">Online</span>
        </div>
      </div>
    </header>
  )
}
