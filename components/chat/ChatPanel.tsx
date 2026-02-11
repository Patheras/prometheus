'use client'

import { useState, useEffect, useRef } from 'react'
import { X, GripVertical, MessageSquare, Paperclip, Sparkles } from 'lucide-react'
import { ChatMessage, ChatMessageProps } from './ChatMessage'
import { cn } from '@/lib/utils'
import { useChatContext } from './ChatContext'
import { AttachedFile, FileAttachment, FileUpload } from './FileAttachment'
import { SlashCommandsMenu } from './SlashCommands'

export function ChatPanel() {
  const { isOpen, width: contextWidth, close } = useChatContext()
  const [messages, setMessages] = useState<ChatMessageProps[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [width, setWidth] = useState(contextWidth)
  const [isResizing, setIsResizing] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [showSlashCommands, setShowSlashCommands] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load conversation history on mount
  useEffect(() => {
    if (isOpen) {
      loadConversation()
    }
  }, [isOpen])

  // Handle resize
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartX.current - e.clientX
      const newWidth = Math.min(Math.max(resizeStartWidth.current + delta, 320), 800)
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      localStorage.setItem('chatPanelWidth', width.toString())
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, width])

  // Load saved width
  useEffect(() => {
    const savedWidth = localStorage.getItem('chatPanelWidth')
    if (savedWidth) {
      setWidth(parseInt(savedWidth, 10))
    }
  }, [])

  // Detect slash commands
  useEffect(() => {
    if (inputValue.startsWith('/')) {
      setShowSlashCommands(true)
      setSlashFilter(inputValue.slice(1))
    } else {
      setShowSlashCommands(false)
      setSlashFilter('')
    }
  }, [inputValue])

  const loadConversation = async () => {
    try {
      const response = await fetch('/api/chat/conversations?limit=1')
      if (response.ok) {
        const data = await response.json()
        if (data.conversations && data.conversations.length > 0) {
          const conversationId = data.conversations[0].id
          const messagesResponse = await fetch(`/api/chat/${conversationId}`)
          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json()
            setMessages(messagesData.messages || [])
          }
        }
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
    }
  }

  const handleSend = async () => {
    const message = inputValue.trim()
    if (!message || isLoading) return

    // Add user message immediately
    const userMessage: ChatMessageProps = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
      attachments: attachedFiles.length > 0 ? attachedFiles : undefined,
    }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setAttachedFiles([])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message,
          attachments: attachedFiles.length > 0 ? attachedFiles : undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const assistantMessage: ChatMessageProps = {
          role: 'assistant',
          content: data.content,
          timestamp: data.timestamp,
          reasoning: data.reasoning,
          metadata: {
            model: data.model,
            provider: data.provider,
            usage: data.usage,
          },
        }
        setMessages((prev) => [...prev, assistantMessage])
      } else {
        const error = await response.json()
        const errorMessage: ChatMessageProps = {
          role: 'assistant',
          content: `Error: ${error.message || 'Failed to send message'}`,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMessage: ChatMessageProps = {
        role: 'assistant',
        content: 'Error: Failed to connect to server',
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!showSlashCommands) {
        handleSend()
      }
    } else if (e.key === 'Escape') {
      setShowSlashCommands(false)
    }
  }

  const handleSlashCommandSelect = (command: string) => {
    setInputValue(command + ' ')
    setShowSlashCommands(false)
    inputRef.current?.focus()
  }

  const handleFilesSelected = (files: AttachedFile[]) => {
    setAttachedFiles((prev) => [...prev, ...files])
  }

  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  return (
    <>
      {/* Panel - No overlay, fixed to right */}
      <div
        ref={panelRef}
        className={cn(
          'fixed top-0 right-0 h-full bg-[#0A0A0B] border-l border-white/[0.08] z-50',
          'transition-transform duration-300 ease-out',
          'flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ width: `${width}px` }}
      >
        {/* Resize Handle */}
        <div
          className={cn(
            'absolute left-0 top-0 bottom-0 w-1 cursor-col-resize',
            'hover:bg-[#5E6AD2]/50 transition-colors',
            'group flex items-center justify-center',
            isResizing && 'bg-[#5E6AD2]'
          )}
          onMouseDown={(e) => {
            setIsResizing(true)
            resizeStartX.current = e.clientX
            resizeStartWidth.current = width
          }}
        >
          <div className="absolute left-0 w-4 h-full" />
          <GripVertical className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5E6AD2] to-[#7C85E3] flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Prometheus</h2>
              <p className="text-xs text-zinc-500">Meta-Agent Assistant</p>
            </div>
          </div>
          <button
            onClick={close}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.05] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5E6AD2] to-[#7C85E3] flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Start a conversation</h3>
              <p className="text-sm text-zinc-400 max-w-xs mb-4">
                Ask me anything about your codebase, architecture, or how I can help improve your workflow.
              </p>
              <div className="text-xs text-zinc-500 space-y-1">
                <p>💡 Try slash commands: <code className="text-[#5E6AD2]">/analyze</code>, <code className="text-[#5E6AD2]">/refactor</code></p>
                <p>📎 Attach files for code analysis</p>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <ChatMessage key={index} {...message} />
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5E6AD2] to-[#7C85E3] flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div className="bg-[#111113]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-zinc-600 rounded-full animate-pulse"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-white/[0.08]">
          {/* Attached Files */}
          {attachedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              {attachedFiles.map((file) => (
                <FileAttachment
                  key={file.id}
                  file={file}
                  onRemove={() => handleRemoveFile(file.id)}
                />
              ))}
            </div>
          )}

          <div className="relative group">
            {/* Slash Commands Menu */}
            {showSlashCommands && (
              <SlashCommandsMenu
                onSelect={handleSlashCommandSelect}
                onClose={() => setShowSlashCommands(false)}
                filter={slashFilter}
              />
            )}

            <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-[#0A0A0B]/80 backdrop-blur-xl border-2 border-white/[0.08] hover:border-white/[0.16] focus-within:border-[#5E6AD2] focus-within:shadow-[0_0_0_3px_rgba(94,106,210,0.1)] transition-all duration-300">
              {/* File Upload Button */}
              <label htmlFor="file-upload" className="cursor-pointer">
                <Paperclip className="w-5 h-5 text-zinc-500 hover:text-zinc-300 transition-colors" />
              </label>
              <FileUpload
                onFilesSelected={handleFilesSelected}
                accept="image/*,.txt,.js,.ts,.tsx,.jsx,.py,.java,.cpp,.c,.h,.css,.html,.json,.md"
              />

              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Prometheus... (/ for commands)"
                className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 text-base min-w-0 outline-none border-0 focus:outline-none focus:ring-0"
                disabled={isLoading}
              />
              
              <button 
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className={cn(
                  'group relative p-3 rounded-xl flex-shrink-0 overflow-hidden transition-all duration-500',
                  inputValue.trim() && !isLoading
                    ? 'bg-gradient-to-r from-[#5E6AD2] via-[#7C85E3] to-[#5E6AD2] bg-[length:200%_100%] text-white shadow-[0_0_16px_-4px_rgba(94,106,210,0.4)] hover:shadow-[0_0_24px_-6px_rgba(94,106,210,0.6)] hover:bg-[position:100%_0] hover:scale-105 active:scale-95'
                    : 'bg-white/[0.03] text-zinc-600 cursor-not-allowed'
                )}
              >
                {inputValue.trim() && !isLoading && (
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out">
                    <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
                  </div>
                )}
                
                <div className="relative z-10">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                
                {inputValue.trim() && !isLoading && (
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ring-2 ring-white/20" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
