'use client'

import { type Message } from 'ai'
import { Send, Bot, User } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ChatInterfaceProps {
  messages: Message[]
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  selectedProject: string | null
}

export function ChatInterface({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  selectedProject,
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const suggestedPrompts = [
    'Show me a portfolio overview of all projects',
    'Which projects have the highest margin risk?',
    'Analyze labor cost overruns across all projects',
    'Find unbilled change orders',
    'What are the top RFIs affecting margins?',
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Margin Rescue Agent</h2>
        <p className="text-sm text-muted-foreground mt-1">
          AI-powered margin protection for HVAC construction
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Welcome to Margin Rescue Agent
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              I can help you identify margin erosion, find unbilled work, and protect profitability across your HVAC portfolio.
            </p>
            <div className="space-y-2 max-w-md mx-auto">
              <p className="text-xs text-muted-foreground mb-3">Try asking:</p>
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const event = new Event('submit', { bubbles: true, cancelable: true }) as any
                    event.preventDefault = () => {}
                    handleInputChange({ target: { value: prompt } } as any)
                    setTimeout(() => {
                      const form = document.querySelector('form')
                      if (form) {
                        const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
                        form.dispatchEvent(submitEvent)
                      }
                    }, 100)
                  }}
                  className="w-full text-left p-3 text-sm rounded-lg bg-secondary hover:bg-secondary/80 border border-border transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {message.content}
              </div>
            </div>
            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="bg-secondary text-foreground rounded-lg p-4">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 border-t border-border">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder={
              selectedProject
                ? `Ask about ${selectedProject}...`
                : 'Ask about your HVAC projects...'
            }
            className="flex-1 px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
