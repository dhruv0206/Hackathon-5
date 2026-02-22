'use client'

import { useChat } from '@ai-sdk/react'
import { type Message } from 'ai'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { ToolChart, hasChart } from './charts/tool-chart'
import {
  Bot,
  Send,
  User,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  Sparkles,
  FileText,
  FileDown,
} from 'lucide-react'

const SUGGESTED_PROMPTS = [
  'How is my portfolio doing?',
  'Which projects have the highest margin risk?',
  'Analyze labor cost overruns across all projects',
  'Find change orders affecting margins',
  'Search field notes for rework and delays',
]

interface ToolCall {
  id: string
  name: string
  status: 'pending' | 'complete'
}

const TOOL_LABELS: Record<string, string> = {
  getPortfolioOverview: 'Loading portfolio overview',
  getProjectDetails: 'Fetching project details',
  analyzeMargins: 'Analyzing profit margins',
  analyzeLaborProductivity: 'Analyzing labor productivity',
  getChangeOrderStatus: 'Checking change orders',
  getBillingStatus: 'Reviewing billing status',
  getRFIAnalysis: 'Analyzing RFIs',
  searchFieldNotes: 'Searching field notes',
  getProjectRiskFactors: 'Identifying risk factors',
}

function extractToolCalls(messages: Message[]): ToolCall[] {
  const calls: ToolCall[] = []
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.toolInvocations) {
      for (const inv of msg.toolInvocations as any[]) {
        if (!calls.find((c) => c.id === inv.toolCallId)) {
          calls.push({
            id: inv.toolCallId,
            name: inv.toolName,
            status: inv.result ? 'complete' : 'pending',
          })
        }
      }
    }
  }
  return calls
}

// ─── Export helpers ────────────────────────────────────────────────────────────

function downloadMarkdown(content: string, messageIndex: number) {
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const header = `# HVAC Margin Rescue — Analysis Export\n_Generated: ${timestamp}_\n\n---\n\n`
  const blob = new Blob([header + content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `margin-analysis-${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadChartsPDF(containerId: string, messageIndex: number) {
  const element = document.getElementById(containerId)
  if (!element) return

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, {
    backgroundColor: '#0f172a',
    scale: 2,
    useCORS: true,
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const imgW = canvas.width / 2
  const imgH = canvas.height / 2

  const pdf = new jsPDF({
    orientation: imgW >= imgH ? 'landscape' : 'portrait',
    unit: 'px',
    format: [imgW + 40, imgH + 80],
    hotfixes: ['px_scaling'],
  })

  const timestamp = new Date().toLocaleString()
  pdf.setFontSize(11)
  pdf.setTextColor(100, 116, 139) // slate-500
  pdf.text('HVAC Margin Rescue — Chart Export', 20, 24)
  pdf.setFontSize(9)
  pdf.text(timestamp, 20, 38)

  pdf.addImage(imgData, 'PNG', 20, 50, imgW, imgH)
  pdf.save(`margin-charts-${Date.now()}.pdf`)
}

// ─── Export toolbar ────────────────────────────────────────────────────────────

function ExportToolbar({
  content,
  hasCharts,
  chartsContainerId,
  messageIndex,
}: {
  content: string
  hasCharts: boolean
  chartsContainerId: string
  messageIndex: number
}) {
  const [exporting, setExporting] = useState<'md' | 'pdf' | null>(null)

  async function handlePDF() {
    setExporting('pdf')
    try {
      await downloadChartsPDF(chartsContainerId, messageIndex)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="ml-9 flex items-center gap-1.5 pt-1">
      {content && (
        <button
          onClick={() => downloadMarkdown(content, messageIndex)}
          title="Export analysis as Markdown"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50 transition-colors"
        >
          <FileText className="w-3 h-3" />
          Export Analysis (.md)
        </button>
      )}
      {hasCharts && (
        <button
          onClick={handlePDF}
          disabled={exporting === 'pdf'}
          title="Export charts as PDF"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50 transition-colors disabled:opacity-50"
        >
          {exporting === 'pdf' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <FileDown className="w-3 h-3" />
          )}
          Export Charts (.pdf)
        </button>
      )}
    </div>
  )
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export function ChatPanel({ selectedProject }: { selectedProject: string | null }) {
  const [open, setOpen] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: '/api/chat',
  })

  const toolCalls = extractToolCalls(messages)
  const pendingTools = toolCalls.filter((t) => t.status === 'pending')
  const completedTools = toolCalls.filter((t) => t.status === 'complete')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function submitPrompt(prompt: string) {
    setInput(prompt)
    setTimeout(() => {
      const form = document.getElementById('chat-form') as HTMLFormElement | null
      if (form) form.requestSubmit()
    }, 50)
  }

  return (
    <>
      {/* Collapsed toggle strip */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-2 bg-primary text-primary-foreground px-2 py-4 rounded-l-xl shadow-lg hover:bg-primary/90 transition-colors"
        >
          <Bot className="w-5 h-5" />
          {isLoading && (
            <span className="w-2 h-2 rounded-full bg-yellow-300 animate-pulse" />
          )}
          {!isLoading && messages.length > 0 && (
            <span className="text-xs font-bold">{messages.filter(m => m.role === 'assistant').length}</span>
          )}
          <ChevronLeft className="w-4 h-4 mt-1" />
        </button>
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full z-50 flex flex-col bg-card border-l border-border shadow-2xl transition-all duration-300 ease-in-out ${
          open ? 'w-[420px] translate-x-0' : 'w-[420px] translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">Margin Rescue Agent</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isLoading ? 'Thinking...' : 'Ready'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Tool execution strip */}
        {toolCalls.length > 0 && (
          <div className="border-b border-border bg-secondary/30 flex-shrink-0">
            <button
              onClick={() => setShowTools(!showTools)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-primary" />
                )}
                <span>
                  {isLoading
                    ? `Running: ${pendingTools[0] ? (TOOL_LABELS[pendingTools[0].name] ?? pendingTools[0].name) : '...'}`
                    : `${completedTools.length} tools executed`}
                </span>
              </div>
              <span className="text-xs">{showTools ? '▲' : '▼'}</span>
            </button>

            {showTools && (
              <div className="px-4 pb-3 space-y-1.5 max-h-40 overflow-y-auto">
                {toolCalls.map((call, i) => (
                  <div key={call.id} className="flex items-center gap-2 text-xs">
                    {call.status === 'pending' ? (
                      <Loader2 className="w-3 h-3 animate-spin text-primary flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
                    )}
                    <span className="text-muted-foreground">
                      {TOOL_LABELS[call.name] ?? call.name}
                    </span>
                    <span className="text-muted-foreground/50">#{i + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-2">
              <Sparkles className="w-10 h-10 text-primary mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Ask anything about your portfolio</p>
              <p className="text-xs text-muted-foreground mb-5">
                I'll analyze margins, labor, billing, and risk across all 5 projects.
              </p>
              <div className="w-full space-y-2">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => submitPrompt(prompt)}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg bg-secondary hover:bg-secondary/70 border border-border text-foreground transition-colors leading-snug"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, msgIndex) => {
            const content = typeof message.content === 'string' ? message.content : ''
            const toolInvocations = (message.toolInvocations ?? []) as any[]
            const chartsToShow = toolInvocations.filter(
              (inv) => inv.state === 'result' && hasChart(inv.toolName)
            )
            const chartsContainerId = `charts-${message.id}`
            const isAssistant = message.role === 'assistant'

            if (!content && chartsToShow.length === 0) return null

            return (
              <div
                key={message.id}
                className={`flex flex-col gap-2 ${!isAssistant ? 'items-end' : 'items-start'}`}
              >
                {/* Message bubble row */}
                {content && (
                  <div className={`flex gap-2 w-full ${!isAssistant ? 'justify-end' : 'justify-start'}`}>
                    {isAssistant && (
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                        !isAssistant
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-foreground'
                      }`}
                    >
                      {isAssistant ? (
                        <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown>{content}</ReactMarkdown>
                        </div>
                      ) : (
                        content
                      )}
                    </div>
                    {!isAssistant && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}

                {/* Charts */}
                {isAssistant && chartsToShow.length > 0 && (
                  <div
                    id={chartsContainerId}
                    className="ml-9 w-[calc(100%-2.25rem)] space-y-2"
                  >
                    {chartsToShow.map((inv) => (
                      <ToolChart key={inv.toolCallId} toolName={inv.toolName} result={inv.result} />
                    ))}
                  </div>
                )}

                {/* Export toolbar — only for completed assistant messages */}
                {isAssistant && !isLoading && (content || chartsToShow.length > 0) && (
                  <ExportToolbar
                    content={content}
                    hasCharts={chartsToShow.length > 0}
                    chartsContainerId={chartsContainerId}
                    messageIndex={msgIndex}
                  />
                )}
              </div>
            )
          })}

          {isLoading && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="bg-secondary rounded-xl px-4 py-3">
                <div className="flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border flex-shrink-0">
          <form
            id="chat-form"
            onSubmit={handleSubmit}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder={
                selectedProject
                  ? `Ask about ${selectedProject}...`
                  : 'Ask about your portfolio...'
              }
              disabled={isLoading}
              className="flex-1 px-3 py-2.5 text-sm rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-3 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Backdrop on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}
