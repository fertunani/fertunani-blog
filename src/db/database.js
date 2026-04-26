require('dotenv').config()
const path = require('path')
const fs = require('fs')

function makeSQLitePool() {
  const sqlite3 = require('sqlite3').verbose()
  const DB_PATH = path.join(__dirname, '../../blog.db')
  const sqlite = new sqlite3.Database(DB_PATH)

  sqlite.serialize(() => {
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        published INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `)
  })

  return {
    execute: (sql, params = []) => new Promise((resolve, reject) => {
      const isRead = /^(SELECT|SHOW|CREATE)/i.test(sql.trim())
      if (isRead) {
        sqlite.all(sql, params, (err, rows) => err ? reject(err) : resolve([rows]))
      } else {
        sqlite.run(sql, params, function (err) {
          if (err) reject(err)
          else resolve([{ insertId: this.lastID, affectedRows: this.changes }])
        })
      }
    })
  }
}

async function makeMySQLPool(connectionString) {
  const mysql = require('mysql2/promise')
  const url = new URL(connectionString.trim())

  const caPath = path.join(__dirname, '../../certs/ca-certificate.crt')
  const ssl = fs.existsSync(caPath)
    ? { ca: fs.readFileSync(caPath) }
    : { rejectUnauthorized: false }

  // Conecta sem database para criar se não existir
  const tempConn = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: url.username,
    password: url.password,
    ssl,
  })

  await tempConn.execute('CREATE DATABASE IF NOT EXISTS blog')
  await tempConn.end()

  // Pool com database definido
  const pool = mysql.createPool({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: 'blog',
    ssl,
    waitForConnections: true,
    connectionLimit: 10,
  })

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      content LONGTEXT NOT NULL,
      published TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT (UTC_TIMESTAMP())
    )
  `)

  console.log('MySQL conectado e tabela pronta.')
  return pool
}

let dbPromise

if (process.env.BANCO_DE_DADOS) {
  dbPromise = makeMySQLPool(process.env.BANCO_DE_DADOS).catch(err => {
    console.error('Erro ao conectar no MySQL:', err.message)
    process.exit(1)
  })
} else {
  dbPromise = Promise.resolve(makeSQLitePool())
}

// Proxy que aguarda a conexão antes de executar qualquer query
module.exports = {
  execute: async (sql, params) => {
    const db = await dbPromise
    return db.execute(sql, params)
  }
}
