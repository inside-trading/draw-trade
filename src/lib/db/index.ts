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
  // Create predictions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS predictions (
      id TEXT PRIMARY KEY,
      asset_symbol TEXT NOT NULL,
      time_window TEXT NOT NULL,
      session_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)

  // Create prediction_points table
  database.exec(`
    CREATE TABLE IF NOT EXISTS prediction_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prediction_id TEXT NOT NULL,
      time INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE CASCADE
    )
  `)

  // Create indexes for efficient querying
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_predictions_asset_window
    ON predictions(asset_symbol, time_window)
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_prediction_points_prediction
    ON prediction_points(prediction_id)
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_prediction_points_time
    ON prediction_points(time)
  `)
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}
