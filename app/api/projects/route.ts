import { getContracts, getProjectSummary } from '@/lib/data/queries'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const contracts = getContracts()
    
    const projectsOverview = contracts.map(contract => {
      const summary = getProjectSummary(contract.project_id)
      return {
        projectId: contract.project_id,
        projectName: contract.project_name,
        generalContractor: contract.gc_name,
        contractValue: contract.original_contract_value,
        startDate: contract.contract_date,
        substantialCompletion: contract.substantial_completion_date,
        percentComplete: summary.percentComplete,
        cumulativeBilled: summary.cumulativeBilled,
        approvedCOs: summary.approvedCOsCount,
        approvedCOsAmount: summary.approvedCOsAmount,
        pendingCOs: summary.pendingCOsCount,
        pendingCOsAmount: summary.pendingCOsAmount,
        openRFIs: summary.openRFIsCount,
      }
    })

    return NextResponse.json(projectsOverview)
  } catch (error) {
    console.error('[v0] Error loading projects:', error)
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 })
  }
}
