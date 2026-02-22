import { NextResponse } from 'next/server'
import { getContracts, getProjectSummary, getPortfolioStats } from '@/lib/data/queries'

export async function GET() {
  try {
    const contracts = getContracts()
    const portfolio = getPortfolioStats()

    const projects = contracts.map((contract) => {
      const summary = getProjectSummary(contract.project_id)

      // Determine status based on data signals
      let status: 'On Track' | 'At Risk' | 'Complete' | 'Delayed'
      if (summary.percentComplete >= 95) {
        status = 'Complete'
      } else if (summary.pendingCOsCount > 2 || summary.openRFIsCount > 5) {
        status = 'At Risk'
      } else {
        status = 'On Track'
      }

      return {
        project_id: contract.project_id,
        project_name: contract.project_name,
        gc_name: contract.gc_name,
        original_contract_value: contract.original_contract_value,
        contract_date: contract.contract_date,
        substantial_completion_date: contract.substantial_completion_date,
        cumulative_billed: summary.cumulativeBilled,
        retention_held: summary.retentionHeld,
        progress_percentage: summary.percentComplete,
        status,
        open_rfis: summary.openRFIsCount,
        change_orders: summary.approvedCOsCount + summary.pendingCOsCount,
        pending_cos_amount: summary.pendingCOsAmount,
        approved_cos_amount: summary.approvedCOsAmount,
      }
    })

    return NextResponse.json({
      portfolio: {
        totalContractValue: portfolio.totalContractValue,
        totalBilled: portfolio.totalBilled,
        totalRetention: portfolio.totalRetention,
        activeProjects: contracts.length,
        completedProjects: projects.filter((p) => p.status === 'Complete').length,
        atRiskProjects: projects.filter((p) => p.status === 'At Risk').length,
        totalRFIs: portfolio.totalRFIs,
        openRFIs: portfolio.openRFIs,
        totalChangeOrders: portfolio.totalChangeOrders,
        pendingCOs: portfolio.pendingCOs,
        pendingCOsAmount: portfolio.pendingCOsAmount,
        averageProgress:
          projects.length > 0
            ? Math.round(
                (projects.reduce((s, p) => s + p.progress_percentage, 0) / projects.length) * 10
              ) / 10
            : 0,
      },
      projects,
    })
  } catch (error) {
    console.error('[stats] Error:', error)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
