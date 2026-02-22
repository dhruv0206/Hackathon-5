const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')

const DATA_DIR = path.join(__dirname, '..', 'hvac_construction_dataset')
const DB_PATH = path.join(__dirname, '..', 'hvac_data.db')

function readCSV(filename) {
  const content = fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8')
  const result = Papa.parse(content, { header: true, skipEmptyLines: true, dynamicTyping: true })
  return result.data
}

function seed() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)

  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')

  db.exec(`
    CREATE TABLE contracts (
      project_id TEXT PRIMARY KEY,
      project_name TEXT,
      original_contract_value REAL,
      contract_date TEXT,
      substantial_completion_date TEXT,
      retention_pct REAL,
      payment_terms TEXT,
      gc_name TEXT,
      architect TEXT,
      engineer_of_record TEXT
    );

    CREATE TABLE sov (
      project_id TEXT,
      sov_line_id TEXT PRIMARY KEY,
      line_number INTEGER,
      description TEXT,
      scheduled_value REAL,
      labor_pct REAL,
      material_pct REAL
    );

    CREATE TABLE sov_budget (
      project_id TEXT,
      sov_line_id TEXT PRIMARY KEY,
      estimated_labor_hours REAL,
      estimated_labor_cost REAL,
      estimated_material_cost REAL,
      estimated_equipment_cost REAL,
      estimated_sub_cost REAL,
      productivity_factor REAL,
      key_assumptions TEXT
    );

    CREATE TABLE labor_logs (
      project_id TEXT,
      log_id TEXT PRIMARY KEY,
      date TEXT,
      employee_id TEXT,
      role TEXT,
      sov_line_id TEXT,
      hours_st REAL,
      hours_ot REAL,
      hourly_rate REAL,
      burden_multiplier REAL,
      work_area TEXT,
      cost_code INTEGER
    );

    CREATE TABLE material_deliveries (
      project_id TEXT,
      delivery_id TEXT PRIMARY KEY,
      date TEXT,
      sov_line_id TEXT,
      material_category TEXT,
      item_description TEXT,
      quantity REAL,
      unit TEXT,
      unit_cost REAL,
      total_cost REAL,
      po_number TEXT,
      vendor TEXT,
      received_by TEXT,
      condition_notes TEXT
    );

    CREATE TABLE billing_history (
      project_id TEXT,
      application_number INTEGER,
      period_end TEXT,
      period_total REAL,
      cumulative_billed REAL,
      retention_held REAL,
      net_payment_due REAL,
      status TEXT,
      payment_date TEXT,
      line_item_count INTEGER,
      PRIMARY KEY (project_id, application_number)
    );

    CREATE TABLE billing_line_items (
      sov_line_id TEXT,
      description TEXT,
      scheduled_value REAL,
      previous_billed REAL,
      this_period REAL,
      total_billed REAL,
      pct_complete REAL,
      balance_to_finish REAL,
      project_id TEXT,
      application_number INTEGER,
      PRIMARY KEY (sov_line_id, application_number)
    );

    CREATE TABLE change_orders (
      project_id TEXT,
      co_number TEXT,
      date_submitted TEXT,
      reason_category TEXT,
      description TEXT,
      amount REAL,
      status TEXT,
      related_rfi TEXT,
      affected_sov_lines TEXT,
      labor_hours_impact REAL,
      schedule_impact_days REAL,
      submitted_by TEXT,
      approved_by TEXT,
      PRIMARY KEY (project_id, co_number)
    );

    CREATE TABLE rfis (
      project_id TEXT,
      rfi_number TEXT,
      date_submitted TEXT,
      subject TEXT,
      submitted_by TEXT,
      assigned_to TEXT,
      priority TEXT,
      status TEXT,
      date_required TEXT,
      date_responded TEXT,
      response_summary TEXT,
      cost_impact TEXT,
      schedule_impact TEXT,
      PRIMARY KEY (project_id, rfi_number)
    );

    CREATE TABLE field_notes (
      project_id TEXT,
      note_id TEXT PRIMARY KEY,
      date TEXT,
      author TEXT,
      note_type TEXT,
      content TEXT,
      photos_attached INTEGER,
      weather TEXT,
      temp_high REAL,
      temp_low REAL
    );

    -- Indexes for common query patterns
    CREATE INDEX idx_labor_project ON labor_logs(project_id);
    CREATE INDEX idx_labor_sov ON labor_logs(sov_line_id);
    CREATE INDEX idx_labor_project_sov ON labor_logs(project_id, sov_line_id);
    CREATE INDEX idx_materials_project ON material_deliveries(project_id);
    CREATE INDEX idx_materials_sov ON material_deliveries(sov_line_id);
    CREATE INDEX idx_billing_history_project ON billing_history(project_id);
    CREATE INDEX idx_billing_items_project ON billing_line_items(project_id);
    CREATE INDEX idx_billing_items_sov ON billing_line_items(sov_line_id);
    CREATE INDEX idx_co_project ON change_orders(project_id);
    CREATE INDEX idx_rfi_project ON rfis(project_id);
    CREATE INDEX idx_notes_project ON field_notes(project_id);
    CREATE INDEX idx_sov_project ON sov(project_id);
    CREATE INDEX idx_budget_project ON sov_budget(project_id);
  `)

  const tables = [
    { file: 'contracts.csv', table: 'contracts' },
    { file: 'sov.csv', table: 'sov' },
    { file: 'sov_budget.csv', table: 'sov_budget' },
    { file: 'labor_logs.csv', table: 'labor_logs' },
    { file: 'material_deliveries.csv', table: 'material_deliveries' },
    { file: 'billing_history.csv', table: 'billing_history' },
    { file: 'billing_line_items.csv', table: 'billing_line_items' },
    { file: 'change_orders.csv', table: 'change_orders' },
    { file: 'rfis.csv', table: 'rfis' },
    { file: 'field_notes.csv', table: 'field_notes' },
  ]

  for (const { file, table } of tables) {
    const rows = readCSV(file)
    if (rows.length === 0) continue

    const cols = Object.keys(rows[0])
    const placeholders = cols.map(() => '?').join(', ')
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
    )

    const insertMany = db.transaction((records) => {
      for (const row of records) {
        stmt.run(cols.map((c) => row[c] ?? null))
      }
    })

    insertMany(rows)
    console.log(`✓ ${table}: ${rows.length} rows`)
  }

  db.close()
  console.log(`\nDatabase created at ${DB_PATH}`)
}

seed()
