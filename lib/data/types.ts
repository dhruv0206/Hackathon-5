export interface Contract {
  project_id: string
  project_name: string
  general_contractor: string
  contract_value: number
  start_date: string
  substantial_completion: string
  final_completion: string
  retention_percentage: number
  payment_terms: string
}

export interface SOVItem {
  project_id: string
  sov_line_id: string
  description: string
  total_amount: number
  labor_amount: number
  material_amount: number
  equipment_amount: number
  phase: string
  csi_code: string
}

export interface SOVBudget {
  project_id: string
  sov_line_id: string
  description: string
  budgeted_labor_hours: number
  budgeted_labor_cost: number
  budgeted_material_cost: number
  budgeted_equipment_cost: number
  estimated_productivity: number
  risk_factor: number
}

export interface LaborLog {
  log_id: string
  project_id: string
  sov_line_id: string
  date: string
  crew_id: string
  worker_name: string
  trade: string
  hours: number
  hourly_rate: number
  burden_multiplier: number
  overtime_flag: string
  notes: string
}

export interface MaterialDelivery {
  delivery_id: string
  project_id: string
  sov_line_id: string
  date: string
  vendor: string
  description: string
  quantity: number
  unit_cost: number
  total_cost: number
  po_number: string
  condition_on_arrival: string
}

export interface BillingHistory {
  billing_id: string
  project_id: string
  billing_period: string
  application_date: string
  amount_billed: number
  retention_held: number
  amount_due: number
  payment_received_date: string
  cumulative_billed: number
  cumulative_retained: number
  percent_complete: number
  status: string
}

export interface BillingLineItem {
  billing_line_id: string
  billing_id: string
  project_id: string
  sov_line_id: string
  description: string
  scheduled_value: number
  work_completed_this_period: number
  materials_stored: number
  total_completed_and_stored: number
  percent_complete: number
  balance_to_finish: number
}

export interface ChangeOrder {
  co_id: string
  project_id: string
  co_number: string
  description: string
  requested_date: string
  status: string
  amount: number
  labor_impact_hours: number
  material_cost_impact: number
  schedule_impact_days: number
  approved_date: string
  reason_category: string
}

export interface RFI {
  rfi_id: string
  project_id: string
  rfi_number: string
  subject: string
  submitted_date: string
  submitted_by: string
  assigned_to: string
  status: string
  priority: string
  description: string
  response: string
  response_date: string
  cost_impact: string
  schedule_impact: string
  related_sov_lines: string
}

export interface FieldNote {
  note_id: string
  project_id: string
  date: string
  author: string
  note_type: string
  sov_line_id: string
  summary: string
  details: string
  weather: string
  crew_size: number
  issues: string
}

export interface ProjectData {
  contracts: Contract[]
  sov: SOVItem[]
  sovBudget: SOVBudget[]
  laborLogs: LaborLog[]
  materialDeliveries: MaterialDelivery[]
  billingHistory: BillingHistory[]
  billingLineItems: BillingLineItem[]
  changeOrders: ChangeOrder[]
  rfis: RFI[]
  fieldNotes: FieldNote[]
}
