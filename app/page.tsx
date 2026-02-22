'use client'

import { useChat } from '@ai-sdk/react'
import { ProjectSidebar } from '@/components/project-sidebar'
import { ChatInterface } from '@/components/chat-interface'
import { ToolVisualization } from '@/components/tool-visualization'
import { useEffect, useState } from 'react'

export default function HomePage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  })

  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Left Sidebar - Projects */}
      <ProjectSidebar
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
      />

      {/* Main Content Area - Split between Chat and Tool Visualization */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Interface */}
        <div className="flex flex-col w-1/2 border-r border-border">
          <ChatInterface
            messages={messages}
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            selectedProject={selectedProject}
          />
        </div>

        {/* Tool Visualization Panel */}
        <div className="flex flex-col w-1/2 bg-card">
          <ToolVisualization messages={messages} />
        </div>
      </div>
    </div>
  )
}
