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
    destination TEXT NOT NULL,
    passenger_count INTEGER NOT NULL DEFAULT 1
      CHECK (passenger_count BETWEEN 1 AND 5),
    status TEXT NOT NULL DEFAULT 'waiting'
      CHECK (status IN ('waiting', 'scheduled', 'accepted', 'en_route', 'arrived', 'cancelled')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scheduled_time TEXT,
    accepted_at DATETIME,
    departed_at DATETIME,
    arrived_at DATETIME,
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (driver_id) REFERENCES drivers(id)
  );
`;

function runMigrations(db) {
  const callColumns = db.pragma('table_info(calls)');
  const hasDriverId = callColumns.some((column) => column.name === 'driver_id');
  const hasPassengerCount = callColumns.some(
    (column) => column.name === 'passenger_count',
  );
  const hasDestination = callColumns.some(
    (column) => column.name === 'destination',
  );
  const hasScheduledTime = callColumns.some(
    (column) => column.name === 'scheduled_time',
  );
  const hasDepartedAt = callColumns.some(
    (column) => column.name === 'departed_at',
  );

  if (!hasDriverId) {
    db.exec(`
      ALTER TABLE calls
      ADD COLUMN driver_id INTEGER REFERENCES drivers(id)
    `);
  }

  if (!hasPassengerCount) {
    db.exec(`
      ALTER TABLE calls
      ADD COLUMN passenger_count INTEGER NOT NULL DEFAULT 1
        CHECK (passenger_count BETWEEN 1 AND 5)
    `);
  }

  if (!hasDestination) {
    db.exec(`
      ALTER TABLE calls
      ADD COLUMN destination TEXT NOT NULL DEFAULT '未填写目的地'
    `);
  }

  if (!hasScheduledTime) {
    db.exec(`
      ALTER TABLE calls
      ADD COLUMN scheduled_time TEXT
    `);
  }

  if (!hasDepartedAt) {
    db.exec(`
      ALTER TABLE calls
      ADD COLUMN departed_at DATETIME
    `);
  }

  const callsTable = db
    .prepare(`
      SELECT sql
      FROM sqlite_master
      WHERE type = 'table' AND name = 'calls'
    `)
    .get();

  if (callsTable && !callsTable.sql.includes("'en_route'")) {
    const migrateCallStatuses = db.transaction(() => {
      db.exec(`
        ALTER TABLE calls RENAME TO calls_legacy;

        CREATE TABLE calls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          station_id INTEGER NOT NULL,
          driver_id INTEGER,
          student_name TEXT,
          destination TEXT NOT NULL,
          passenger_count INTEGER NOT NULL DEFAULT 1
            CHECK (passenger_count BETWEEN 1 AND 5),
          status TEXT NOT NULL DEFAULT 'waiting'
            CHECK (status IN ('waiting', 'scheduled', 'accepted', 'en_route', 'arrived', 'cancelled')),
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          scheduled_time TEXT,
          accepted_at DATETIME,
          departed_at DATETIME,
          arrived_at DATETIME,
          FOREIGN KEY (station_id) REFERENCES stations(id),
          FOREIGN KEY (driver_id) REFERENCES drivers(id)
        );

        INSERT INTO calls (
          id,
          station_id,
          driver_id,
          student_name,
          destination,
          passenger_count,
          status,
          created_at,
          scheduled_time,
          accepted_at,
          departed_at,
          arrived_at
        )
        SELECT
          id,
          station_id,
          driver_id,
          student_name,
          destination,
          passenger_count,
          status,
          created_at,
          scheduled_time,
          accepted_at,
          departed_at,
          arrived_at
        FROM calls_legacy;

        DROP TABLE calls_legacy;
      `);
    });

    migrateCallStatuses();
  }

  db.prepare(`
    UPDATE calls
    SET status = 'scheduled'
    WHERE status = 'waiting' AND scheduled_time IS NOT NULL
  `).run();
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
