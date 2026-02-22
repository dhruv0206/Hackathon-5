import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', '..', 'hvac_data.db')

let _db = null

export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: true })
    _db.pragma('journal_mode = WAL')
  }
  return _db
}

export function isTruthy(val) {
  return val === true || val === 'True' || val === 'true'
}

export function round(n) {
  return Math.round(n * 100) / 100
}
