import { getDb, isTruthy } from '../db.js'

export const riskTools = [
  {
    name: 'get_rfi_analysis',
    description:
      'Analyze RFIs for a project: open/closed counts, cost and schedule impact flags, and high-priority unresolved items. Open High/Critical RFIs are leading indicators of future change orders.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        status: {
          type: 'string',
          enum: ['Open', 'Pending Response', 'Closed', 'All'],
          description: 'Filter by RFI status (default: All)',
        },
        priority: {
          type: 'string',
          enum: ['Critical', 'High', 'Medium', 'Low', 'All'],
          description: 'Filter by priority (default: All)',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_project_risk_factors',
    description:
      'Identify highest-risk SOV lines based on low productivity factors flagged at bid time, pending change orders, and open high-priority RFIs. Returns a ranked risk view for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'search_field_notes',
    description:
      'Full-text search through unstructured daily field notes. Use to find evidence of verbal approvals, rework, delays, coordination failures, or any narrative context behind cost overruns.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        keywords: {
          type: 'string',
          description: 'Space-separated keywords (e.g. "rework delay verbal approval coordination")',
        },
        note_type: {
          type: 'string',
          enum: ['Daily Report', 'Issue Log', 'Safety Log', 'Inspection Note', 'Coordination Note', 'All'],
          description: 'Filter by note type (default: All)',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default: 25)',
        },
      },
      required: ['project_id', 'keywords'],
    },
  },
  {
    name: 'get_cross_project_patterns',
    description:
      'Identify patterns that appear across multiple projects: common RFI subjects, recurring change order reasons, and SOV lines consistently over budget. Useful for systemic risk analysis.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

export function handleRiskTool(name, args) {
  const db = getDb()

  if (name === 'get_rfi_analysis') {
    const { project_id, status = 'All', priority = 'All' } = args

    let query = 'SELECT * FROM rfis WHERE project_id = ?'
    const params = [project_id]
    if (status !== 'All') { query += ' AND status = ?'; params.push(status) }
    if (priority !== 'All') { query += ' AND priority = ?'; params.push(priority) }
    query += ' ORDER BY date_submitted'

    const rfis = db.prepare(query).all(...params)

    const withCostImpact = rfis.filter((r) => isTruthy(r.cost_impact))
    const withScheduleImpact = rfis.filter((r) => isTruthy(r.schedule_impact))
    const openHighCritical = rfis.filter(
      (r) =>
        (r.priority === 'High' || r.priority === 'Critical') &&
        (r.status === 'Open' || r.status === 'Pending Response')
    )

    return {
      project_id,
      rfis,
      summary: {
        total: rfis.length,
        open: rfis.filter((r) => r.status === 'Open').length,
        pending_response: rfis.filter((r) => r.status === 'Pending Response').length,
        closed: rfis.filter((r) => r.status === 'Closed').length,
        with_cost_impact: withCostImpact.length,
        with_schedule_impact: withScheduleImpact.length,
        open_high_or_critical: openHighCritical.length,
      },
      open_high_priority: openHighCritical,
    }
  }

  if (name === 'get_project_risk_factors') {
    const { project_id } = args

    // SOV lines flagged as risky at bid time (productivity_factor < 1.0)
    const riskyLines = db
      .prepare(
        `SELECT
          b.sov_line_id,
          s.description,
          b.productivity_factor,
          b.estimated_labor_cost,
          b.estimated_material_cost,
          b.key_assumptions
         FROM sov_budget b
         JOIN sov s ON s.sov_line_id = b.sov_line_id
         WHERE b.project_id = ? AND b.productivity_factor < 1.0
         ORDER BY b.productivity_factor ASC`
      )
      .all(project_id)

    const pendingCOs = db
      .prepare("SELECT * FROM change_orders WHERE project_id = ? AND status = 'Pending'")
      .all(project_id)

    const openHighRFIs = db
      .prepare(
        `SELECT * FROM rfis
         WHERE project_id = ?
           AND priority IN ('High','Critical')
           AND status IN ('Open','Pending Response')`
      )
      .all(project_id)

    // Labor lines that are more than 20% over budget
    const laborOverruns = db
      .prepare(
        `SELECT
          s.sov_line_id,
          s.description,
          b.estimated_labor_hours,
          SUM(l.hours_st + l.hours_ot) AS actual_hours
         FROM sov s
         JOIN sov_budget b ON b.sov_line_id = s.sov_line_id
         JOIN labor_logs l ON l.sov_line_id = s.sov_line_id AND l.project_id = s.project_id
         WHERE s.project_id = ? AND b.estimated_labor_hours > 0
         GROUP BY s.sov_line_id
         HAVING actual_hours > b.estimated_labor_hours * 1.2
         ORDER BY (actual_hours - b.estimated_labor_hours) DESC`
      )
      .all(project_id)

    return {
      project_id,
      risky_sov_lines: riskyLines,
      labor_overruns: laborOverruns,
      pending_change_orders: pendingCOs,
      open_high_priority_rfis: openHighRFIs,
      summary: {
        risky_line_count: riskyLines.length,
        labor_overrun_count: laborOverruns.length,
        pending_cos_amount: pendingCOs.reduce((s, c) => s + c.amount, 0),
        open_high_rfi_count: openHighRFIs.length,
      },
    }
  }

  if (name === 'search_field_notes') {
    const { project_id, keywords, note_type = 'All', limit = 25 } = args

    let query = 'SELECT * FROM field_notes WHERE project_id = ?'
    const params = [project_id]
    if (note_type !== 'All') { query += ' AND note_type = ?'; params.push(note_type) }
    query += ' ORDER BY date'

    const allNotes = db.prepare(query).all(...params)

    const terms = keywords.toLowerCase().split(/\s+/).filter(Boolean)
    const matching = allNotes.filter((n) => {
      const text = (n.content ?? '').toLowerCase()
      return terms.some((t) => text.includes(t))
    })

    return {
      project_id,
      keywords,
      total_notes_searched: allNotes.length,
      match_count: matching.length,
      results: matching.slice(0, limit).map((n) => ({
        date: n.date,
        author: n.author,
        note_type: n.note_type,
        content: n.content,
        weather: n.weather,
        temp_high: n.temp_high,
      })),
    }
  }

  if (name === 'get_cross_project_patterns') {
    // Most common RFI subjects across all projects
    const rfiPatterns = db
      .prepare(
        `SELECT
          assigned_to,
          COUNT(*) AS rfi_count,
          COUNT(CASE WHEN cost_impact IN ('True','true',1) THEN 1 END) AS cost_impact_count
         FROM rfis
         GROUP BY assigned_to
         ORDER BY rfi_count DESC`
      )
      .all()

    // Most common CO reasons
    const coReasons = db
      .prepare(
        `SELECT
          reason_category,
          COUNT(*) AS count,
          SUM(amount) AS total_amount,
          AVG(amount) AS avg_amount
         FROM change_orders
         GROUP BY reason_category
         ORDER BY total_amount DESC`
      )
      .all()

    // SOV line descriptions consistently over budget across projects
    const overBudgetPatterns = db
      .prepare(
        `SELECT
          s.description,
          COUNT(DISTINCT s.project_id) AS project_count,
          SUM((l.hours_st + l.hours_ot * 1.5) * l.hourly_rate * l.burden_multiplier) AS total_actual_labor,
          SUM(b.estimated_labor_cost) AS total_est_labor
         FROM sov s
         JOIN sov_budget b ON b.sov_line_id = s.sov_line_id
         LEFT JOIN labor_logs l ON l.sov_line_id = s.sov_line_id AND l.project_id = s.project_id
         GROUP BY s.description
         HAVING total_actual_labor > total_est_labor * 1.3 AND project_count > 1
         ORDER BY (total_actual_labor - total_est_labor) DESC`
      )
      .all()

    // Weekly OT spikes across portfolio
    const otSpikes = db
      .prepare(
        `SELECT
          project_id,
          strftime('%Y-%W', date) AS week,
          SUM(hours_ot) AS ot_hours,
          SUM(hours_st + hours_ot) AS total_hours,
          ROUND(SUM(hours_ot) * 100.0 / SUM(hours_st + hours_ot), 1) AS ot_pct
         FROM labor_logs
         GROUP BY project_id, week
         HAVING ot_pct > 25
         ORDER BY ot_pct DESC
         LIMIT 20`
      )
      .all()

    return {
      rfi_by_assignee: rfiPatterns,
      co_by_reason: coReasons.map((r) => ({
        reason: r.reason_category,
        count: r.count,
        total_amount: Math.round(r.total_amount),
        avg_amount: Math.round(r.avg_amount),
      })),
      systemic_overrun_scopes: overBudgetPatterns.map((r) => ({
        description: r.description,
        affected_projects: r.project_count,
        total_actual_labor: Math.round(r.total_actual_labor),
        total_est_labor: Math.round(r.total_est_labor),
        overrun: Math.round(r.total_actual_labor - r.total_est_labor),
      })),
      high_ot_weeks: otSpikes,
    }
  }

  return { error: `Unknown tool: ${name}` }
}
