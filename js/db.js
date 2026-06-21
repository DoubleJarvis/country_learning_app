// Client-side SQLite database using SQL.js
// Manages quiz guess history

// ---------------------------------------------------------------------------
// Schema migrations
//
// Append-only, ordered list. Each migration runs once per database, in version
// order, inside its own transaction; the applied versions are recorded in the
// `schema_migrations` table. On a normal load (nothing pending) we only run a
// single SELECT instead of re-issuing every CREATE TABLE.
//
// Rules:
//  - Versions are UTC datetime integers (YYYYMMDDhhmmss), strictly increasing.
//  - Never edit a migration once shipped; only append new ones.
//  - The baseline (first) migration must build the complete current schema, so
//    a fresh install is simply "run every migration".
// ---------------------------------------------------------------------------
const MIGRATIONS = [
  {
    version: 20251201000000,
    name: 'baseline schema',
    up: (db) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS guesses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          country_code TEXT NOT NULL,
          country_display_name TEXT NOT NULL,
          quiz_type TEXT NOT NULL,
          guess_type TEXT NOT NULL,
          guessed_country_code TEXT,
          guessed_country_name TEXT,
          time_ms INTEGER,
          timestamp INTEGER NOT NULL
        )
      `)
      db.run(`
        CREATE TABLE IF NOT EXISTS quiz_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quiz_type TEXT NOT NULL,
          region TEXT NOT NULL,
          correct_count INTEGER NOT NULL,
          shaky_count INTEGER NOT NULL,
          incorrect_count INTEGER NOT NULL,
          time_ms INTEGER NOT NULL,
          completed_fully INTEGER NOT NULL DEFAULT 1,
          timestamp INTEGER NOT NULL
        )
      `)
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `)
      db.run('CREATE INDEX IF NOT EXISTS idx_country_code ON guesses(country_code)')
      db.run('CREATE INDEX IF NOT EXISTS idx_quiz_type ON guesses(quiz_type)')
      db.run('CREATE INDEX IF NOT EXISTS idx_timestamp ON guesses(timestamp)')
      db.run('CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON quiz_runs(timestamp)')
    },
  },
]

class QuizDatabase {
  constructor() {
    this.db = null
    this.SQL = null
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) return

    try {
      // Load SQL.js from CDN
      const initSqlJs = window.initSqlJs
      if (!initSqlJs) {
        console.error('SQL.js not loaded')
        return
      }

      this.SQL = await initSqlJs({
        locateFile: file => `https://sql.js.org/dist/${file}`
      })

      // Load the existing database from localStorage, or start a new one
      const savedDb = localStorage.getItem('quiz_database')
      if (savedDb) {
        const uint8Array = new Uint8Array(JSON.parse(savedDb))
        this.db = new this.SQL.Database(uint8Array)
      } else {
        this.db = new this.SQL.Database()
      }

      // Bring the schema up to date. Only persist if something actually
      // changed, so a normal load (nothing pending) does almost no work.
      const changed = this.runMigrations()

      this.initialized = true
      if (changed) this.saveToLocalStorage()
    } catch (error) {
      // A failed migration throws before we save, so the stored database is
      // left exactly as it was — the app keeps the last good copy.
      console.error('Failed to initialize database:', error)
    }
  }

  // Applies any migrations this database hasn't seen yet, in version order,
  // each inside its own transaction. Returns whether anything changed.
  runMigrations() {
    if (!this.db) return false

    // The only schema statement that runs on every load.
    this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      )
    `)

    const applied = this.appliedVersions()
    let changed = false

    // Legacy adoption: a database created before this migration system has the
    // data tables but no recorded migrations. Normalize it to the baseline
    // schema with introspection (CREATE ... IF NOT EXISTS for anything missing,
    // plus column ALTERs), then stamp the baseline as applied so we don't try
    // to recreate what it already has. Everything after the baseline then runs
    // through the clean versioned path.
    if (applied.size === 0 && this.tableExists('guesses')) {
      try {
        this.db.run('BEGIN')
        MIGRATIONS[0].up(this.db)
        this.addMissingColumns()
        this.db.run(
          'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
          [MIGRATIONS[0].version, Date.now()]
        )
        this.db.run('COMMIT')
        applied.add(MIGRATIONS[0].version)
        changed = true
      } catch (error) {
        this.db.run('ROLLBACK')
        console.error('Legacy schema adoption failed:', error)
        throw error
      }
    }

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue

      try {
        this.db.run('BEGIN')
        migration.up(this.db)
        this.db.run(
          'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
          [migration.version, Date.now()]
        )
        this.db.run('COMMIT')
        changed = true
      } catch (error) {
        // Roll back this migration and abort the run. initialize() will skip
        // the save, so the stored database stays at the last good version.
        this.db.run('ROLLBACK')
        console.error(`Migration ${migration.version} (${migration.name}) failed:`, error)
        throw error
      }
    }

    return changed
  }

  // Set of migration versions already applied to this database.
  appliedVersions() {
    const result = this.db.exec('SELECT version FROM schema_migrations')
    if (result.length === 0) return new Set()
    return new Set(result[0].values.map(row => row[0]))
  }

  tableExists(name) {
    const stmt = this.db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?"
    )
    stmt.bind([name])
    const exists = stmt.step()
    stmt.free()
    return exists
  }

  // Legacy-only normalizer: adds columns that pre-migration-system databases
  // may be missing. CREATE TABLE IF NOT EXISTS can't add columns to an existing
  // table, so these are detected by introspection. New schema changes go
  // through MIGRATIONS instead.
  addMissingColumns() {
    const guessCols = this.db.exec('PRAGMA table_info(guesses)')
    if (guessCols.length > 0) {
      const columns = guessCols[0].values.map(row => row[1]) // names are at index 1
      if (!columns.includes('guessed_country_code')) {
        this.db.run('ALTER TABLE guesses ADD COLUMN guessed_country_code TEXT')
      }
      if (!columns.includes('guessed_country_name')) {
        this.db.run('ALTER TABLE guesses ADD COLUMN guessed_country_name TEXT')
      }
      if (!columns.includes('time_ms')) {
        this.db.run('ALTER TABLE guesses ADD COLUMN time_ms INTEGER')
      }
    }

    const runsCols = this.db.exec('PRAGMA table_info(quiz_runs)')
    if (runsCols.length > 0) {
      const columns = runsCols[0].values.map(row => row[1])
      if (!columns.includes('completed_fully')) {
        this.db.run('ALTER TABLE quiz_runs ADD COLUMN completed_fully INTEGER NOT NULL DEFAULT 1')
      }
    }
  }

  saveToLocalStorage() {
    if (!this.db) return

    try {
      const data = this.db.export()
      const arrayString = JSON.stringify(Array.from(data))
      localStorage.setItem('quiz_database', arrayString)
    } catch (error) {
      console.error('Failed to save database to localStorage:', error)
    }
  }

  recordGuess(countryCode, displayName, quizType, guessType, guessedCode = null, guessedName = null, timeMs = null) {
    if (!this.db) {
      console.error('Database not initialized')
      return
    }

    try {
      const timestamp = Date.now()
      this.db.run(
        `INSERT INTO guesses (country_code, country_display_name, quiz_type, guess_type, guessed_country_code, guessed_country_name, time_ms, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [countryCode, displayName, quizType, guessType, guessedCode, guessedName, timeMs, timestamp]
      )
      this.saveToLocalStorage()
    } catch (error) {
      console.error('Failed to record guess:', error)
    }
  }

  getCountryStats(countryCode) {
    if (!this.db) return null

    try {
      const stmt = this.db.prepare(`
        SELECT
          guess_type,
          COUNT(*) as count
        FROM guesses
        WHERE country_code = ?
        GROUP BY guess_type
      `)
      stmt.bind([countryCode])

      const stats = { correct: 0, shaky: 0, incorrect: 0 }
      while (stmt.step()) {
        const row = stmt.getAsObject()
        stats[row.guess_type] = row.count
      }
      stmt.free()

      return stats
    } catch (error) {
      console.error('Failed to get country stats:', error)
      return null
    }
  }

  getAllGuesses(limit = 100) {
    if (!this.db) return []

    try {
      const stmt = this.db.prepare(`
        SELECT *
        FROM guesses
        ORDER BY timestamp DESC
        LIMIT ?
      `)
      stmt.bind([limit])

      const results = []
      while (stmt.step()) {
        results.push(stmt.getAsObject())
      }
      stmt.free()

      return results
    } catch (error) {
      console.error('Failed to get guesses:', error)
      return []
    }
  }

  getQuizTypeStats(quizType) {
    if (!this.db) return null

    try {
      const stmt = this.db.prepare(`
        SELECT
          guess_type,
          COUNT(*) as count
        FROM guesses
        WHERE quiz_type = ?
        GROUP BY guess_type
      `)
      stmt.bind([quizType])

      const stats = { correct: 0, shaky: 0, incorrect: 0 }
      while (stmt.step()) {
        const row = stmt.getAsObject()
        stats[row.guess_type] = row.count
      }
      stmt.free()

      return stats
    } catch (error) {
      console.error('Failed to get quiz type stats:', error)
      return null
    }
  }

  // Full reset: drop the database and rebuild it from scratch by re-running all
  // migrations, exactly like a first-time install. Wipes guesses, runs and
  // settings.
  clearAllData() {
    if (!this.SQL) {
      console.error('Database not initialized')
      return
    }

    try {
      if (this.db) this.db.close()
      this.db = new this.SQL.Database()
      this.runMigrations()
      this.saveToLocalStorage()
    } catch (error) {
      console.error('Failed to clear data:', error)
    }
  }

  exportData() {
    if (!this.db) return null

    try {
      const stmt = this.db.prepare('SELECT * FROM guesses ORDER BY timestamp')
      const results = []
      while (stmt.step()) {
        results.push(stmt.getAsObject())
      }
      stmt.free()
      return results
    } catch (error) {
      console.error('Failed to export data:', error)
      return null
    }
  }

  recordQuizRun(quizType, region, correctCount, shakyCount, incorrectCount, timeMs, completedFully = 1) {
    if (!this.db) {
      console.error('Database not initialized')
      return
    }

    try {
      const timestamp = Date.now()
      this.db.run(
        `INSERT INTO quiz_runs (quiz_type, region, correct_count, shaky_count, incorrect_count, time_ms, completed_fully, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [quizType, region, correctCount, shakyCount, incorrectCount, timeMs, completedFully, timestamp]
      )
      this.saveToLocalStorage()
    } catch (error) {
      console.error('Failed to record quiz run:', error)
    }
  }

  getAllQuizRuns(limit = 50) {
    if (!this.db) return []

    try {
      const stmt = this.db.prepare(`
        SELECT *
        FROM quiz_runs
        ORDER BY timestamp DESC
        LIMIT ?
      `)
      stmt.bind([limit])

      const results = []
      while (stmt.step()) {
        results.push(stmt.getAsObject())
      }
      stmt.free()

      return results
    } catch (error) {
      console.error('Failed to get quiz runs:', error)
      return []
    }
  }

  getWorstCountries(limit = 20) {
    if (!this.db) return []

    try {
      const stmt = this.db.prepare(`
        SELECT
          country_code,
          country_display_name,
          COUNT(*) as total_guesses,
          SUM(CASE WHEN guess_type = 'incorrect' THEN 1 ELSE 0 END) as incorrect_count,
          SUM(CASE WHEN guess_type = 'shaky' THEN 1 ELSE 0 END) as shaky_count,
          SUM(CASE WHEN guess_type = 'correct' THEN 1 ELSE 0 END) as correct_count
        FROM guesses
        GROUP BY country_code, country_display_name
        HAVING incorrect_count > 0
        ORDER BY incorrect_count DESC, shaky_count DESC
        LIMIT ?
      `)
      stmt.bind([limit])

      const results = []
      while (stmt.step()) {
        results.push(stmt.getAsObject())
      }
      stmt.free()

      return results
    } catch (error) {
      console.error('Failed to get worst countries:', error)
      return []
    }
  }

  getSlowestCountries(limit = 20) {
    if (!this.db) return []

    try {
      const stmt = this.db.prepare(`
        SELECT
          country_code,
          country_display_name,
          AVG(time_ms) as avg_time_ms,
          COUNT(*) as guess_count,
          MIN(time_ms) as best_time_ms,
          MAX(time_ms) as worst_time_ms
        FROM guesses
        WHERE time_ms IS NOT NULL AND time_ms > 0
        GROUP BY country_code, country_display_name
        HAVING guess_count >= 1
        ORDER BY avg_time_ms DESC
        LIMIT ?
      `)
      stmt.bind([limit])

      const results = []
      while (stmt.step()) {
        results.push(stmt.getAsObject())
      }
      stmt.free()

      return results
    } catch (error) {
      console.error('Failed to get slowest countries:', error)
      return []
    }
  }

  getWrongGuesses(limit = 50) {
    if (!this.db) return []

    try {
      const stmt = this.db.prepare(`
        SELECT
          country_code,
          country_display_name,
          guessed_country_code,
          guessed_country_name,
          quiz_type,
          time_ms,
          timestamp
        FROM guesses
        WHERE guessed_country_code IS NOT NULL AND guessed_country_code != country_code
        ORDER BY timestamp DESC
        LIMIT ?
      `)
      stmt.bind([limit])

      const results = []
      while (stmt.step()) {
        results.push(stmt.getAsObject())
      }
      stmt.free()

      return results
    } catch (error) {
      console.error('Failed to get wrong guesses:', error)
      return []
    }
  }

  getSetting(key) {
    if (!this.db) return null

    try {
      const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?')
      stmt.bind([key])

      let value = null
      if (stmt.step()) {
        value = stmt.getAsObject().value
      }
      stmt.free()

      return value
    } catch (error) {
      console.error('Failed to get setting:', error)
      return null
    }
  }

  setSetting(key, value) {
    if (!this.db) {
      console.error('Database not initialized')
      return
    }

    try {
      this.db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value]
      )
      this.saveToLocalStorage()
    } catch (error) {
      console.error('Failed to set setting:', error)
    }
  }

  getAllSettings() {
    if (!this.db) return {}

    try {
      const stmt = this.db.prepare('SELECT key, value FROM settings')
      const settings = {}
      while (stmt.step()) {
        const row = stmt.getAsObject()
        settings[row.key] = row.value
      }
      stmt.free()
      return settings
    } catch (error) {
      console.error('Failed to get settings:', error)
      return {}
    }
  }
}

// Create a singleton instance
export const quizDb = new QuizDatabase()
