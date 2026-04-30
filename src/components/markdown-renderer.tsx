'use client'

import ReactMarkdown from 'react-markdown'

interface MarkdownRendererProps {
  content: string
  className?: string
}

/**
 * Renders markdown content with proper styling for chat bubbles and comments.
 * Supports code blocks, inline code, links, lists, and basic markdown.
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      className={`prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-pre:my-2 prose-code:before:content-[''] prose-code:after:content-[''] prose-headings:my-2 ${className}`}
      components={{
        // Code blocks
        code({ className: codeClassName, children, ...props }) {
          const isInline = !codeClassName
          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-muted/80 text-primary/90 text-[12px] font-mono"
                {...props}
              >
                {children}
              </code>
            )
          }
          return (
            <code className={`${codeClassName} block text-[12px]`} {...props}>
              {children}
            </code>
          )
        },
        // Pre blocks (code fences)
        pre({ children }) {
          return (
            <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-3 overflow-x-auto text-[12px] leading-relaxed border border-border/50">
              {children}
            </pre>
          )
        },
        // Links
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              {children}
            </a>
          )
        },
        // Lists
        ul({ children }) {
          return <ul className="list-disc list-outside ml-4 my-1 space-y-0.5">{children}</ul>
        },
        ol({ children }) {
          return <ol className="list-decimal list-outside ml-4 my-1 space-y-0.5">{children}</ol>
        },
        // Paragraphs
        p({ children }) {
          return <p className="whitespace-pre-wrap break-words">{children}</p>
        },
        // Bold
        strong({ children }) {
          return <strong className="font-semibold text-foreground">{children}</strong>
        },
        // Headers
        h1({ children }) {
          return <h1 className="text-base font-bold text-foreground mt-3 mb-1">{children}</h1>
        },
        h2({ children }) {
          return <h2 className="text-sm font-bold text-foreground mt-2 mb-1">{children}</h2>
        },
        h3({ children }) {
          return <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>
        },
        // Blockquotes
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">
              {children}
            </blockquote>
          )
        },
        // Horizontal rule
        hr() {
          return <hr className="my-3 border-border/50" />
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
