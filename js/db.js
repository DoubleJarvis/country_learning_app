// Client-side SQLite database using SQL.js
// Manages quiz guess history

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

      // Try to load existing database from localStorage
      const savedDb = localStorage.getItem('quiz_database')
      if (savedDb) {
        const uint8Array = new Uint8Array(JSON.parse(savedDb))
        this.db = new this.SQL.Database(uint8Array)
      } else {
        this.db = new this.SQL.Database()
      }

      // Create tables if they don't exist
      this.db.run(`
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

      this.db.run(`
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

      // Key/value store for user-toggleable features and settings
      this.db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `)

      // Handle schema migrations for existing databases
      this.migrateSchema()

      // Create indexes for faster queries
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_country_code ON guesses(country_code)
      `)
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_quiz_type ON guesses(quiz_type)
      `)
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_timestamp ON guesses(timestamp)
      `)
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON quiz_runs(timestamp)
      `)

      this.initialized = true
      this.saveToLocalStorage()
    } catch (error) {
      console.error('Failed to initialize database:', error)
    }
  }

  migrateSchema() {
    if (!this.db) return

    try {
      // Check if guesses table has the new columns
      const tableInfo = this.db.exec("PRAGMA table_info(guesses)")

      if (tableInfo.length > 0) {
        const columns = tableInfo[0].values.map(row => row[1]) // column names are at index 1

        // Add guessed_country_code if it doesn't exist
        if (!columns.includes('guessed_country_code')) {
          console.log('Migrating: Adding guessed_country_code column')
          this.db.run('ALTER TABLE guesses ADD COLUMN guessed_country_code TEXT')
        }

        // Add guessed_country_name if it doesn't exist
        if (!columns.includes('guessed_country_name')) {
          console.log('Migrating: Adding guessed_country_name column')
          this.db.run('ALTER TABLE guesses ADD COLUMN guessed_country_name TEXT')
        }

        // Add time_ms if it doesn't exist
        if (!columns.includes('time_ms')) {
          console.log('Migrating: Adding time_ms column')
          this.db.run('ALTER TABLE guesses ADD COLUMN time_ms INTEGER')
        }
      }

      // Check if quiz_runs table has the new columns
      const runsTableInfo = this.db.exec("PRAGMA table_info(quiz_runs)")

      if (runsTableInfo.length > 0) {
        const runsColumns = runsTableInfo[0].values.map(row => row[1])

        // Add completed_fully if it doesn't exist
        if (!runsColumns.includes('completed_fully')) {
          console.log('Migrating: Adding completed_fully column')
          this.db.run('ALTER TABLE quiz_runs ADD COLUMN completed_fully INTEGER NOT NULL DEFAULT 1')
        }
      }
    } catch (error) {
      console.error('Failed to migrate schema:', error)
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

  clearAllData() {
    if (!this.db) return

    try {
      this.db.run('DELETE FROM guesses')
      this.db.run('DELETE FROM quiz_runs')
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
