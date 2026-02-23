import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const IS_VERCEL = !!process.env.VERCEL

function findDbPath(): string {
  const candidates = [
    path.join(process.cwd(), 'hvac_data.db'),
    path.join(process.cwd(), '.next', 'server', 'hvac_data.db'),
    path.resolve(__dirname, '..', '..', 'hvac_data.db'),
    path.resolve(__dirname, '..', 'hvac_data.db'),
    path.resolve(__dirname, 'hvac_data.db'),
    '/var/task/hvac_data.db',
    '/var/task/.next/server/hvac_data.db',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log('[db] found at:', p)
      // On Vercel, filesystem is read-only — SQLite needs a writable location
      // for journal files even in readonly mode. Copy to /tmp first.
      if (IS_VERCEL) {
        const tmpPath = '/tmp/hvac_data.db'
        if (!fs.existsSync(tmpPath)) {
          fs.copyFileSync(p, tmpPath)
          console.log('[db] copied to /tmp for Vercel')
        }
        return tmpPath
      }
      return p
    }
  }
  throw new Error(
    `hvac_data.db not found. Tried:\n${candidates.join('\n')}\ncwd=${process.cwd()} __dirname=${__dirname}`
  )
}

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath = findDbPath()
    _db = new Database(dbPath, { readonly: true })
  }
  return _db
}
