import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { portfolioTools, handlePortfolioTool } from './tools/portfolio.js'
import { financialTools, handleFinancialTool } from './tools/financial.js'
import { laborTools, handleLaborTool } from './tools/labor.js'
import { riskTools, handleRiskTool } from './tools/risk.js'

const ALL_TOOLS = [...portfolioTools, ...financialTools, ...laborTools, ...riskTools]

const PORTFOLIO_NAMES = new Set(portfolioTools.map((t) => t.name))
const FINANCIAL_NAMES = new Set(financialTools.map((t) => t.name))
const LABOR_NAMES = new Set(laborTools.map((t) => t.name))
const RISK_NAMES = new Set(riskTools.map((t) => t.name))

function dispatchTool(name, args) {
  if (PORTFOLIO_NAMES.has(name)) return handlePortfolioTool(name, args)
  if (FINANCIAL_NAMES.has(name)) return handleFinancialTool(name, args)
  if (LABOR_NAMES.has(name)) return handleLaborTool(name, args)
  if (RISK_NAMES.has(name)) return handleRiskTool(name, args)
  return { error: `Unknown tool: ${name}` }
}

const server = new Server(
  {
    name: 'hvac-margin-rescue',
    version: '1.0.0',
  },
  {
    capabilities: { tools: {} },
  }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS,
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    const result = dispatchTool(name, args ?? {})
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: err.message, tool: name }),
        },
      ],
      isError: true,
    }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
