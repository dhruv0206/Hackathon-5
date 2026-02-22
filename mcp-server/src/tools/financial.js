import { getDb, round } from '../db.js'

export const financialTools = [
  {
    name: 'analyze_margins',
    description:
      'Compare budgeted vs actual labor and material costs for every SOV line in a project. Uses SQL aggregation over 16K labor records. Returns variance amounts and percentages per line item — identifies exactly where margin is being lost.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID (e.g. PRJ-2024-001)' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_billing_status',
    description:
      'Analyze billing history for a project: cumulative billed vs contract value, retention held, unpaid applications, and which SOV lines have remaining balance to finish.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_change_orders',
    description:
      'Get all change orders for a project with financial and schedule impacts. Filter by status to find unbilled approved work or pending revenue.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        status: {
          type: 'string',
          enum: ['Approved', 'Pending', 'Rejected', 'All'],
          description: 'Filter by approval status (default: All)',
        },
      },
      required: ['project_id'],
    },
  },
]

export function handleFinancialTool(name, args) {
  const db = getDb()

  if (name === 'analyze_margins') {
    const { project_id } = args

    const rows = db
      .prepare(
        `SELECT
          s.sov_line_id,
          s.description,
          s.scheduled_value,
          COALESCE(b.estimated_labor_hours, 0)   AS est_labor_hours,
          COALESCE(b.estimated_labor_cost, 0)    AS est_labor_cost,
          COALESCE(b.estimated_material_cost, 0) AS est_material_cost,
          COALESCE(b.productivity_factor, 1)     AS productivity_factor,
          COALESCE(SUM((l.hours_st + l.hours_ot * 1.5) * l.hourly_rate * l.burden_multiplier), 0) AS actual_labor_cost,
          COALESCE(SUM(l.hours_st + l.hours_ot), 0) AS actual_labor_hours,
          COALESCE(m.mat_cost, 0) AS actual_material_cost
         FROM sov s
         LEFT JOIN sov_budget b ON b.sov_line_id = s.sov_line_id
         LEFT JOIN labor_logs l ON l.sov_line_id = s.sov_line_id AND l.project_id = s.project_id
         LEFT JOIN (
           SELECT sov_line_id, SUM(total_cost) AS mat_cost
           FROM material_deliveries WHERE project_id = ?
           GROUP BY sov_line_id
         ) m ON m.sov_line_id = s.sov_line_id
         WHERE s.project_id = ?
         GROUP BY s.sov_line_id
         ORDER BY s.line_number`
      )
      .all(project_id, project_id)

    const lines = rows.map((r) => {
      const laborVar = r.actual_labor_cost - r.est_labor_cost
      const matVar = r.actual_material_cost - r.est_material_cost
      const totalVar = laborVar + matVar
      return {
        sov_line_id: r.sov_line_id,
        description: r.description,
        scheduled_value: r.scheduled_value,
        est_labor_hours: r.est_labor_hours,
        actual_labor_hours: Math.round(r.actual_labor_hours),
        hours_variance: Math.round(r.actual_labor_hours - r.est_labor_hours),
        est_labor_cost: r.est_labor_cost,
        actual_labor_cost: Math.round(r.actual_labor_cost),
        labor_variance: Math.round(laborVar),
        labor_variance_pct:
          r.est_labor_cost > 0 ? round((laborVar / r.est_labor_cost) * 100) : 0,
        est_material_cost: r.est_material_cost,
        actual_material_cost: Math.round(r.actual_material_cost),
        material_variance: Math.round(matVar),
        total_variance: Math.round(totalVar),
        productivity_factor: r.productivity_factor,
      }
    })

    const totalBudgeted = lines.reduce((s, l) => s + l.est_labor_cost + l.est_material_cost, 0)
    const totalActual = lines.reduce((s, l) => s + l.actual_labor_cost + l.actual_material_cost, 0)
    const totalVar = totalActual - totalBudgeted

    return {
      project_id,
      lines: lines.filter((l) => Math.abs(l.total_variance) > 500),
      summary: {
        total_budgeted_cost: Math.round(totalBudgeted),
        total_actual_cost: Math.round(totalActual),
        total_variance: Math.round(totalVar),
        variance_pct: totalBudgeted > 0 ? round((totalVar / totalBudgeted) * 100) : 0,
        lines_over_budget: lines.filter((l) => l.total_variance > 0).length,
        worst_line: lines.sort((a, b) => b.total_variance - a.total_variance)[0]?.description,
      },
    }
  }

  if (name === 'get_billing_status') {
    const { project_id } = args
    const contract = db.prepare('SELECT * FROM contracts WHERE project_id = ?').get(project_id)
    const history = db
      .prepare('SELECT * FROM billing_history WHERE project_id = ? ORDER BY application_number DESC')
      .all(project_id)

    const latest = history[0]
    const contractValue = contract?.original_contract_value ?? 0
    const cumulativeBilled = latest?.cumulative_billed ?? 0

    // Per SOV line: latest billing state
    const lineStatus = db
      .prepare(
        `SELECT
          s.sov_line_id,
          s.description,
          s.scheduled_value,
          COALESCE(bli.total_billed, 0)      AS total_billed,
          COALESCE(bli.pct_complete, 0)      AS pct_complete,
          COALESCE(bli.balance_to_finish, s.scheduled_value) AS balance_to_finish
         FROM sov s
         LEFT JOIN billing_line_items bli ON bli.sov_line_id = s.sov_line_id
           AND bli.application_number = (
             SELECT MAX(application_number) FROM billing_line_items
             WHERE sov_line_id = s.sov_line_id AND project_id = s.project_id
           )
         WHERE s.project_id = ?
         ORDER BY s.line_number`
      )
      .all(project_id)

    return {
      project_id,
      contract_value: contractValue,
      summary: {
        cumulative_billed: cumulativeBilled,
        billing_pct: contractValue > 0 ? round((cumulativeBilled / contractValue) * 100) : 0,
        retention_held: latest?.retention_held ?? 0,
        net_payment_due: latest?.net_payment_due ?? 0,
        total_applications: history.length,
        unpaid_applications: history.filter((h) => h.status !== 'Paid').length,
      },
      recent_applications: history.slice(0, 6),
      sov_line_status: lineStatus,
    }
  }

  if (name === 'get_change_orders') {
    const { project_id, status = 'All' } = args
    let query = 'SELECT * FROM change_orders WHERE project_id = ?'
    const params = [project_id]
    if (status !== 'All') {
      query += ' AND status = ?'
      params.push(status)
    }
    query += ' ORDER BY date_submitted'
    const cos = db.prepare(query).all(...params)

    const approved = cos.filter((c) => c.status === 'Approved')
    const pending = cos.filter((c) => c.status === 'Pending')
    const rejected = cos.filter((c) => c.status === 'Rejected')

    return {
      project_id,
      change_orders: cos,
      summary: {
        total: cos.length,
        approved_count: approved.length,
        approved_amount: approved.reduce((s, c) => s + c.amount, 0),
        pending_count: pending.length,
        pending_amount: pending.reduce((s, c) => s + c.amount, 0),
        rejected_count: rejected.length,
        rejected_amount: rejected.reduce((s, c) => s + c.amount, 0),
        total_labor_hours_impact: cos.reduce((s, c) => s + c.labor_hours_impact, 0),
        total_schedule_days_impact: cos.reduce((s, c) => s + c.schedule_impact_days, 0),
      },
    }
  }

  return { error: `Unknown tool: ${name}` }
}
