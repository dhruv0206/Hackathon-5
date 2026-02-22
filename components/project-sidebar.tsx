'use client'

import { useEffect, useState } from 'react'
import { Building2, DollarSign, Clock, AlertCircle } from 'lucide-react'

interface ProjectOverview {
  projectId: string
  projectName: string
  generalContractor: string
  contractValue: number
  startDate: string
  substantialCompletion: string
  percentComplete: number
  cumulativeBilled: number
  approvedCOs: number
  approvedCOsAmount: number
  pendingCOs: number
  pendingCOsAmount: number
  openRFIs: number
}

interface ProjectSidebarProps {
  selectedProject: string | null
  onSelectProject: (projectId: string) => void
}

export function ProjectSidebar({ selectedProject, onSelectProject }: ProjectSidebarProps) {
  const [projects, setProjects] = useState<ProjectOverview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch portfolio overview
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        setProjects(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('[v0] Failed to load projects:', err)
        setLoading(false)
      })
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="w-80 bg-card border-r border-border p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Loading projects...</div>
      </div>
    )
  }

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">HVAC Portfolio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {projects.length} Active Projects
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {projects.map((project) => (
          <button
            key={project.projectId}
            onClick={() => onSelectProject(project.projectId)}
            className={`w-full text-left p-4 rounded-lg border transition-colors ${
              selectedProject === project.projectId
                ? 'bg-primary/10 border-primary'
                : 'bg-secondary border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm text-foreground leading-tight mb-1">
                  {project.projectName}
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {project.projectId}
                </p>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-foreground font-medium">
                      {formatCurrency(project.contractValue)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {formatPercent(project.percentComplete)} Complete
                    </span>
                  </div>

                  {project.pendingCOs > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-amber-500">
                        {project.pendingCOs} Pending COs
                      </span>
                    </div>
                  )}

                  {project.openRFIs > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-orange-500">
                        {project.openRFIs} Open RFIs
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Total Contract Value:</span>
            <span className="font-medium text-foreground">
              {formatCurrency(projects.reduce((sum, p) => sum + p.contractValue, 0))}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Pending Change Orders:</span>
            <span className="font-medium text-amber-500">
              {formatCurrency(projects.reduce((sum, p) => sum + p.pendingCOsAmount, 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
