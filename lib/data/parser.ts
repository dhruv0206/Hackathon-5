import Papa from 'papaparse'
import fs from 'fs'
import path from 'path'
import type { ProjectData } from './types'

const DATA_DIR = path.join(process.cwd(), 'hvac_construction_dataset')

function parseCSV<T>(filename: string): T[] {
  const filePath = path.join(DATA_DIR, filename)
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  
  const result = Papa.parse<T>(fileContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  })
  
  return result.data
}

let cachedData: ProjectData | null = null

export function loadProjectData(): ProjectData {
  if (cachedData) {
    return cachedData
  }

  cachedData = {
    contracts: parseCSV('contracts.csv'),
    sov: parseCSV('sov.csv'),
    sovBudget: parseCSV('sov_budget.csv'),
    laborLogs: parseCSV('labor_logs.csv'),
    materialDeliveries: parseCSV('material_deliveries.csv'),
    billingHistory: parseCSV('billing_history.csv'),
    billingLineItems: parseCSV('billing_line_items.csv'),
    changeOrders: parseCSV('change_orders.csv'),
    rfis: parseCSV('rfis.csv'),
    fieldNotes: parseCSV('field_notes.csv'),
  }

  return cachedData
}

export function clearCache() {
  cachedData = null
}
