import { getDb, round } from '../db.js'

export const laborTools = [
  {
    name: 'analyze_labor_productivity',
    description:
      'Analyze labor productivity per SOV line: budgeted vs actual hours, overtime percentage, and cost variance. Identifies crew inefficiencies and schedule pressure across a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        sov_line_id: {
          type: 'string',
          description: 'Optional: filter to a specific SOV line (e.g. PRJ-2024-001-SOV-04)',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_labor_summary_by_role',
    description:
      'Break down labor hours and cost by worker role (Foreman, Journeyman Pipefitter, Apprentice, etc.) for a project. Shows which trades are driving cost overruns.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_labor_timeline',
    description:
      'Get weekly labor hours and cost over time for a project. Shows the crew ramp-up, peak, and wind-down — useful for identifying periods of high overtime or schedule acceleration.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
      },
      required: ['project_id'],
    },
  },
]

export function handleLaborTool(name, args) {
  const db = getDb()

  if (name === 'analyze_labor_productivity') {
    const { project_id, sov_line_id } = args

    let query = `
      SELECT
        s.sov_line_id,
        s.description,
        COALESCE(b.estimated_labor_hours, 0) AS est_hours,
        COALESCE(b.estimated_labor_cost, 0)  AS est_cost,
        COALESCE(b.productivity_factor, 1)   AS productivity_factor,
        COALESCE(SUM(l.hours_st), 0)         AS actual_st,
        COALESCE(SUM(l.hours_ot), 0)         AS actual_ot,
        COALESCE(SUM((l.hours_st + l.hours_ot * 1.5) * l.hourly_rate * l.burden_multiplier), 0) AS actual_cost,
        COUNT(DISTINCT l.employee_id)        AS unique_employees,
        COUNT(DISTINCT l.role)               AS unique_roles
      FROM sov s
      LEFT JOIN sov_budget b ON b.sov_line_id = s.sov_line_id
      LEFT JOIN labor_logs l ON l.sov_line_id = s.sov_line_id AND l.project_id = s.project_id
      WHERE s.project_id = ?`

    const params = [project_id]
    if (sov_line_id) {
      query += ' AND s.sov_line_id = ?'
      params.push(sov_line_id)
    }
    query += ' GROUP BY s.sov_line_id ORDER BY s.line_number'

    const rows = db.prepare(query).all(...params)

    const lines = rows
      .filter((r) => r.actual_st + r.actual_ot > 0)
      .map((r) => {
        const actualHours = r.actual_st + r.actual_ot
        const hoursVar = actualHours - r.est_hours
        return {
          sov_line_id: r.sov_line_id,
          description: r.description,
          est_hours: r.est_hours,
          actual_hours: actualHours,
          straight_time_hours: r.actual_st,
          overtime_hours: r.actual_ot,
          overtime_pct: actualHours > 0 ? round((r.actual_ot / actualHours) * 100) : 0,
          hours_variance: Math.round(hoursVar),
          hours_variance_pct: r.est_hours > 0 ? round((hoursVar / r.est_hours) * 100) : 0,
          est_labor_cost: r.est_cost,
          actual_labor_cost: Math.round(r.actual_cost),
          cost_variance: Math.round(r.actual_cost - r.est_cost),
          productivity_factor: r.productivity_factor,
          unique_employees: r.unique_employees,
        }
      })

    const totST = lines.reduce((s, l) => s + l.straight_time_hours, 0)
    const totOT = lines.reduce((s, l) => s + l.overtime_hours, 0)

    return {
      project_id,
      lines,
      summary: {
        total_st_hours: Math.round(totST),
        total_ot_hours: Math.round(totOT),
        overall_ot_pct: totST + totOT > 0 ? round((totOT / (totST + totOT)) * 100) : 0,
        lines_over_budget: lines.filter((l) => l.hours_variance > 0).length,
        lines_under_budget: lines.filter((l) => l.hours_variance < 0).length,
        worst_overrun: lines.sort((a, b) => b.hours_variance - a.hours_variance)[0]?.description,
      },
    }
  }

  if (name === 'get_labor_summary_by_role') {
    const { project_id } = args
    const rows = db
      .prepare(
        `SELECT
          role,
          COUNT(DISTINCT employee_id)                                           AS unique_workers,
          SUM(hours_st)                                                         AS total_st_hours,
          SUM(hours_ot)                                                         AS total_ot_hours,
          SUM(hours_st + hours_ot)                                              AS total_hours,
          AVG(hourly_rate)                                                      AS avg_rate,
          SUM((hours_st + hours_ot * 1.5) * hourly_rate * burden_multiplier)   AS total_cost
         FROM labor_logs
         WHERE project_id = ?
         GROUP BY role
         ORDER BY total_cost DESC`
      )
      .all(project_id)

    return {
      project_id,
      by_role: rows.map((r) => ({
        role: r.role,
        unique_workers: r.unique_workers,
        total_st_hours: Math.round(r.total_st_hours),
        total_ot_hours: Math.round(r.total_ot_hours),
        total_hours: Math.round(r.total_hours),
        ot_pct: r.total_hours > 0 ? round((r.total_ot_hours / r.total_hours) * 100) : 0,
        avg_hourly_rate: round(r.avg_rate),
        total_cost: Math.round(r.total_cost),
      })),
    }
  }

  if (name === 'get_labor_timeline') {
    const { project_id } = args
    const rows = db
      .prepare(
        `SELECT
          strftime('%Y-%W', date) AS week,
          MIN(date)               AS week_start,
          SUM(hours_st)           AS st_hours,
          SUM(hours_ot)           AS ot_hours,
          COUNT(DISTINCT employee_id) AS workers,
          SUM((hours_st + hours_ot * 1.5) * hourly_rate * burden_multiplier) AS labor_cost
         FROM labor_logs
         WHERE project_id = ?
         GROUP BY week
         ORDER BY week`
      )
      .all(project_id)

    return {
      project_id,
      weekly_timeline: rows.map((r) => ({
        week: r.week,
        week_start: r.week_start,
        st_hours: Math.round(r.st_hours),
        ot_hours: Math.round(r.ot_hours),
        total_hours: Math.round(r.st_hours + r.ot_hours),
        ot_pct: round((r.ot_hours / (r.st_hours + r.ot_hours)) * 100),
        active_workers: r.workers,
        labor_cost: Math.round(r.labor_cost),
      })),
    }
  }

  return { error: `Unknown tool: ${name}` }
}
