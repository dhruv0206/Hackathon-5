'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
    DollarSign,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    Clock,
    Users,
    Building,
    FileText,
    Calendar,
    BarChart3
} from 'lucide-react'

interface ProjectData {
    project_id: string
    project_name: string
    original_contract_value: number
    contract_date: string
    substantial_completion_date: string
    gc_name: string
    cumulative_billed: number
    retention_held: number
    progress_percentage: number
    status: 'On Track' | 'At Risk' | 'Delayed' | 'Complete'
    open_rfis: number
    change_orders: number
}

interface DashboardStats {
    totalContractValue: number
    totalBilled: number
    totalRetention: number
    activeProjects: number
    completedProjects: number
    totalRFIs: number
    totalChangeOrders: number
    averageProgress: number
}

export function StatsDashboard() {
    const [stats, setStats] = useState<DashboardStats>({
        totalContractValue: 100988000,
        totalBilled: 85420000,
        totalRetention: 8542000,
        activeProjects: 5,
        completedProjects: 0,
        totalRFIs: 317,
        totalChangeOrders: 64,
        averageProgress: 72.5
    })

    const [projects, setProjects] = useState<ProjectData[]>([
        {
            project_id: 'PRJ-2024-001',
            project_name: 'Mercy General Hospital - HVAC Modernization',
            original_contract_value: 35194000,
            contract_date: '2024-03-27',
            substantial_completion_date: '2025-09-01',
            gc_name: 'Turner Construction',
            cumulative_billed: 34955400,
            retention_held: 3495540,
            progress_percentage: 99.3,
            status: 'Complete',
            open_rfis: 2,
            change_orders: 15
        },
        {
            project_id: 'PRJ-2024-002',
            project_name: 'Riverside Office Tower - Core & Shell MEP',
            original_contract_value: 30260000,
            contract_date: '2024-02-03',
            substantial_completion_date: '2026-01-27',
            gc_name: 'DPR Construction',
            cumulative_billed: 30075400,
            retention_held: 3007540,
            progress_percentage: 99.4,
            status: 'Complete',
            open_rfis: 1,
            change_orders: 12
        },
        {
            project_id: 'PRJ-2024-003',
            project_name: 'Greenfield Elementary School - New Construction',
            original_contract_value: 5544000,
            contract_date: '2024-02-19',
            substantial_completion_date: '2025-04-22',
            gc_name: 'DPR Construction',
            cumulative_billed: 5500700,
            retention_held: 550070,
            progress_percentage: 99.2,
            status: 'Complete',
            open_rfis: 0,
            change_orders: 8
        },
        {
            project_id: 'PRJ-2024-004',
            project_name: 'Summit Data Center - Phase 2 Expansion',
            original_contract_value: 16340000,
            contract_date: '2024-02-18',
            substantial_completion_date: '2024-11-27',
            gc_name: 'DPR Construction',
            cumulative_billed: 16205800,
            retention_held: 1620580,
            progress_percentage: 99.2,
            status: 'Complete',
            open_rfis: 3,
            change_orders: 11
        },
        {
            project_id: 'PRJ-2024-005',
            project_name: 'Harbor View Condominiums - 3 Buildings',
            original_contract_value: 13650000,
            contract_date: '2024-03-27',
            substantial_completion_date: '2025-11-07',
            gc_name: 'Skanska USA',
            cumulative_billed: 13556100,
            retention_held: 1355610,
            progress_percentage: 99.3,
            status: 'At Risk',
            open_rfis: 5,
            change_orders: 18
        }
    ])

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Complete': return 'bg-green-500'
            case 'On Track': return 'bg-blue-500'
            case 'At Risk': return 'bg-yellow-500'
            case 'Delayed': return 'bg-red-500'
            default: return 'bg-gray-500'
        }
    }

    const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'Complete': return 'default'
            case 'On Track': return 'secondary'
            case 'At Risk': return 'outline'
            case 'Delayed': return 'destructive'
            default: return 'secondary'
        }
    }

    return (
        <div className="flex-1 space-y-6 p-6 bg-background">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">HVAC Portfolio Dashboard</h1>
                    <p className="text-muted-foreground">
                        Real-time insights across all active construction projects
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="px-3 py-1">
                        <Calendar className="w-4 h-4 mr-1" />
                        Last Updated: {new Date().toLocaleDateString()}
                    </Badge>
                </div>
            </div>

            {/* Key Performance Indicators */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalContractValue)}</div>
                        <p className="text-xs text-muted-foreground">
                            Across {stats.activeProjects} active projects
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalBilled)}</div>
                        <p className="text-xs text-muted-foreground">
                            {((stats.totalBilled / stats.totalContractValue) * 100).toFixed(1)}% of total value
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Retention Held</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalRetention)}</div>
                        <p className="text-xs text-muted-foreground">
                            10% standard retention rate
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Issues</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalRFIs}</div>
                        <p className="text-xs text-muted-foreground">
                            RFIs + {stats.totalChangeOrders} Change Orders
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Portfolio Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building className="h-5 w-5" />
                            Project Portfolio Overview
                        </CardTitle>
                        <CardDescription>
                            Current status and progress across all projects
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {projects.map((project) => (
                                <div key={project.project_id} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">
                                                {project.project_name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {project.gc_name} • {formatCurrency(project.original_contract_value)}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Badge variant={getStatusVariant(project.status)}>
                                                {project.status}
                                            </Badge>
                                            <span className="text-sm font-medium">
                                                {project.progress_percentage.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                    <Progress value={project.progress_percentage} className="h-2" />
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Billed: {formatCurrency(project.cumulative_billed)}</span>
                                        <span>RFIs: {project.open_rfis} | COs: {project.change_orders}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Key Metrics
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Average Progress</span>
                                <span className="text-sm">{stats.averageProgress.toFixed(1)}%</span>
                            </div>
                            <Progress value={stats.averageProgress} className="h-2" />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Collection Rate</span>
                                <span className="text-sm">84.6%</span>
                            </div>
                            <Progress value={84.6} className="h-2" />
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4">
                            <div className="space-y-1">
                                <p className="text-2xl font-bold text-green-600">4</p>
                                <p className="text-xs text-muted-foreground">Projects Complete</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-2xl font-bold text-yellow-600">1</p>
                                <p className="text-xs text-muted-foreground">At Risk</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-2xl font-bold">{stats.totalRFIs}</p>
                                <p className="text-xs text-muted-foreground">Total RFIs</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-2xl font-bold">{stats.totalChangeOrders}</p>
                                <p className="text-xs text-muted-foreground">Change Orders</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Financial Summary */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Financial Performance Summary
                    </CardTitle>
                    <CardDescription>
                        Revenue recognition and cash flow analysis
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Contract Value</p>
                            <p className="text-2xl font-bold">{formatCurrency(stats.totalContractValue)}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Billed to Date</p>
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalBilled)}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Retention Held</p>
                            <p className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.totalRetention)}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Net Receivable</p>
                            <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalBilled - stats.totalRetention)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
