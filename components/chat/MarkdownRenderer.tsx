'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const language = match ? match[1] : ''
            const code = String(children).replace(/\n$/, '')

            if (!inline && language) {
              return (
                <CodeBlock code={code} language={language} />
              )
            }

            return (
              <code
                className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[#5E6AD2] font-mono text-xs"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre({ children }) {
            return <>{children}</>
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5E6AD2] hover:text-[#7C85E3] underline transition-colors"
              >
                {children}
              </a>
            )
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border border-white/[0.08] rounded-lg">
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className="px-4 py-2 bg-white/[0.04] border-b border-white/[0.08] text-left text-sm font-semibold text-zinc-200">
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className="px-4 py-2 border-b border-white/[0.08] text-sm text-zinc-300">
                {children}
              </td>
            )
          },
          ul({ children }) {
            return <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-[#5E6AD2] pl-4 py-2 my-4 bg-white/[0.02] italic text-zinc-400">
                {children}
              </blockquote>
            )
          },
          h1({ children }) {
            return <h1 className="text-2xl font-bold text-white mt-6 mb-3">{children}</h1>
          },
          h2({ children }) {
            return <h2 className="text-xl font-bold text-white mt-5 mb-2">{children}</h2>
          },
          h3({ children }) {
            return <h3 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h3>
          },
          p({ children }) {
            return <p className="text-zinc-300 leading-relaxed my-2">{children}</p>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1E1E1E] border-b border-white/[0.08] rounded-t-lg">
        <span className="text-xs text-zinc-400 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 0.5rem 0.5rem',
          background: '#1E1E1E',
          fontSize: '0.875rem',
          padding: '1rem',
        }}
        showLineNumbers
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
