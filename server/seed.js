import { initializeDatabase } from './db.js';

const mockStations = [
  {
    name: '五号门',
    description: '学校西侧主要出入口，也是校车常用停靠点',
  },
  {
    name: '橘园',
    description: '橘园生活区附近的校车乘车点',
  },
  {
    name: '梅园',
    description: '梅园学生公寓旁的候车区域',
  },
  {
    name: '八教',
    description: '第八教学楼门前的临时停靠点',
  },
  {
    name: '中心图书馆',
    description: '校园中心图书馆南侧乘车点',
  },
  {
    name: '楠园',
    description: '楠园宿舍区入口旁的候车点',
  },
  {
    name: '二号门',
    description: '学校东侧二号门内的校车停靠区',
  },
  {
    name: '一号门',
    description: '学校正门附近的学生乘车点',
  },
  {
    name: '田家炳',
    description: '田家炳教学楼前的候车区域',
  },
  {
    name: '后山竹园',
    description: '后山竹园步道入口附近的停靠点',
  },
];

const legacyStationRenames = [
  ['北门', '五号门'],
  ['图书馆', '橘园'],
  ['南苑宿舍', '梅园'],
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
    stationName: '五号门',
    studentName: '李明',
    destination: '八教',
    status: 'waiting',
    passengerCount: 2,
  },
  {
    stationName: '橘园',
    studentName: '王芳',
    destination: '中心图书馆',
    status: 'accepted',
    passengerCount: 3,
  },
  {
    stationName: '梅园',
    studentName: '陈晨',
    destination: '一号门',
    status: 'arrived',
    passengerCount: 4,
  },
  {
    stationName: '五号门',
    studentName: '赵磊',
    destination: '后山竹园',
    status: 'cancelled',
    passengerCount: 1,
  },
];

const db = initializeDatabase();

try {
  const seedDatabase = db.transaction(() => {
    const findStation = db.prepare('SELECT id FROM stations WHERE name = ? LIMIT 1');
    const updateStation = db.prepare(`
      UPDATE stations
      SET name = ?, description = ?
      WHERE id = ?
    `);
    const reassignCalls = db.prepare(`
      UPDATE calls
      SET station_id = ?
      WHERE station_id = ?
    `);
    const deleteStation = db.prepare('DELETE FROM stations WHERE id = ?');
    const insertStation = db.prepare(`
      INSERT INTO stations (name, description)
      SELECT ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM stations WHERE name = ?
      )
    `);

    const stationByName = new Map(
      mockStations.map((station) => [station.name, station]),
    );

    for (const [legacyName, newName] of legacyStationRenames) {
      const legacyStation = findStation.get(legacyName);

      if (!legacyStation) {
        continue;
      }

      const targetStation = findStation.get(newName);

      if (targetStation && targetStation.id !== legacyStation.id) {
        reassignCalls.run(targetStation.id, legacyStation.id);
        deleteStation.run(legacyStation.id);
      } else {
        updateStation.run(
          newName,
          stationByName.get(newName).description,
          legacyStation.id,
        );
      }
    }

    for (const station of mockStations) {
      const existingStation = findStation.get(station.name);

      if (existingStation) {
        updateStation.run(
          station.name,
          station.description,
          existingStation.id,
        );
      } else {
        insertStation.run(station.name, station.description, station.name);
      }
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
        destination,
        passenger_count,
        status,
        accepted_at,
        arrived_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?
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
        call.destination,
        call.passengerCount,
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
