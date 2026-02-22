'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
)

// ─── Shared chart defaults ────────────────────────────────────────────────────

const FONT_COLOR = '#94a3b8'
const GRID_COLOR = 'rgba(148,163,184,0.1)'

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: FONT_COLOR, font: { size: 11 }, boxWidth: 12, padding: 8 },
    },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      borderColor: '#334155',
      borderWidth: 1,
      callbacks: {
        label: (ctx: any) => {
          const val = ctx.parsed.x ?? ctx.parsed.y
          if (typeof val === 'number' && Math.abs(val) > 999) {
            return ` $${(val / 1000).toFixed(1)}k`
          }
          return ` ${val}`
        },
      },
    },
  },
  scales: {
    x: {
      ticks: { color: FONT_COLOR, font: { size: 10 } },
      grid: { color: GRID_COLOR },
    },
    y: {
      ticks: { color: FONT_COLOR, font: { size: 10 } },
      grid: { color: GRID_COLOR },
    },
  },
}

// ─── Portfolio Overview — Horizontal Bar ─────────────────────────────────────

function PortfolioOverviewChart({ result }: { result: any[] }) {
  const top5 = result.slice(0, 5)
  const labels = top5.map((p: any) => p.projectName?.split(' - ')[0] ?? p.projectId)
  return (
    <ChartCard title="Contract vs Billed ($M)">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: 'Contract Value',
              data: top5.map((p: any) => +(p.contractValue / 1e6).toFixed(2)),
              backgroundColor: 'rgba(99,102,241,0.7)',
              borderRadius: 4,
            },
            {
              label: 'Billed to Date',
              data: top5.map((p: any) => +(p.cumulativeBilled / 1e6).toFixed(2)),
              backgroundColor: 'rgba(34,197,94,0.7)',
              borderRadius: 4,
            },
          ],
        }}
        options={{
          ...baseOptions,
          indexAxis: 'y' as const,
          plugins: {
            ...baseOptions.plugins,
            tooltip: {
              ...baseOptions.plugins.tooltip,
              callbacks: {
                label: (ctx: any) => ` $${ctx.parsed.x.toFixed(1)}M`,
              },
            },
          },
          scales: {
            x: { ...baseOptions.scales.x, ticks: { ...baseOptions.scales.x.ticks, callback: (v: any) => `$${v}M` } },
            y: { ...baseOptions.scales.y },
          },
        }}
      />
    </ChartCard>
  )
}

// ─── Margin Analysis — Horizontal Bar (top overruns) ─────────────────────────

function MarginAnalysisChart({ result }: { result: any }) {
  const lines = (result.lineItemAnalysis ?? []).slice(0, 8)
  const labels = lines.map((l: any) => shortLabel(l.description))
  return (
    <ChartCard title="Budget vs Actual Cost (Top Variances)">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: 'Budgeted',
              data: lines.map((l: any) => l.budgetedLaborCost + l.budgetedMaterialCost),
              backgroundColor: 'rgba(99,102,241,0.7)',
              borderRadius: 4,
            },
            {
              label: 'Actual',
              data: lines.map((l: any) => l.actualLaborCost + l.actualMaterialCost),
              backgroundColor: lines.map((l: any) =>
                l.totalVariance > 0 ? 'rgba(239,68,68,0.8)' : 'rgba(34,197,94,0.7)'
              ),
              borderRadius: 4,
            },
          ],
        }}
        options={{
          ...baseOptions,
          indexAxis: 'y' as const,
          plugins: {
            ...baseOptions.plugins,
            tooltip: {
              ...baseOptions.plugins.tooltip,
              callbacks: { label: (ctx: any) => ` $${(ctx.parsed.x / 1000).toFixed(0)}k` },
            },
          },
          scales: {
            x: { ...baseOptions.scales.x, ticks: { ...baseOptions.scales.x.ticks, callback: (v: any) => `$${(+v / 1000).toFixed(0)}k` } },
            y: { ...baseOptions.scales.y },
          },
        }}
      />
    </ChartCard>
  )
}

// ─── Labor Productivity — Grouped Bar + OT Doughnut ──────────────────────────

function LaborProductivityChart({ result }: { result: any }) {
  const lines = (result.analysis ?? [])
    .filter((l: any) => l.actualHours > 0)
    .slice(0, 8)
  const labels = lines.map((l: any) => shortLabel(l.description ?? l.sovLineId))
  const ot = result.overtimeSummary ?? {}

  return (
    <div className="space-y-3">
      <ChartCard title="Budgeted vs Actual Hours">
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: 'Budgeted',
                data: lines.map((l: any) => l.budgetedHours),
                backgroundColor: 'rgba(99,102,241,0.7)',
                borderRadius: 4,
              },
              {
                label: 'Straight Time',
                data: lines.map((l: any) => l.straightTimeHours),
                backgroundColor: 'rgba(34,197,94,0.7)',
                borderRadius: 4,
              },
              {
                label: 'Overtime',
                data: lines.map((l: any) => l.overtimeHours),
                backgroundColor: 'rgba(245,158,11,0.8)',
                borderRadius: 4,
              },
            ],
          }}
          options={{
            ...baseOptions,
            plugins: { ...baseOptions.plugins },
          }}
        />
      </ChartCard>

      {ot.totalOTHours > 0 && (
        <ChartCard title="ST vs OT Hours Split" height={180}>
          <Doughnut
            data={{
              labels: ['Straight Time', 'Overtime'],
              datasets: [
                {
                  data: [ot.totalSTHours ?? 0, ot.totalOTHours ?? 0],
                  backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(245,158,11,0.8)'],
                  borderColor: ['#16a34a', '#d97706'],
                  borderWidth: 1,
                },
              ],
            }}
            options={{
              ...baseOptions,
              scales: undefined as any,
              plugins: {
                ...baseOptions.plugins,
                tooltip: {
                  ...baseOptions.plugins.tooltip,
                  callbacks: { label: (ctx: any) => ` ${ctx.parsed.toLocaleString()} hrs` },
                },
              },
            }}
          />
        </ChartCard>
      )}
    </div>
  )
}

// ─── Change Orders — Doughnut + Amount Bar ───────────────────────────────────

function ChangeOrderChart({ result }: { result: any }) {
  const s = result.summary ?? {}
  const hasCounts = (s.approvedCount ?? 0) + (s.pendingCount ?? 0) + (s.rejectedCount ?? 0) > 0

  return (
    <div className="space-y-3">
      {hasCounts && (
        <ChartCard title="Change Order Status" height={180}>
          <Doughnut
            data={{
              labels: ['Approved', 'Pending', 'Rejected'],
              datasets: [
                {
                  data: [s.approvedCount ?? 0, s.pendingCount ?? 0, s.rejectedCount ?? 0],
                  backgroundColor: [
                    'rgba(34,197,94,0.8)',
                    'rgba(245,158,11,0.8)',
                    'rgba(239,68,68,0.8)',
                  ],
                  borderColor: ['#16a34a', '#d97706', '#dc2626'],
                  borderWidth: 1,
                },
              ],
            }}
            options={{
              ...baseOptions,
              scales: undefined as any,
              plugins: {
                ...baseOptions.plugins,
                tooltip: {
                  ...baseOptions.plugins.tooltip,
                  callbacks: { label: (ctx: any) => ` ${ctx.parsed} COs` },
                },
              },
            }}
          />
        </ChartCard>
      )}

      <ChartCard title="Change Order Value by Status ($k)">
        <Bar
          data={{
            labels: ['Approved', 'Pending', 'Rejected'],
            datasets: [
              {
                label: 'Amount',
                data: [
                  (s.approvedAmount ?? 0) / 1000,
                  (s.pendingAmount ?? 0) / 1000,
                  (s.rejectedAmount ?? 0) / 1000,
                ],
                backgroundColor: [
                  'rgba(34,197,94,0.8)',
                  'rgba(245,158,11,0.8)',
                  'rgba(239,68,68,0.8)',
                ],
                borderRadius: 4,
              },
            ],
          }}
          options={{
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              legend: { display: false },
              tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: { label: (ctx: any) => ` $${ctx.parsed.y.toFixed(0)}k` },
              },
            },
            scales: {
              x: { ...baseOptions.scales.x },
              y: { ...baseOptions.scales.y, ticks: { ...baseOptions.scales.y.ticks, callback: (v: any) => `$${v}k` } },
            },
          }}
        />
      </ChartCard>
    </div>
  )
}

// ─── Billing Status — Line chart ─────────────────────────────────────────────

function BillingStatusChart({ result }: { result: any }) {
  const apps = [...(result.recentApplications ?? [])].reverse()
  if (apps.length < 2) return null

  const labels = apps.map((a: any) => a.period_end?.slice(0, 7) ?? '')
  return (
    <ChartCard title="Cumulative Billing Over Time ($M)">
      <Line
        data={{
          labels,
          datasets: [
            {
              label: 'Billed',
              data: apps.map((a: any) => +(a.cumulative_billed / 1e6).toFixed(2)),
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99,102,241,0.15)',
              fill: true,
              tension: 0.3,
              pointRadius: 3,
              pointBackgroundColor: '#6366f1',
            },
            {
              label: 'Retention Held',
              data: apps.map((a: any) => +(a.retention_held / 1e6).toFixed(2)),
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245,158,11,0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 3,
              pointBackgroundColor: '#f59e0b',
            },
          ],
        }}
        options={{
          ...baseOptions,
          plugins: {
            ...baseOptions.plugins,
            tooltip: {
              ...baseOptions.plugins.tooltip,
              callbacks: { label: (ctx: any) => ` $${ctx.parsed.y.toFixed(2)}M` },
            },
          },
          scales: {
            x: { ...baseOptions.scales.x },
            y: { ...baseOptions.scales.y, ticks: { ...baseOptions.scales.y.ticks, callback: (v: any) => `$${v}M` } },
          },
        }}
      />
    </ChartCard>
  )
}

// ─── RFI Analysis — Stacked bar by status & priority ─────────────────────────

function RFIAnalysisChart({ result }: { result: any }) {
  const s = result.summary ?? {}
  return (
    <div className="space-y-3">
      <ChartCard title="RFI Status Breakdown" height={160}>
        <Bar
          data={{
            labels: ['Open', 'Pending Response', 'Closed'],
            datasets: [
              {
                label: 'Count',
                data: [s.open ?? 0, s.pendingResponse ?? 0, s.closed ?? 0],
                backgroundColor: [
                  'rgba(239,68,68,0.8)',
                  'rgba(245,158,11,0.8)',
                  'rgba(34,197,94,0.8)',
                ],
                borderRadius: 4,
              },
            ],
          }}
          options={{
            ...baseOptions,
            plugins: { ...baseOptions.plugins, legend: { display: false } },
          }}
        />
      </ChartCard>

      {(s.withCostImpact > 0 || s.withScheduleImpact > 0) && (
        <ChartCard title="RFIs with Impact Flags" height={160}>
          <Bar
            data={{
              labels: ['Cost Impact', 'Schedule Impact', 'High/Critical Open'],
              datasets: [
                {
                  label: 'RFIs',
                  data: [
                    s.withCostImpact ?? 0,
                    s.withScheduleImpact ?? 0,
                    s.openHighOrCritical ?? 0,
                  ],
                  backgroundColor: [
                    'rgba(239,68,68,0.8)',
                    'rgba(245,158,11,0.8)',
                    'rgba(168,85,247,0.8)',
                  ],
                  borderRadius: 4,
                },
              ],
            }}
            options={{
              ...baseOptions,
              plugins: { ...baseOptions.plugins, legend: { display: false } },
            }}
          />
        </ChartCard>
      )}
    </div>
  )
}

// ─── Shared card wrapper ──────────────────────────────────────────────────────

function ChartCard({
  title,
  children,
  height = 220,
}: {
  title: string
  children: React.ReactNode
  height?: number
}) {
  return (
    <div className="rounded-lg bg-background/60 border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
      <div style={{ height }}>
        {children}
      </div>
    </div>
  )
}

function shortLabel(str: string): string {
  return str.length > 22 ? str.slice(0, 20) + '…' : str
}

// ─── Project Risk Factors — Productivity factor bar + CO/RFI summary ─────────

function ProjectRiskChart({ result }: { result: any }) {
  const lines = (result.riskySOVLines ?? []).slice(0, 8)
  const pendingCOs = result.pendingChangeOrders ?? []
  const s = result.summary ?? {}

  return (
    <div className="space-y-3">
      {lines.length > 0 && (
        <ChartCard title="Risky SOV Lines — Productivity Factor (bid-time risk)">
          <Bar
            data={{
              labels: lines.map((l: any) => shortLabel(l.description)),
              datasets: [
                {
                  label: 'Productivity Factor',
                  data: lines.map((l: any) => l.productivityFactor),
                  backgroundColor: lines.map((l: any) =>
                    l.productivityFactor < 0.8
                      ? 'rgba(239,68,68,0.85)'
                      : l.productivityFactor < 0.95
                      ? 'rgba(245,158,11,0.85)'
                      : 'rgba(34,197,94,0.75)'
                  ),
                  borderRadius: 4,
                },
              ],
            }}
            options={{
              ...baseOptions,
              indexAxis: 'y' as const,
              plugins: {
                ...baseOptions.plugins,
                legend: { display: false },
                tooltip: {
                  ...baseOptions.plugins.tooltip,
                  callbacks: { label: (ctx: any) => ` ${ctx.parsed.x.toFixed(2)}x productivity` },
                },
              },
              scales: {
                x: {
                  ...baseOptions.scales.x,
                  min: 0,
                  max: 1.2,
                  ticks: { ...baseOptions.scales.x.ticks, callback: (v: any) => `${v}x` },
                },
                y: { ...baseOptions.scales.y },
              },
            }}
          />
        </ChartCard>
      )}

      {(s.pendingCOsAmount > 0 || s.openHighRFICount > 0) && (
        <ChartCard title="Risk Exposure Summary" height={160}>
          <Bar
            data={{
              labels: ['Pending COs ($k)', 'High-Priority RFIs', 'Risky SOV Lines'],
              datasets: [
                {
                  label: 'Value',
                  data: [
                    Math.round((s.pendingCOsAmount ?? 0) / 1000),
                    s.openHighRFICount ?? 0,
                    s.riskyLineCount ?? 0,
                  ],
                  backgroundColor: [
                    'rgba(245,158,11,0.85)',
                    'rgba(239,68,68,0.85)',
                    'rgba(168,85,247,0.85)',
                  ],
                  borderRadius: 4,
                },
              ],
            }}
            options={{
              ...baseOptions,
              plugins: {
                ...baseOptions.plugins,
                legend: { display: false },
                tooltip: {
                  ...baseOptions.plugins.tooltip,
                  callbacks: {
                    label: (ctx: any) => {
                      if (ctx.dataIndex === 0) return ` $${ctx.parsed.y}k`
                      return ` ${ctx.parsed.y} items`
                    },
                  },
                },
              },
            }}
          />
        </ChartCard>
      )}
    </div>
  )
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

const CHART_TOOLS = new Set([
  'getPortfolioOverview',
  'analyzeMargins',
  'analyzeLaborProductivity',
  'getChangeOrderStatus',
  'getBillingStatus',
  'getRFIAnalysis',
  'getProjectRiskFactors',
])

export function hasChart(toolName: string): boolean {
  return CHART_TOOLS.has(toolName)
}

export function ToolChart({
  toolName,
  result,
}: {
  toolName: string
  result: any
}) {
  if (!result) return null

  switch (toolName) {
    case 'getPortfolioOverview':
      return Array.isArray(result) ? <PortfolioOverviewChart result={result} /> : null

    case 'analyzeMargins':
      return result.lineItemAnalysis ? <MarginAnalysisChart result={result} /> : null

    case 'analyzeLaborProductivity':
      return result.analysis ? <LaborProductivityChart result={result} /> : null

    case 'getChangeOrderStatus':
      return result.summary ? <ChangeOrderChart result={result} /> : null

    case 'getBillingStatus':
      return result.recentApplications ? <BillingStatusChart result={result} /> : null

    case 'getRFIAnalysis':
      return result.summary ? <RFIAnalysisChart result={result} /> : null

    case 'getProjectRiskFactors':
      return result.summary ? <ProjectRiskChart result={result} /> : null

    default:
      return null
  }
}
