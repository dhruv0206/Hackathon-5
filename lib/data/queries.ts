import { loadProjectData } from './parser'
import type {
  Contract,
  SOVItem,
  SOVBudget,
  LaborLog,
  MaterialDelivery,
  BillingHistory,
  BillingLineItem,
  ChangeOrder,
  RFI,
  FieldNote,
} from './types'

export function getContracts(): Contract[] {
  const data = loadProjectData()
  return data.contracts
}

export function getContract(projectId: string): Contract | undefined {
  const data = loadProjectData()
  return data.contracts.find((c) => c.project_id === projectId)
}

export function getSOVByProject(projectId: string): SOVItem[] {
  const data = loadProjectData()
  return data.sov.filter((s) => s.project_id === projectId)
}

export function getSOVBudgetByProject(projectId: string): SOVBudget[] {
  const data = loadProjectData()
  return data.sovBudget.filter((s) => s.project_id === projectId)
}

export function getLaborLogsByProject(projectId: string): LaborLog[] {
  const data = loadProjectData()
  return data.laborLogs.filter((l) => l.project_id === projectId)
}

export function getLaborLogsBySOVLine(projectId: string, sovLineId: string): LaborLog[] {
  const data = loadProjectData()
  return data.laborLogs.filter(
    (l) => l.project_id === projectId && l.sov_line_id === sovLineId
  )
}

export function getMaterialDeliveriesByProject(projectId: string): MaterialDelivery[] {
  const data = loadProjectData()
  return data.materialDeliveries.filter((m) => m.project_id === projectId)
}

export function getBillingHistoryByProject(projectId: string): BillingHistory[] {
  const data = loadProjectData()
  return data.billingHistory.filter((b) => b.project_id === projectId)
}

export function getBillingLineItemsByBilling(billingId: string): BillingLineItem[] {
  const data = loadProjectData()
  return data.billingLineItems.filter((b) => b.billing_id === billingId)
}

export function getBillingLineItemsByProject(projectId: string): BillingLineItem[] {
  const data = loadProjectData()
  return data.billingLineItems.filter((b) => b.project_id === projectId)
}

export function getChangeOrdersByProject(projectId: string): ChangeOrder[] {
  const data = loadProjectData()
  return data.changeOrders.filter((c) => c.project_id === projectId)
}

export function getRFIsByProject(projectId: string): RFI[] {
  const data = loadProjectData()
  return data.rfis.filter((r) => r.project_id === projectId)
}

export function getFieldNotesByProject(projectId: string): FieldNote[] {
  const data = loadProjectData()
  return data.fieldNotes.filter((f) => f.project_id === projectId)
}

export function getFieldNotesBySOVLine(projectId: string, sovLineId: string): FieldNote[] {
  const data = loadProjectData()
  return data.fieldNotes.filter(
    (f) => f.project_id === projectId && f.sov_line_id === sovLineId
  )
}

// Summary functions
export function getProjectSummary(projectId: string) {
  const contract = getContract(projectId)
  const sov = getSOVByProject(projectId)
  const changeOrders = getChangeOrdersByProject(projectId)
  const rfis = getRFIsByProject(projectId)
  const billingHistory = getBillingHistoryByProject(projectId)

  const approvedCOs = changeOrders.filter((co) => co.status === 'Approved')
  const pendingCOs = changeOrders.filter((co) => co.status === 'Pending')
  const openRFIs = rfis.filter((rfi) => rfi.status === 'Open' || rfi.status === 'In Review')
  
  const latestBilling = billingHistory.sort(
    (a, b) => new Date(b.application_date).getTime() - new Date(a.application_date).getTime()
  )[0]

  return {
    contract,
    sovLineCount: sov.length,
    approvedCOsCount: approvedCOs.length,
    approvedCOsAmount: approvedCOs.reduce((sum, co) => sum + co.amount, 0),
    pendingCOsCount: pendingCOs.length,
    pendingCOsAmount: pendingCOs.reduce((sum, co) => sum + co.amount, 0),
    openRFIsCount: openRFIs.length,
    percentComplete: latestBilling?.percent_complete || 0,
    cumulativeBilled: latestBilling?.cumulative_billed || 0,
  }
}
