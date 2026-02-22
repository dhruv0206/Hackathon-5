import { tool } from 'ai'
import { z } from 'zod'
import {
  getContracts,
  getContract,
  getSOVByProject,
  getSOVBudgetByProject,
  getLaborLogsByProject,
  getLaborLogsBySOVLine,
  getMaterialDeliveriesByProject,
  getBillingHistoryByProject,
  getBillingLineItemsByProject,
  getChangeOrdersByProject,
  getRFIsByProject,
  getFieldNotesByProject,
  getFieldNotesBySOVLine,
  getProjectSummary,
} from '../data/queries'

export const tools = {
  getPortfolioOverview: tool({
    description: 'Get overview of all 5 HVAC projects in the portfolio including contract values, completion status, and high-level metrics',
    parameters: z.object({}),
    execute: async () => {
      const contracts = getContracts()
      return contracts.map(contract => {
        const summary = getProjectSummary(contract.project_id)
        return {
          projectId: contract.project_id,
          projectName: contract.project_name,
          generalContractor: contract.general_contractor,
          contractValue: contract.contract_value,
          startDate: contract.start_date,
          substantialCompletion: contract.substantial_completion,
          percentComplete: summary.percentComplete,
          cumulativeBilled: summary.cumulativeBilled,
          approvedCOs: summary.approvedCOsCount,
          approvedCOsAmount: summary.approvedCOsAmount,
          pendingCOs: summary.pendingCOsCount,
          pendingCOsAmount: summary.pendingCOsAmount,
          openRFIs: summary.openRFIsCount,
        }
      })
    },
  }),

  getProjectDetails: tool({
    description: 'Get detailed information about a specific project including contract terms, SOV breakdown, and current status',
    parameters: z.object({
      projectId: z.string().describe('The project ID (e.g., PRJ-2024-001)'),
    }),
    execute: async ({ projectId }) => {
      const contract = getContract(projectId)
      const sov = getSOVByProject(projectId)
      const summary = getProjectSummary(projectId)
      
      return {
        contract,
        sovItems: sov,
        summary,
      }
    },
  }),

  analyzeMargins: tool({
    description: 'Analyze profit margins for a project by comparing budgeted vs actual costs for labor and materials. Identifies cost overruns and margin erosion.',
    parameters: z.object({
      projectId: z.string().describe('The project ID to analyze'),
    }),
    execute: async ({ projectId }) => {
      const sov = getSOVByProject(projectId)
      const sovBudget = getSOVBudgetByProject(projectId)
      const laborLogs = getLaborLogsByProject(projectId)
      const materials = getMaterialDeliveriesByProject(projectId)
      
      const analysis = sov.map(sovItem => {
        const budget = sovBudget.find(b => b.sov_line_id === sovItem.sov_line_id)
        const laborForLine = laborLogs.filter(l => l.sov_line_id === sovItem.sov_line_id)
        const materialsForLine = materials.filter(m => m.sov_line_id === sovItem.sov_line_id)
        
        const actualLaborCost = laborForLine.reduce((sum, log) => {
          return sum + (log.hours * log.hourly_rate * log.burden_multiplier)
        }, 0)
        
        const actualMaterialCost = materialsForLine.reduce((sum, m) => sum + m.total_cost, 0)
        
        const budgetedLaborCost = budget?.budgeted_labor_cost || 0
        const budgetedMaterialCost = budget?.budgeted_material_cost || 0
        
        const laborVariance = actualLaborCost - budgetedLaborCost
        const materialVariance = actualMaterialCost - budgetedMaterialCost
        const totalVariance = laborVariance + materialVariance
        
        const laborVariancePercent = budgetedLaborCost > 0 
          ? (laborVariance / budgetedLaborCost) * 100 
          : 0
        const materialVariancePercent = budgetedMaterialCost > 0
          ? (materialVariance / budgetedMaterialCost) * 100
          : 0
        
        return {
          sovLineId: sovItem.sov_line_id,
          description: sovItem.description,
          budgetedLabor: budgetedLaborCost,
          actualLabor: actualLaborCost,
          laborVariance,
          laborVariancePercent,
          budgetedMaterial: budgetedMaterialCost,
          actualMaterial: actualMaterialCost,
          materialVariance,
          materialVariancePercent,
          totalVariance,
          budgetedHours: budget?.budgeted_labor_hours || 0,
          actualHours: laborForLine.reduce((sum, l) => sum + l.hours, 0),
        }
      })
      
      const totalBudgetedCost = analysis.reduce((sum, a) => sum + a.budgetedLabor + a.budgetedMaterial, 0)
      const totalActualCost = analysis.reduce((sum, a) => sum + a.actualLabor + a.actualMaterial, 0)
      const totalVariance = totalActualCost - totalBudgetedCost
      
      return {
        projectId,
        lineItemAnalysis: analysis.filter(a => Math.abs(a.totalVariance) > 100),
        summary: {
          totalBudgetedCost,
          totalActualCost,
          totalVariance,
          variancePercent: (totalVariance / totalBudgetedCost) * 100,
        },
      }
    },
  }),

  analyzeLaborProductivity: tool({
    description: 'Analyze labor productivity by comparing actual hours vs budgeted hours. Identifies inefficiencies and overtime patterns.',
    parameters: z.object({
      projectId: z.string().describe('The project ID to analyze'),
      sovLineId: z.string().optional().describe('Optional: analyze a specific SOV line item'),
    }),
    execute: async ({ projectId, sovLineId }) => {
      const sovBudget = getSOVBudgetByProject(projectId)
      const laborLogs = sovLineId 
        ? getLaborLogsBySOVLine(projectId, sovLineId)
        : getLaborLogsByProject(projectId)
      
      const analysis = sovBudget.map(budget => {
        const logsForLine = sovLineId
          ? laborLogs
          : laborLogs.filter(l => l.sov_line_id === budget.sov_line_id)
        
        const actualHours = logsForLine.reduce((sum, l) => sum + l.hours, 0)
        const overtimeHours = logsForLine.filter(l => l.overtime_flag === 'Yes').reduce((sum, l) => sum + l.hours, 0)
        const budgetedHours = budget.budgeted_labor_hours
        
        const hoursVariance = actualHours - budgetedHours
        const hoursVariancePercent = budgetedHours > 0 ? (hoursVariance / budgetedHours) * 100 : 0
        const overtimePercent = actualHours > 0 ? (overtimeHours / actualHours) * 100 : 0
        
        const actualProductivity = actualHours > 0 ? actualHours / (logsForLine.length || 1) : 0
        const estimatedProductivity = budget.estimated_productivity
        
        return {
          sovLineId: budget.sov_line_id,
          description: budget.description,
          budgetedHours,
          actualHours,
          hoursVariance,
          hoursVariancePercent,
          overtimeHours,
          overtimePercent,
          estimatedProductivity,
          actualProductivity,
          daysWorked: new Set(logsForLine.map(l => l.date)).size,
          uniqueWorkers: new Set(logsForLine.map(l => l.worker_name)).size,
        }
      })
      
      return {
        projectId,
        sovLineId,
        analysis: analysis.filter(a => a.actualHours > 0),
      }
    },
  }),

  getChangeOrderStatus: tool({
    description: 'Get status of change orders including pending approvals and their financial impact. Critical for identifying unbilled work.',
    parameters: z.object({
      projectId: z.string().describe('The project ID'),
      status: z.enum(['Approved', 'Pending', 'Rejected', 'All']).optional().describe('Filter by status'),
    }),
    execute: async ({ projectId, status = 'All' }) => {
      let changeOrders = getChangeOrdersByProject(projectId)
      
      if (status !== 'All') {
        changeOrders = changeOrders.filter(co => co.status === status)
      }
      
      const summary = {
        total: changeOrders.length,
        approved: changeOrders.filter(co => co.status === 'Approved').length,
        pending: changeOrders.filter(co => co.status === 'Pending').length,
        rejected: changeOrders.filter(co => co.status === 'Rejected').length,
        approvedAmount: changeOrders.filter(co => co.status === 'Approved').reduce((sum, co) => sum + co.amount, 0),
        pendingAmount: changeOrders.filter(co => co.status === 'Pending').reduce((sum, co) => sum + co.amount, 0),
        totalLaborImpact: changeOrders.reduce((sum, co) => sum + co.labor_impact_hours, 0),
        totalScheduleImpact: changeOrders.reduce((sum, co) => sum + co.schedule_impact_days, 0),
      }
      
      return {
        projectId,
        changeOrders,
        summary,
      }
    },
  }),

  getBillingStatus: tool({
    description: 'Analyze billing history and identify billing lags or retention issues. Shows what work has been completed but not yet billed.',
    parameters: z.object({
      projectId: z.string().describe('The project ID'),
    }),
    execute: async ({ projectId }) => {
      const billingHistory = getBillingHistoryByProject(projectId)
      const billingLineItems = getBillingLineItemsByProject(projectId)
      const sov = getSOVByProject(projectId)
      
      const latestBilling = billingHistory.sort(
        (a, b) => new Date(b.application_date).getTime() - new Date(a.application_date).getTime()
      )[0]
      
      const unbilledWork = sov.map(sovItem => {
        const lineItemsForSOV = billingLineItems.filter(b => b.sov_line_id === sovItem.sov_line_id)
        const totalBilled = lineItemsForSOV.reduce((sum, b) => sum + b.total_completed_and_stored, 0)
        const unbilled = sovItem.total_amount - totalBilled
        
        return {
          sovLineId: sovItem.sov_line_id,
          description: sovItem.description,
          scheduledValue: sovItem.total_amount,
          totalBilled,
          unbilled,
          percentBilled: (totalBilled / sovItem.total_amount) * 100,
        }
      })
      
      const totalRetentionHeld = billingHistory.reduce((sum, b) => sum + b.retention_held, 0)
      const totalBilled = billingHistory.reduce((sum, b) => sum + b.amount_billed, 0)
      
      return {
        projectId,
        latestBilling,
        billingHistory,
        unbilledWork: unbilledWork.filter(u => u.unbilled > 1000),
        summary: {
          totalBilled,
          totalRetentionHeld,
          cumulativeBilled: latestBilling?.cumulative_billed || 0,
          cumulativeRetained: latestBilling?.cumulative_retained || 0,
        },
      }
    },
  }),

  getRFIAnalysis: tool({
    description: 'Analyze RFIs for cost and schedule impacts. Identifies high-priority open RFIs that may affect margins.',
    parameters: z.object({
      projectId: z.string().describe('The project ID'),
      status: z.enum(['Open', 'In Review', 'Closed', 'All']).optional().describe('Filter by status'),
      priority: z.enum(['High', 'Medium', 'Low', 'All']).optional().describe('Filter by priority'),
    }),
    execute: async ({ projectId, status = 'All', priority = 'All' }) => {
      let rfis = getRFIsByProject(projectId)
      
      if (status !== 'All') {
        rfis = rfis.filter(r => r.status === status)
      }
      
      if (priority !== 'All') {
        rfis = rfis.filter(r => r.priority === priority)
      }
      
      const withCostImpact = rfis.filter(r => r.cost_impact === 'Yes')
      const withScheduleImpact = rfis.filter(r => r.schedule_impact === 'Yes')
      const highPriorityOpen = rfis.filter(r => r.priority === 'High' && (r.status === 'Open' || r.status === 'In Review'))
      
      return {
        projectId,
        rfis,
        summary: {
          total: rfis.length,
          open: rfis.filter(r => r.status === 'Open').length,
          inReview: rfis.filter(r => r.status === 'In Review').length,
          closed: rfis.filter(r => r.status === 'Closed').length,
          withCostImpact: withCostImpact.length,
          withScheduleImpact: withScheduleImpact.length,
          highPriorityOpen: highPriorityOpen.length,
        },
        highPriorityOpen,
      }
    },
  }),

  searchFieldNotes: tool({
    description: 'Search field notes for specific issues, delays, or problems. Useful for understanding context behind cost overruns.',
    parameters: z.object({
      projectId: z.string().describe('The project ID'),
      sovLineId: z.string().optional().describe('Optional: filter by SOV line'),
      keywords: z.string().describe('Keywords to search for in notes (e.g., "delay", "issue", "rework")'),
    }),
    execute: async ({ projectId, sovLineId, keywords }) => {
      let fieldNotes = sovLineId
        ? getFieldNotesBySOVLine(projectId, sovLineId)
        : getFieldNotesByProject(projectId)
      
      const keywordLower = keywords.toLowerCase()
      const matchingNotes = fieldNotes.filter(note => {
        const searchText = `${note.summary} ${note.details} ${note.issues}`.toLowerCase()
        return searchText.includes(keywordLower)
      })
      
      return {
        projectId,
        sovLineId,
        keywords,
        totalNotes: fieldNotes.length,
        matchingNotes: matchingNotes.slice(0, 50),
      }
    },
  }),

  getProjectRiskFactors: tool({
    description: 'Identify high-risk areas of a project based on budget risk factors, cost variances, and open issues.',
    parameters: z.object({
      projectId: z.string().describe('The project ID'),
    }),
    execute: async ({ projectId }) => {
      const sovBudget = getSOVBudgetByProject(projectId)
      const changeOrders = getChangeOrdersByProject(projectId)
      const rfis = getRFIsByProject(projectId)
      
      const highRiskItems = sovBudget.filter(b => b.risk_factor > 1.2)
      const pendingCOs = changeOrders.filter(co => co.status === 'Pending')
      const highPriorityRFIs = rfis.filter(r => r.priority === 'High' && r.status !== 'Closed')
      
      return {
        projectId,
        highRiskSOVItems: highRiskItems,
        pendingChangeOrders: pendingCOs,
        highPriorityOpenRFIs: highPriorityRFIs,
        summary: {
          highRiskItemsCount: highRiskItems.length,
          pendingCOsAmount: pendingCOs.reduce((sum, co) => sum + co.amount, 0),
          criticalRFIsCount: highPriorityRFIs.length,
        },
      }
    },
  }),
}
