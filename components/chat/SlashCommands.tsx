'use client'

import { Code, FileSearch, Zap, GitBranch, Database, Sparkles } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

export interface SlashCommand {
  command: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  category: 'analysis' | 'generation' | 'refactoring' | 'other'
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: '/analyze',
    description: 'Analyze code quality and patterns',
    icon: FileSearch,
    category: 'analysis',
  },
  {
    command: '/refactor',
    description: 'Suggest refactoring improvements',
    icon: Code,
    category: 'refactoring',
  },
  {
    command: '/optimize',
    description: 'Optimize performance',
    icon: Zap,
    category: 'refactoring',
  },
  {
    command: '/explain',
    description: 'Explain code or concept',
    icon: Sparkles,
    category: 'other',
  },
  {
    command: '/test',
    description: 'Generate unit tests',
    icon: GitBranch,
    category: 'generation',
  },
  {
    command: '/debug',
    description: 'Help debug an issue',
    icon: Code,
    category: 'analysis',
  },
  {
    command: '/schema',
    description: 'Analyze database schema',
    icon: Database,
    category: 'analysis',
  },
]

interface SlashCommandsMenuProps {
  onSelect: (command: string) => void
  onClose: () => void
  filter?: string
}

export function SlashCommandsMenu({ onSelect, onClose, filter = '' }: SlashCommandsMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const filteredCommands = SLASH_COMMANDS.filter(cmd =>
    cmd.command.toLowerCase().includes(filter.toLowerCase()) ||
    cmd.description.toLowerCase().includes(filter.toLowerCase())
  )
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex].command)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, filteredCommands, onSelect, onClose])
  
  if (filteredCommands.length === 0) {
    return null
  }
  
  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 mb-2 w-80 bg-[#111113] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-white/[0.08]">
        <p className="text-xs text-zinc-500 font-medium">SLASH COMMANDS</p>
      </div>
      
      <div className="max-h-64 overflow-y-auto">
        {filteredCommands.map((cmd, index) => {
          const Icon = cmd.icon
          return (
            <button
              key={cmd.command}
              onClick={() => onSelect(cmd.command)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${
                index === selectedIndex
                  ? 'bg-[#5E6AD2]/10 border-l-2 border-[#5E6AD2]'
                  : 'hover:bg-white/[0.04]'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                index === selectedIndex ? 'bg-[#5E6AD2]/20' : 'bg-white/[0.04]'
              }`}>
                <Icon className={`w-4 h-4 ${
                  index === selectedIndex ? 'text-[#5E6AD2]' : 'text-zinc-400'
                }`} />
              </div>
              
              <div className="flex-1 text-left">
                <p className={`text-sm font-medium ${
                  index === selectedIndex ? 'text-white' : 'text-zinc-200'
                }`}>
                  {cmd.command}
                </p>
                <p className="text-xs text-zinc-500">{cmd.description}</p>
              </div>
            </button>
          )
        })}
      </div>
      
      <div className="px-3 py-2 border-t border-white/[0.08] bg-white/[0.02]">
        <p className="text-xs text-zinc-500">
          <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-400 font-mono text-[10px]">↑↓</kbd> Navigate
          {' '}
          <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-400 font-mono text-[10px]">Enter</kbd> Select
          {' '}
          <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-400 font-mono text-[10px]">Esc</kbd> Close
        </p>
      </div>
    </div>
  )
}
