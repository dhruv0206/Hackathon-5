'use client'

import { ProjectSidebar } from '@/components/project-sidebar'
import { StatsDashboard } from '@/components/stats-dashboard'
import { ChatPanel } from '@/components/chat-panel'
import { useState } from 'react'

export default function HomePage() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Left Sidebar */}
      <ProjectSidebar
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
      />

      {/* Main Dashboard */}
      <div className="flex-1 overflow-auto">
        <StatsDashboard />
      </div>

      {/* Collapsible AI Chat — fixed on right edge */}
      <ChatPanel selectedProject={selectedProject} />
    </div>
  )
}
