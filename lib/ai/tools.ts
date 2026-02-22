import { tool } from 'ai'
import { z } from 'zod'
import {
  getContracts,
  getContract,
  getSOVByProject,
  getSOVBudgetByProject,
  getBillingHistoryByProject,
  getBillingLineItemsByProject,
  getChangeOrdersByProject,
  getRFIsByProject,
  searchFieldNotesByKeywords,
  getProjectSummary,
  getMarginAnalysisByProject,
  getLaborProductivityByProject,
} from '../data/queries'

function isTruthy(val: string | boolean | undefined): boolean {
  return val === true || val === 'True' || val === 'true'
}

export const tools = {
  getPortfolioOverview: tool({
    description:
      'Get overview of all 5 HVAC projects in the portfolio including contract values, completion status, and high-level risk metrics. Always call this first for any portfolio-wide question.',
    parameters: z.object({}),
    execute: async () => {
      const contracts = getContracts()
      return contracts.map((contract) => {
        const summary = getProjectSummary(contract.project_id)
        return {
          projectId: contract.project_id,
          projectName: contract.project_name,
          generalContractor: contract.gc_name,
          contractValue: contract.original_contract_value,
          substantialCompletion: contract.substantial_completion_date,
          percentComplete: summary.percentComplete,
          cumulativeBilled: summary.cumulativeBilled,
          retentionHeld: summary.retentionHeld,
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
    description:
      'Get contract terms and SOV line-item breakdown for a specific project. Only call this when the user explicitly asks for contract details or an SOV breakdown — do NOT call this during general portfolio analysis.',
    parameters: z.object({
      projectId: z.string().describe('The project ID (e.g., PRJ-2024-001)'),
    }),
    execute: async ({ projectId }) => {
      const contract = getContract(projectId)
      const sov = getSOVByProject(projectId)
      const summary = getProjectSummary(projectId)
      return { contract, sovItems: sov, summary }
    },
  }),

  analyzeMargins: tool({
    description:
      'Analyze profit margins for a project by comparing budgeted vs actual labor and material costs per SOV line. Uses SQL aggregation over 16K labor records — identifies exactly where margin is being lost and by how much.',
    parameters: z.object({
      projectId: z.string().describe('The project ID to analyze'),
    }),
    execute: async ({ projectId }) => {
      const rows = getMarginAnalysisByProject(projectId)

      const analysis = rows.map((r) => {
        const laborVariance = r.actual_labor_cost - r.estimated_labor_cost
        const materialVariance = r.actual_material_cost - r.estimated_material_cost
        const totalVariance = laborVariance + materialVariance

        return {
          sovLineId: r.sov_line_id,
          description: r.description,
          scheduledValue: r.scheduled_value,
          budgetedLaborHours: r.estimated_labor_hours,
          actualLaborHours: Math.round(r.actual_labor_hours),
          hoursVariance: Math.round(r.actual_labor_hours - r.estimated_labor_hours),
          budgetedLaborCost: r.estimated_labor_cost,
          actualLaborCost: Math.round(r.actual_labor_cost),
          laborVariance: Math.round(laborVariance),
          laborVariancePct:
            r.estimated_labor_cost > 0
              ? Math.round((laborVariance / r.estimated_labor_cost) * 1000) / 10
              : 0,
          budgetedMaterialCost: r.estimated_material_cost,
          actualMaterialCost: Math.round(r.actual_material_cost),
          materialVariance: Math.round(materialVariance),
          totalVariance: Math.round(totalVariance),
          productivityFactor: r.productivity_factor,
        }
      })

      const significant = analysis.filter((a) => Math.abs(a.totalVariance) > 1000)
      const totalBudgeted = analysis.reduce(
        (s, a) => s + a.budgetedLaborCost + a.budgetedMaterialCost,
        0
      )
      const totalActual = analysis.reduce(
        (s, a) => s + a.actualLaborCost + a.actualMaterialCost,
        0
      )
      const totalVariance = totalActual - totalBudgeted

      return {
        projectId,
        lineItemAnalysis: significant.sort((a, b) => b.totalVariance - a.totalVariance),
        summary: {
          totalBudgetedCost: Math.round(totalBudgeted),
          totalActualCost: Math.round(totalActual),
          totalVariance: Math.round(totalVariance),
          variancePct:
            totalBudgeted > 0
              ? Math.round((totalVariance / totalBudgeted) * 1000) / 10
              : 0,
        },
      }
    },
  }),

  analyzeLaborProductivity: tool({
    description:
      'Analyze labor productivity: actual vs budgeted hours, overtime patterns, and cost per SOV line. Identifies crew inefficiency and schedule pressure.',
    parameters: z.object({
      projectId: z.string().describe('The project ID to analyze'),
    }),
    execute: async ({ projectId }) => {
      const rows = getLaborProductivityByProject(projectId)

      const analysis = rows
        .filter((r) => r.actual_hours_st + r.actual_hours_ot > 0)
        .map((r) => {
          const actualHours = r.actual_hours_st + r.actual_hours_ot
          const hoursVariance = actualHours - r.estimated_labor_hours
          const overtimePct =
            actualHours > 0 ? Math.round((r.actual_hours_ot / actualHours) * 1000) / 10 : 0

          return {
            sovLineId: r.sov_line_id,
            description: r.description,
            budgetedHours: r.estimated_labor_hours,
            actualHours,
            straightTimeHours: r.actual_hours_st,
            overtimeHours: r.actual_hours_ot,
            overtimePct,
            hoursVariance,
            hoursVariancePct:
              r.estimated_labor_hours > 0
                ? Math.round((hoursVariance / r.estimated_labor_hours) * 1000) / 10
                : 0,
            budgetedLaborCost: r.estimated_labor_cost,
            actualLaborCost: Math.round(r.actual_labor_cost),
            productivityFactor: r.productivity_factor,
            uniqueEmployees: r.unique_employees,
          }
        })

      return {
        projectId,
        analysis,
        overtimeSummary: {
          totalSTHours: analysis.reduce((s, a) => s + a.straightTimeHours, 0),
          totalOTHours: analysis.reduce((s, a) => s + a.overtimeHours, 0),
          avgOvertimePct:
            analysis.length > 0
              ? Math.round(
                  (analysis.reduce((s, a) => s + a.overtimePct, 0) / analysis.length) * 10
                ) / 10
              : 0,
          linesOverBudget: analysis.filter((a) => a.hoursVariance > 0).length,
        },
      }
    },
  }),

  getChangeOrderStatus: tool({
    description:
      'Get all change orders for a project with financial and schedule impacts. Critical for finding unbilled approved work and pending revenue.',
    parameters: z.object({
      projectId: z.string().describe('The project ID'),
      status: z
        .enum(['Approved', 'Pending', 'Rejected', 'All'])
        .optional()
        .describe('Filter by status'),
    }),
    execute: async ({ projectId, status = 'All' }) => {
      let changeOrders = getChangeOrdersByProject(projectId)
      if (status !== 'All') changeOrders = changeOrders.filter((co) => co.status === status)

      const approved = changeOrders.filter((co) => co.status === 'Approved')
      const pending = changeOrders.filter((co) => co.status === 'Pending')
      const rejected = changeOrders.filter((co) => co.status === 'Rejected')

      return {
        projectId,
        changeOrders,
        summary: {
          total: changeOrders.length,
          approvedCount: approved.length,
          approvedAmount: approved.reduce((s, co) => s + co.amount, 0),
          pendingCount: pending.length,
          pendingAmount: pending.reduce((s, co) => s + co.amount, 0),
          rejectedCount: rejected.length,
          rejectedAmount: rejected.reduce((s, co) => s + co.amount, 0),
          totalLaborHoursImpact: changeOrders.reduce((s, co) => s + co.labor_hours_impact, 0),
          totalScheduleImpactDays: changeOrders.reduce((s, co) => s + co.schedule_impact_days, 0),
        },
      }
    },
  }),

  getBillingStatus: tool({
    description:
      'Analyze billing history: cumulative billed vs contract value, retention held, unpaid applications, and SOV lines with unbilled completed work.',
    parameters: z.object({
      projectId: z.string().describe('The project ID'),
    }),
    execute: async ({ projectId }) => {
      const contract = getContract(projectId)
      const billingHistory = getBillingHistoryByProject(projectId).reverse() // latest first
      const billingLineItems = getBillingLineItemsByProject(projectId)
      const sov = getSOVByProject(projectId)

      const latestBilling = billingHistory[0]

      const unbilledWork = sov.map((sovItem) => {
        const latestLineItem = billingLineItems
          .filter((b) => b.sov_line_id === sovItem.sov_line_id)
          .sort((a, b) => b.application_number - a.application_number)[0]

        const totalBilled = latestLineItem?.total_billed ?? 0
        const pctComplete = latestLineItem?.pct_complete ?? 0

        return {
          sovLineId: sovItem.sov_line_id,
          description: sovItem.description,
          scheduledValue: sovItem.scheduled_value,
          totalBilled,
          pctComplete,
          unbilled: Math.round(sovItem.scheduled_value - totalBilled),
          balanceToFinish: latestLineItem?.balance_to_finish ?? sovItem.scheduled_value,
        }
      })

      const contractValue = contract?.original_contract_value ?? 0
      const cumulativeBilled = latestBilling?.cumulative_billed ?? 0

      return {
        projectId,
        contractValue,
        latestBilling,
        recentApplications: billingHistory.slice(0, 5),
        unbilledWork: unbilledWork.filter((u) => u.unbilled > 5000),
        summary: {
          totalBilled: cumulativeBilled,
          billingPct:
            contractValue > 0
              ? Math.round((cumulativeBilled / contractValue) * 1000) / 10
              : 0,
          retentionHeld: latestBilling?.retention_held ?? 0,
          netPaymentDue: latestBilling?.net_payment_due ?? 0,
          unpaidApplications: billingHistory.filter((b) => b.status !== 'Paid').length,
        },
      }
    },
  }),

  getRFIAnalysis: tool({
    description:
      'Analyze RFIs for cost and schedule impacts. Open high-priority RFIs are a leading indicator of future change orders and margin exposure.',
    parameters: z.object({
      projectId: z.string().describe('The project ID'),
      status: z.enum(['Open', 'Pending Response', 'Closed', 'All']).optional(),
      priority: z.enum(['Critical', 'High', 'Medium', 'Low', 'All']).optional(),
    }),
    execute: async ({ projectId, status = 'All', priority = 'All' }) => {
      let rfis = getRFIsByProject(projectId)
      if (status !== 'All') rfis = rfis.filter((r) => r.status === status)
      if (priority !== 'All') rfis = rfis.filter((r) => r.priority === priority)

      const withCostImpact = rfis.filter((r) => isTruthy(r.cost_impact))
      const withScheduleImpact = rfis.filter((r) => isTruthy(r.schedule_impact))
      const openHighPriority = rfis.filter(
        (r) =>
          (r.priority === 'High' || r.priority === 'Critical') &&
          (r.status === 'Open' || r.status === 'Pending Response')
      )

      return {
        projectId,
        rfis,
        summary: {
          total: rfis.length,
          open: rfis.filter((r) => r.status === 'Open').length,
          pendingResponse: rfis.filter((r) => r.status === 'Pending Response').length,
          closed: rfis.filter((r) => r.status === 'Closed').length,
          withCostImpact: withCostImpact.length,
          withScheduleImpact: withScheduleImpact.length,
          openHighOrCritical: openHighPriority.length,
        },
        openHighPriorityRFIs: openHighPriority,
      }
    },
  }),

  searchFieldNotes: tool({
    description:
      'Search unstructured daily field notes for specific issues, verbal approvals, delays, or rework. Useful for understanding the narrative behind cost overruns.',
    parameters: z.object({
      projectId: z.string().describe('The project ID'),
      keywords: z
        .string()
        .describe('Space-separated keywords to search for (e.g., "delay rework verbal approval")'),
      noteType: z
        .enum(['Daily Report', 'Issue Log', 'Safety Log', 'Inspection Note', 'Coordination Note', 'All'])
        .optional(),
    }),
    execute: async ({ projectId, keywords, noteType = 'All' }) => {
      const terms = keywords.toLowerCase().split(/\s+/).filter(Boolean)
      const matches = searchFieldNotesByKeywords(projectId, terms, noteType)

      return {
        projectId,
        keywords,
        matchCount: matches.length,
        matchingNotes: matches.map((n) => ({
          date: n.date,
          author: n.author,
          noteType: n.note_type,
          snippet: n.snippet,
        })),
      }
    },
  }),

  getProjectRiskFactors: tool({
    description:
      'Identify high-risk SOV lines based on low productivity factors at bid time, pending change orders, and open high-priority RFIs. Gives a ranked risk view.',
    parameters: z.object({
      projectId: z.string().describe('The project ID'),
    }),
    execute: async ({ projectId }) => {
      const sov = getSOVByProject(projectId)
      const sovBudget = getSOVBudgetByProject(projectId)
      const changeOrders = getChangeOrdersByProject(projectId)
      const rfis = getRFIsByProject(projectId)

      const riskyLines = sovBudget
        .filter((b) => b.productivity_factor < 1.0)
        .map((b) => ({
          sovLineId: b.sov_line_id,
          description: sov.find((s) => s.sov_line_id === b.sov_line_id)?.description ?? b.sov_line_id,
          productivityFactor: b.productivity_factor,
          estimatedLaborCost: b.estimated_labor_cost,
          keyAssumptions: b.key_assumptions,
        }))
        .sort((a, b) => a.productivityFactor - b.productivityFactor)

      const pendingCOs = changeOrders.filter((co) => co.status === 'Pending')
      const openHighRFIs = rfis.filter(
        (r) =>
          (r.priority === 'High' || r.priority === 'Critical') &&
          (r.status === 'Open' || r.status === 'Pending Response')
      )

      return {
        projectId,
        riskySOVLines: riskyLines,
        pendingChangeOrders: pendingCOs,
        openHighPriorityRFIs: openHighRFIs,
        summary: {
          riskyLineCount: riskyLines.length,
          pendingCOsAmount: pendingCOs.reduce((s, co) => s + co.amount, 0),
          openHighRFICount: openHighRFIs.length,
        },
      }
    },
  }),
}
