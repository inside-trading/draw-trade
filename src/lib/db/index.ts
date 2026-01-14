import Database from 'better-sqlite3'
import path from 'path'

// Database singleton
let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'predictions.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    initializeDatabase(db)
  }
  return db
}

function initializeDatabase(database: Database.Database) {
  // Drop old tables if they exist (migration)
  database.exec(`DROP TABLE IF EXISTS prediction_points`)
  database.exec(`DROP TABLE IF EXISTS predictions`)

  // Create predictions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS predictions (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      submitted_at INTEGER NOT NULL,
      time_window TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      start_price REAL NOT NULL,
      total_score REAL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    )
  `)

  // Create prediction_points table
  database.exec(`
    CREATE TABLE IF NOT EXISTS prediction_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prediction_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      predicted_price REAL NOT NULL,
      actual_price REAL,
      score REAL,
      FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE CASCADE
    )
  `)

  // Create visitors table for tracking users
  database.exec(`
    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      total_score REAL NOT NULL DEFAULT 0,
      predictions_count INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Create price_history table for caching live prices
  database.exec(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL UNIQUE,
      price REAL NOT NULL
    )
  `)

  // Create indexes for efficient querying
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_predictions_visitor
    ON predictions(visitor_id)
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_predictions_status
    ON predictions(status)
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_predictions_submitted
    ON predictions(submitted_at)
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_prediction_points_prediction
    ON prediction_points(prediction_id)
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_prediction_points_timestamp
    ON prediction_points(timestamp)
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_price_history_timestamp
    ON price_history(timestamp)
  `)
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}
