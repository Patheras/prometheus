'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useChatPanel } from './useChatPanel'

interface ChatContextType {
  isOpen: boolean
  width: number
  open: () => void
  close: () => void
  toggle: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = useChatPanel()

  return (
    <ChatContext.Provider value={chat}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}
