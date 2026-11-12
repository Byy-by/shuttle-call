import { initializeDatabase } from './db.js';

const mockStations = [
  {
    name: '北门',
    description: '靠近一号教学楼，早晚高峰乘车点',
  },
  {
    name: '图书馆',
    description: '图书馆西侧临时停靠点',
  },
  {
    name: '南苑宿舍',
    description: '南苑宿舍区入口',
  },
];

const mockDrivers = [
  {
    name: '张师傅',
    busNumber: 'BUS-01',
    status: 'idle',
  },
  {
    name: '李师傅',
    busNumber: 'BUS-02',
    status: 'busy',
  },
];

const mockCalls = [
  {
    stationName: '北门',
    studentName: '李明',
    status: 'waiting',
  },
  {
    stationName: '图书馆',
    studentName: '王芳',
    status: 'accepted',
  },
  {
    stationName: '南苑宿舍',
    studentName: '陈晨',
    status: 'arrived',
  },
  {
    stationName: '北门',
    studentName: '赵磊',
    status: 'cancelled',
  },
];

const db = initializeDatabase();

try {
  const seedDatabase = db.transaction(() => {
    const findStation = db.prepare('SELECT id FROM stations WHERE name = ? LIMIT 1');
    const insertStation = db.prepare(`
      INSERT INTO stations (name, description)
      SELECT ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM stations WHERE name = ?
      )
    `);

    for (const station of mockStations) {
      insertStation.run(station.name, station.description, station.name);
    }

    const insertDriver = db.prepare(`
      INSERT INTO drivers (name, bus_number, status)
      SELECT ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM drivers
        WHERE name = ? AND bus_number = ?
      )
    `);

    for (const driver of mockDrivers) {
      insertDriver.run(
        driver.name,
        driver.busNumber,
        driver.status,
        driver.name,
        driver.busNumber,
      );
    }

    const insertCall = db.prepare(`
      INSERT INTO calls (
        station_id,
        student_name,
        status,
        accepted_at,
        arrived_at
      )
      SELECT ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM calls
        WHERE station_id = ? AND student_name = ? AND status = ?
      )
    `);

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    for (const call of mockCalls) {
      const station = findStation.get(call.stationName);

      if (!station) {
        throw new Error(`Seed station not found: ${call.stationName}`);
      }

      const acceptedAt =
        call.status === 'accepted' || call.status === 'arrived' ? now : null;
      const arrivedAt = call.status === 'arrived' ? now : null;

      insertCall.run(
        station.id,
        call.studentName,
        call.status,
        acceptedAt,
        arrivedAt,
        station.id,
        call.studentName,
        call.status,
      );
    }

    return {
      stations: db.prepare('SELECT COUNT(*) AS count FROM stations').get().count,
      drivers: db.prepare('SELECT COUNT(*) AS count FROM drivers').get().count,
      calls: db.prepare('SELECT COUNT(*) AS count FROM calls').get().count,
    };
  });

  const counts = seedDatabase();

  console.log('Mock data seeded successfully.');
  console.log(
    `Current totals: ${counts.stations} stations, ${counts.drivers} drivers, ${counts.calls} calls.`,
  );
} catch (error) {
  console.error('Failed to seed mock data:', error);
  process.exitCode = 1;
} finally {
  db.close();
}
