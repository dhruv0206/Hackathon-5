'use client'

import { type Message } from 'ai'
import { useEffect, useState } from 'react'
import {
  Search,
  DollarSign,
  TrendingDown,
  FileText,
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
  Wrench,
} from 'lucide-react'

interface ToolVisualizationProps {
  messages: Message[]
}

interface ToolCall {
  id: string
  name: string
  args: any
  result?: any
  timestamp: string
  status: 'pending' | 'complete' | 'error'
}

const TOOL_ICONS: Record<string, any> = {
  getPortfolioOverview: Search,
  getProjectDetails: FileText,
  analyzeMargins: DollarSign,
  analyzeLaborProductivity: TrendingDown,
  getChangeOrderStatus: FileText,
  getBillingStatus: DollarSign,
  getRFIAnalysis: AlertCircle,
  searchFieldNotes: Search,
  getProjectRiskFactors: AlertCircle,
}

const TOOL_DESCRIPTIONS: Record<string, string> = {
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

export function ToolVisualization({ messages }: ToolVisualizationProps) {
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])

  useEffect(() => {
    // Extract tool calls from messages
    const calls: ToolCall[] = []
    
    messages.forEach((message) => {
      if (message.role === 'assistant' && message.toolInvocations) {
        message.toolInvocations.forEach((invocation: any) => {
          const existingCall = calls.find(c => c.id === invocation.toolCallId)
          
          if (!existingCall) {
            calls.push({
              id: invocation.toolCallId,
              name: invocation.toolName,
              args: invocation.args,
              result: invocation.result,
              timestamp: new Date().toISOString(),
              status: invocation.result ? 'complete' : 'pending',
            })
          }
        })
      }
    })
    
    setToolCalls(calls)
  }, [messages])

  const formatArgs = (args: any) => {
    if (!args) return ''
    return Object.entries(args)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')
  }

  const formatResult = (result: any) => {
    if (!result) return null
    
    try {
      if (typeof result === 'object') {
        // Show summary statistics
        if (result.summary) {
          return (
            <div className="mt-2 p-2 bg-background/50 rounded text-xs space-y-1">
              {Object.entries(result.summary).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground">{key}:</span>
                  <span className="text-foreground font-medium">
                    {typeof value === 'number' && key.toLowerCase().includes('amount')
                      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          )
        }
        
        // Show array length
        if (Array.isArray(result)) {
          return (
            <div className="mt-2 text-xs text-muted-foreground">
              Found {result.length} items
            </div>
          )
        }
        
        // Show top-level keys
        return (
          <div className="mt-2 text-xs text-muted-foreground">
            {Object.keys(result).length} properties
          </div>
        )
      }
      
      return <div className="mt-2 text-xs text-muted-foreground">{String(result)}</div>
    } catch (e) {
      return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Tool Execution</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time analysis steps
        </p>
      </div>

      {/* Tool Calls Timeline */}
      <div className="flex-1 overflow-y-auto p-6">
        {toolCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Wrench className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground max-w-xs">
              Tool execution steps will appear here as the agent analyzes your projects
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {toolCalls.map((call, index) => {
              const Icon = TOOL_ICONS[call.name] || Wrench
              const description = TOOL_DESCRIPTIONS[call.name] || call.name

              return (
                <div
                  key={call.id}
                  className="border border-border rounded-lg p-4 bg-secondary/50"
                >
                  <div className="flex items-start gap-3">
                    {/* Status Indicator */}
                    <div className="flex-shrink-0 mt-0.5">
                      {call.status === 'pending' && (
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      )}
                      {call.status === 'complete' && (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      )}
                      {call.status === 'error' && (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      )}
                    </div>

                    {/* Tool Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-medium text-foreground">
                          {description}
                        </h3>
                      </div>

                      {Object.keys(call.args || {}).length > 0 && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {formatArgs(call.args)}
                        </p>
                      )}

                      {call.status === 'complete' && call.result && (
                        <div className="mt-2">
                          {formatResult(call.result)}
                        </div>
                      )}

                      {call.status === 'pending' && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Processing...
                        </p>
                      )}
                    </div>

                    {/* Step Number */}
                    <div className="flex-shrink-0 text-xs text-muted-foreground">
                      #{index + 1}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      {toolCalls.length > 0 && (
        <div className="p-4 border-t border-border bg-background/50">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground">
                  {toolCalls.filter(c => c.status === 'complete').length} Complete
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground">
                  {toolCalls.filter(c => c.status === 'pending').length} Running
                </span>
              </div>
            </div>
            <div className="text-muted-foreground">
              Total: {toolCalls.length} tools
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
