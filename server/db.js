import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const defaultDatabasePath = join(currentDirectory, 'data', 'shuttle.db');

const schema = `
  CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    bus_number TEXT,
    status TEXT NOT NULL DEFAULT 'idle'
      CHECK (status IN ('idle', 'busy'))
  );

  CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER NOT NULL,
    driver_id INTEGER,
    student_name TEXT,
    status TEXT NOT NULL DEFAULT 'waiting'
      CHECK (status IN ('waiting', 'accepted', 'arrived', 'cancelled')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    arrived_at DATETIME,
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (driver_id) REFERENCES drivers(id)
  );
`;

function runMigrations(db) {
  const callColumns = db.pragma('table_info(calls)');
  const hasDriverId = callColumns.some((column) => column.name === 'driver_id');

  if (!hasDriverId) {
    db.exec(`
      ALTER TABLE calls
      ADD COLUMN driver_id INTEGER REFERENCES drivers(id)
    `);
  }
}

export function initializeDatabase(databasePath = process.env.DATABASE_PATH || defaultDatabasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });

  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schema);
  runMigrations(db);

  return db;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const db = initializeDatabase();
  db.close();
  console.log(`SQLite database initialized at ${process.env.DATABASE_PATH || defaultDatabasePath}`);
}
