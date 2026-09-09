import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db')

let db = null

export function initDB() {
  db = new Database(DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      status TEXT,
      requester TEXT,
      worker TEXT,
      reward_wei TEXT,
      stake_wei TEXT,
      spec TEXT,
      criteria TEXT,
      evidence TEXT,
      outcome TEXT,
      reasoning TEXT,
      deadline TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      address TEXT PRIMARY KEY,
      role TEXT,
      private_key TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
}

export function upsertTask(task) {
  if (!db) return
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO tasks
    (id, status, requester, worker, reward_wei, stake_wei, spec, criteria, evidence, outcome, reasoning, deadline, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `)
  stmt.run(
    task.id, task.status, task.requester, task.worker,
    task.reward_wei || '0', task.stake_wei || '0',
    task.spec, task.criteria, task.evidence,
    task.outcome, task.reasoning, task.deadline
  )
}

export function getTask(id) {
  if (!db) return null
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
}

export function getAllTasks(status = null) {
  if (!db) return []
  if (status && status !== 'ALL') {
    return db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC').all(status)
  }
  return db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all()
}

export function getStats() {
  if (!db) return { total: 0, open: 0, active: 0, settled: 0 }
  const rows = db.prepare('SELECT status, COUNT(*) as count FROM tasks GROUP BY status').all()
  const map = Object.fromEntries(rows.map(r => [r.status, r.count]))
  return {
    total: Object.values(map).reduce((a, b) => a + b, 0),
    open: map['CREATED'] || 0,
    active: (map['ASSIGNED'] || 0) + (map['SUBMITTED'] || 0),
    settled: map['SETTLED'] || 0,
  }
}

export function syncFromContract(taskIds, readFn) {
  if (!db) return 0
  let synced = 0
  for (const id of taskIds) {
    try {
      const task = readFn(id)
      upsertTask(task)
      synced++
    } catch (e) {
      console.error(`Sync failed for ${id}:`, e.message)
    }
  }
  return synced
}
