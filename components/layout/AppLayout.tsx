'use client'
import { ReactNode, useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { ChatProvider, ChatPanel, useChatContext } from '@/components/chat'

interface Props {
  children: ReactNode
}

function AppLayoutContent({ children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const chat = useChatContext()

  // Load sidebar state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebarOpen')
    if (saved !== null) setSidebarOpen(saved === 'true')
  }, [])

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarOpen', String(sidebarOpen))
  }, [sidebarOpen])

  // Keyboard shortcut: Cmd/Ctrl + B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b' && !e.shiftKey) {
        e.preventDefault()
        setSidebarOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen bg-[#0A0A0B] overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar />

        {/* Page Content - Shrinks when chat is open */}
        <main 
          className="flex-1 overflow-y-auto transition-all duration-300 ease-out"
          style={{
            marginRight: chat.isOpen ? `${chat.width}px` : '0px'
          }}
        >
          {children}
        </main>
      </div>
      
      {/* Chat Panel */}
      <ChatPanel />
    </div>
  )
}

export default function AppLayout({ children }: Props) {
  return (
    <ChatProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </ChatProvider>
  )
}
