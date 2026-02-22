import { getDb, round } from '../db.js'

export const portfolioTools = [
  {
    name: 'get_portfolio_overview',
    description:
      'Get a full overview of all 5 HVAC projects: contract values, billing progress, open RFIs, and change order summary. Use this first for any portfolio-level question.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_project_details',
    description:
      'Get detailed info for a single project: contract terms, all SOV line items with scheduled values, and current billing summary.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID (e.g. PRJ-2024-001)',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_portfolio_stats',
    description:
      'Get aggregated portfolio statistics: total contract value, total billed, total retention held, open RFI counts, and pending change order totals across all projects.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

export function handlePortfolioTool(name, args) {
  const db = getDb()

  if (name === 'get_portfolio_overview') {
    const contracts = db.prepare('SELECT * FROM contracts').all()
    return contracts.map((c) => {
      const billing = db
        .prepare(
          'SELECT cumulative_billed, retention_held, net_payment_due FROM billing_history WHERE project_id = ? ORDER BY application_number DESC LIMIT 1'
        )
        .get(c.project_id)

      const cos = db
        .prepare(
          `SELECT
            COUNT(CASE WHEN status='Approved' THEN 1 END) AS approved_count,
            COALESCE(SUM(CASE WHEN status='Approved' THEN amount ELSE 0 END),0) AS approved_amount,
            COUNT(CASE WHEN status='Pending'  THEN 1 END) AS pending_count,
            COALESCE(SUM(CASE WHEN status='Pending'  THEN amount ELSE 0 END),0) AS pending_amount
           FROM change_orders WHERE project_id = ?`
        )
        .get(c.project_id)

      const rfis = db
        .prepare(
          `SELECT COUNT(*) AS open_count FROM rfis WHERE project_id = ? AND status IN ('Open','Pending Response')`
        )
        .get(c.project_id)

      const pct =
        c.original_contract_value > 0
          ? round((billing?.cumulative_billed ?? 0) / c.original_contract_value * 100)
          : 0

      return {
        project_id: c.project_id,
        project_name: c.project_name,
        gc_name: c.gc_name,
        contract_value: c.original_contract_value,
        contract_date: c.contract_date,
        substantial_completion: c.substantial_completion_date,
        cumulative_billed: billing?.cumulative_billed ?? 0,
        retention_held: billing?.retention_held ?? 0,
        net_payment_due: billing?.net_payment_due ?? 0,
        pct_complete: pct,
        approved_cos: cos.approved_count,
        approved_cos_amount: cos.approved_amount,
        pending_cos: cos.pending_count,
        pending_cos_amount: cos.pending_amount,
        open_rfis: rfis.open_count,
      }
    })
  }

  if (name === 'get_project_details') {
    const { project_id } = args
    const contract = db.prepare('SELECT * FROM contracts WHERE project_id = ?').get(project_id)
    if (!contract) return { error: `Project ${project_id} not found` }

    const sov = db
      .prepare('SELECT * FROM sov WHERE project_id = ? ORDER BY line_number')
      .all(project_id)

    const latestBilling = db
      .prepare(
        'SELECT * FROM billing_history WHERE project_id = ? ORDER BY application_number DESC LIMIT 1'
      )
      .get(project_id)

    return { contract, sov_lines: sov, latest_billing: latestBilling }
  }

  if (name === 'get_portfolio_stats') {
    const totals = db
      .prepare(
        `SELECT
          SUM(c.original_contract_value) AS total_contract_value,
          SUM(bh.cumulative_billed)      AS total_billed,
          SUM(bh.retention_held)         AS total_retention
         FROM contracts c
         LEFT JOIN billing_history bh ON bh.project_id = c.project_id
           AND bh.application_number = (
             SELECT MAX(application_number) FROM billing_history WHERE project_id = c.project_id
           )`
      )
      .get()

    const coStats = db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          COUNT(CASE WHEN status='Approved' THEN 1 END) AS approved,
          COUNT(CASE WHEN status='Pending'  THEN 1 END) AS pending,
          COUNT(CASE WHEN status='Rejected' THEN 1 END) AS rejected,
          COALESCE(SUM(CASE WHEN status='Approved' THEN amount ELSE 0 END),0) AS approved_amount,
          COALESCE(SUM(CASE WHEN status='Pending'  THEN amount ELSE 0 END),0) AS pending_amount
         FROM change_orders`
      )
      .get()

    const rfiStats = db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          COUNT(CASE WHEN status='Open' THEN 1 END) AS open,
          COUNT(CASE WHEN status='Pending Response' THEN 1 END) AS pending_response,
          COUNT(CASE WHEN cost_impact IN ('True','true',1) THEN 1 END) AS with_cost_impact
         FROM rfis`
      )
      .get()

    return { billing: totals, change_orders: coStats, rfis: rfiStats }
  }

  return { error: `Unknown tool: ${name}` }
}
