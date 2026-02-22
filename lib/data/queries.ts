import { getDb } from './db'
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

// ─── Contracts ────────────────────────────────────────────────────────────────

export function getContracts(): Contract[] {
  return getDb().prepare('SELECT * FROM contracts').all() as Contract[]
}

export function getContract(projectId: string): Contract | undefined {
  return getDb().prepare('SELECT * FROM contracts WHERE project_id = ?').get(projectId) as Contract | undefined
}

// ─── SOV ──────────────────────────────────────────────────────────────────────

export function getSOVByProject(projectId: string): SOVItem[] {
  return getDb()
    .prepare('SELECT * FROM sov WHERE project_id = ? ORDER BY line_number')
    .all(projectId) as SOVItem[]
}

// ─── SOV Budget ───────────────────────────────────────────────────────────────

export function getSOVBudgetByProject(projectId: string): SOVBudget[] {
  return getDb()
    .prepare('SELECT * FROM sov_budget WHERE project_id = ?')
    .all(projectId) as SOVBudget[]
}

// ─── Labor ────────────────────────────────────────────────────────────────────

export function getLaborLogsByProject(projectId: string): LaborLog[] {
  return getDb()
    .prepare('SELECT * FROM labor_logs WHERE project_id = ?')
    .all(projectId) as LaborLog[]
}

export function getLaborLogsBySOVLine(projectId: string, sovLineId: string): LaborLog[] {
  return getDb()
    .prepare('SELECT * FROM labor_logs WHERE project_id = ? AND sov_line_id = ?')
    .all(projectId, sovLineId) as LaborLog[]
}

// ─── Materials ────────────────────────────────────────────────────────────────

export function getMaterialDeliveriesByProject(projectId: string): MaterialDelivery[] {
  return getDb()
    .prepare('SELECT * FROM material_deliveries WHERE project_id = ?')
    .all(projectId) as MaterialDelivery[]
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export function getBillingHistoryByProject(projectId: string): BillingHistory[] {
  return getDb()
    .prepare('SELECT * FROM billing_history WHERE project_id = ? ORDER BY application_number')
    .all(projectId) as BillingHistory[]
}

export function getBillingLineItemsByProject(projectId: string): BillingLineItem[] {
  return getDb()
    .prepare('SELECT * FROM billing_line_items WHERE project_id = ?')
    .all(projectId) as BillingLineItem[]
}

export function getBillingLineItemsByApplication(
  projectId: string,
  applicationNumber: number
): BillingLineItem[] {
  return getDb()
    .prepare('SELECT * FROM billing_line_items WHERE project_id = ? AND application_number = ?')
    .all(projectId, applicationNumber) as BillingLineItem[]
}

// ─── Change Orders ────────────────────────────────────────────────────────────

export function getChangeOrdersByProject(projectId: string): ChangeOrder[] {
  return getDb()
    .prepare('SELECT * FROM change_orders WHERE project_id = ? ORDER BY date_submitted')
    .all(projectId) as ChangeOrder[]
}

// ─── RFIs ─────────────────────────────────────────────────────────────────────

export function getRFIsByProject(projectId: string): RFI[] {
  return getDb()
    .prepare('SELECT * FROM rfis WHERE project_id = ? ORDER BY date_submitted')
    .all(projectId) as RFI[]
}

// ─── Field Notes ──────────────────────────────────────────────────────────────

export function getFieldNotesByProject(projectId: string): FieldNote[] {
  return getDb()
    .prepare('SELECT * FROM field_notes WHERE project_id = ? ORDER BY date')
    .all(projectId) as FieldNote[]
}

export function searchFieldNotesByKeywords(
  projectId: string,
  keywords: string[],
  noteType?: string
): { date: string; author: string; note_type: string; snippet: string }[] {
  const db = getDb()
  const safeKeywords = keywords.slice(0, 5).filter(Boolean) // cap at 5 terms
  if (safeKeywords.length === 0) return []

  const likeConditions = safeKeywords.map(() => 'LOWER(content) LIKE ?').join(' OR ')
  const likeParams = safeKeywords.map((k) => `%${k.toLowerCase()}%`)

  let sql = `
    SELECT date, author, note_type, SUBSTR(content, 1, 200) AS snippet
    FROM field_notes
    WHERE project_id = ? AND (${likeConditions})`

  const params: any[] = [projectId, ...likeParams]

  if (noteType && noteType !== 'All') {
    sql += ` AND note_type = ?`
    params.push(noteType)
  }

  sql += ` ORDER BY date DESC LIMIT 10`

  return db.prepare(sql).all(...params) as { date: string; author: string; note_type: string; snippet: string }[]
}

// ─── Aggregated Margin Analysis (SQL-native, avoids loading 16K rows) ─────────

export interface MarginLineItem {
  sov_line_id: string
  description: string
  scheduled_value: number
  estimated_labor_hours: number
  estimated_labor_cost: number
  estimated_material_cost: number
  productivity_factor: number
  actual_labor_cost: number
  actual_labor_hours: number
  actual_material_cost: number
}

export function getMarginAnalysisByProject(projectId: string): MarginLineItem[] {
  return getDb().prepare(`
    SELECT
      s.sov_line_id,
      s.description,
      s.scheduled_value,
      COALESCE(b.estimated_labor_hours, 0)   AS estimated_labor_hours,
      COALESCE(b.estimated_labor_cost, 0)    AS estimated_labor_cost,
      COALESCE(b.estimated_material_cost, 0) AS estimated_material_cost,
      COALESCE(b.productivity_factor, 1)     AS productivity_factor,
      COALESCE(SUM((l.hours_st + l.hours_ot * 1.5) * l.hourly_rate * l.burden_multiplier), 0) AS actual_labor_cost,
      COALESCE(SUM(l.hours_st + l.hours_ot), 0) AS actual_labor_hours,
      COALESCE(m.actual_material_cost, 0)    AS actual_material_cost
    FROM sov s
    LEFT JOIN sov_budget b ON b.sov_line_id = s.sov_line_id
    LEFT JOIN labor_logs l ON l.sov_line_id = s.sov_line_id AND l.project_id = s.project_id
    LEFT JOIN (
      SELECT sov_line_id, SUM(total_cost) AS actual_material_cost
      FROM material_deliveries
      WHERE project_id = ?
      GROUP BY sov_line_id
    ) m ON m.sov_line_id = s.sov_line_id
    WHERE s.project_id = ?
    GROUP BY s.sov_line_id
    ORDER BY s.line_number
  `).all(projectId, projectId) as MarginLineItem[]
}

// ─── Labor Productivity (SQL aggregation) ─────────────────────────────────────

export interface LaborProductivityRow {
  sov_line_id: string
  description: string
  estimated_labor_hours: number
  estimated_labor_cost: number
  productivity_factor: number
  actual_hours_st: number
  actual_hours_ot: number
  actual_labor_cost: number
  unique_employees: number
}

export function getLaborProductivityByProject(projectId: string): LaborProductivityRow[] {
  return getDb().prepare(`
    SELECT
      s.sov_line_id,
      s.description,
      COALESCE(b.estimated_labor_hours, 0) AS estimated_labor_hours,
      COALESCE(b.estimated_labor_cost, 0)  AS estimated_labor_cost,
      COALESCE(b.productivity_factor, 1)   AS productivity_factor,
      COALESCE(SUM(l.hours_st), 0)         AS actual_hours_st,
      COALESCE(SUM(l.hours_ot), 0)         AS actual_hours_ot,
      COALESCE(SUM((l.hours_st + l.hours_ot * 1.5) * l.hourly_rate * l.burden_multiplier), 0) AS actual_labor_cost,
      COUNT(DISTINCT l.employee_id)        AS unique_employees
    FROM sov s
    LEFT JOIN sov_budget b ON b.sov_line_id = s.sov_line_id
    LEFT JOIN labor_logs l ON l.sov_line_id = s.sov_line_id AND l.project_id = s.project_id
    WHERE s.project_id = ?
    GROUP BY s.sov_line_id
    ORDER BY s.line_number
  `).all(projectId) as LaborProductivityRow[]
}

// ─── Project Summary ──────────────────────────────────────────────────────────

export function getProjectSummary(projectId: string) {
  const contract = getContract(projectId)

  const billingRow = getDb().prepare(`
    SELECT cumulative_billed, retention_held, net_payment_due
    FROM billing_history
    WHERE project_id = ?
    ORDER BY application_number DESC
    LIMIT 1
  `).get(projectId) as { cumulative_billed: number; retention_held: number; net_payment_due: number } | undefined

  const coStats = getDb().prepare(`
    SELECT
      COUNT(CASE WHEN status = 'Approved' THEN 1 END) AS approved_count,
      COALESCE(SUM(CASE WHEN status = 'Approved' THEN amount ELSE 0 END), 0) AS approved_amount,
      COUNT(CASE WHEN status = 'Pending'  THEN 1 END) AS pending_count,
      COALESCE(SUM(CASE WHEN status = 'Pending'  THEN amount ELSE 0 END), 0) AS pending_amount
    FROM change_orders WHERE project_id = ?
  `).get(projectId) as { approved_count: number; approved_amount: number; pending_count: number; pending_amount: number }

  const rfiStats = getDb().prepare(`
    SELECT COUNT(*) AS open_count
    FROM rfis
    WHERE project_id = ? AND status IN ('Open', 'Pending Response')
  `).get(projectId) as { open_count: number }

  const contractValue = contract?.original_contract_value ?? 0
  const cumulativeBilled = billingRow?.cumulative_billed ?? 0
  const percentComplete = contractValue > 0 ? (cumulativeBilled / contractValue) * 100 : 0

  return {
    contract,
    percentComplete: Math.round(percentComplete * 10) / 10,
    cumulativeBilled,
    retentionHeld: billingRow?.retention_held ?? 0,
    netPaymentDue: billingRow?.net_payment_due ?? 0,
    approvedCOsCount: coStats?.approved_count ?? 0,
    approvedCOsAmount: coStats?.approved_amount ?? 0,
    pendingCOsCount: coStats?.pending_count ?? 0,
    pendingCOsAmount: coStats?.pending_amount ?? 0,
    openRFIsCount: rfiStats?.open_count ?? 0,
  }
}

// ─── Portfolio Stats (for dashboard) ─────────────────────────────────────────

export function getPortfolioStats() {
  const db = getDb()

  const totals = db.prepare(`
    SELECT
      SUM(c.original_contract_value) AS total_contract_value,
      SUM(bh.cumulative_billed)      AS total_billed,
      SUM(bh.retention_held)         AS total_retention
    FROM contracts c
    LEFT JOIN billing_history bh ON bh.project_id = c.project_id
      AND bh.application_number = (
        SELECT MAX(application_number) FROM billing_history WHERE project_id = c.project_id
      )
  `).get() as { total_contract_value: number; total_billed: number; total_retention: number }

  const coCount = db.prepare(`SELECT COUNT(*) AS n FROM change_orders`).get() as { n: number }
  const rfiCount = db.prepare(`SELECT COUNT(*) AS n FROM rfis`).get() as { n: number }
  const openRFIs = db.prepare(`SELECT COUNT(*) AS n FROM rfis WHERE status IN ('Open', 'Pending Response')`).get() as { n: number }
  const pendingCOs = db.prepare(`
    SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amount FROM change_orders WHERE status = 'Pending'
  `).get() as { n: number; amount: number }

  return {
    totalContractValue: totals.total_contract_value,
    totalBilled: totals.total_billed,
    totalRetention: totals.total_retention,
    totalChangeOrders: coCount.n,
    totalRFIs: rfiCount.n,
    openRFIs: openRFIs.n,
    pendingCOs: pendingCOs.n,
    pendingCOsAmount: pendingCOs.amount,
  }
}
