'use client'

import { User, Bot, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { MarkdownRenderer } from './MarkdownRenderer'
import { AttachedFile, FileAttachment } from './FileAttachment'

export interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  reasoning?: string
  metadata?: {
    model?: string
    provider?: string
    usage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }
  attachments?: AttachedFile[]
}

export function ChatMessage({ role, content, timestamp, reasoning, metadata, attachments }: ChatMessageProps) {
  const [showReasoning, setShowReasoning] = useState(false)
  const [showMetadata, setShowMetadata] = useState(false)

  const formatTime = (ts: number) => {
    const date = new Date(ts)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex items-start gap-4">
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        role === 'assistant'
          ? 'bg-gradient-to-br from-[#5E6AD2] to-[#7C85E3]'
          : 'bg-white/[0.08]'
      }`}>
        {role === 'assistant' ? (
          <Bot className="w-5 h-5 text-white" />
        ) : (
          <User className="w-5 h-5 text-zinc-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-white">
            {role === 'assistant' ? 'Prometheus' : 'You'}
          </span>
          <span className="text-xs text-zinc-500">{formatTime(timestamp)}</span>
          {metadata?.model && (
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {metadata.model}
            </button>
          )}
        </div>

        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="mb-3 space-y-2">
            {attachments.map((file) => (
              <FileAttachment key={file.id} file={file} showRemove={false} />
            ))}
          </div>
        )}

        {/* Message Content */}
        <div className={`rounded-2xl p-4 ${
          role === 'assistant'
            ? 'bg-[#111113]/80 backdrop-blur-xl border border-white/[0.08]'
            : 'bg-white/[0.04] border border-white/[0.06]'
        }`}>
          <MarkdownRenderer content={content} />
        </div>

        {/* Reasoning (if available) */}
        {reasoning && (
          <div className="mt-3">
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showReasoning ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              <span>Reasoning Process ({reasoning.length} chars)</span>
            </button>
            
            {showReasoning && (
              <div className="mt-2 p-3 rounded-lg bg-[#5E6AD2]/5 border border-[#5E6AD2]/20">
                <p className="text-xs text-zinc-400 font-mono leading-relaxed whitespace-pre-wrap">
                  {reasoning}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Metadata (if available) */}
        {showMetadata && metadata && (
          <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {metadata.provider && (
                <div>
                  <span className="text-zinc-500">Provider:</span>
                  <span className="text-zinc-300 ml-2">{metadata.provider}</span>
                </div>
              )}
              {metadata.usage && (
                <>
                  <div>
                    <span className="text-zinc-500">Tokens:</span>
                    <span className="text-zinc-300 ml-2">{metadata.usage.totalTokens}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Prompt:</span>
                    <span className="text-zinc-300 ml-2">{metadata.usage.promptTokens}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Completion:</span>
                    <span className="text-zinc-300 ml-2">{metadata.usage.completionTokens}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
