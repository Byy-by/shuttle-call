import { Router } from 'express';

const router = Router();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendRouteError(error, response, next) {
  if (error instanceof HttpError) {
    return response.status(error.status).json({ error: error.message });
  }

  next(error);
}

router.get('/stations', (request, response, next) => {
  try {
    const stations = request.app.locals.db
      .prepare(`
        SELECT id, name, description
        FROM stations
        ORDER BY id
      `)
      .all();

    response.json(stations);
  } catch (error) {
    next(error);
  }
});

router.get('/calls/pending', (request, response, next) => {
  try {
    const calls = request.app.locals.db
      .prepare(`
        SELECT
          calls.id,
          calls.station_id,
          stations.name AS station_name,
          calls.student_name,
          calls.status,
          calls.created_at
        FROM calls
        JOIN stations ON stations.id = calls.station_id
        WHERE calls.status = 'waiting'
        ORDER BY calls.created_at ASC, calls.id ASC
      `)
      .all();

    response.json(calls);
  } catch (error) {
    next(error);
  }
});

router.post('/calls', (request, response, next) => {
  const stationId = Number(request.body?.station_id);
  const studentName =
    typeof request.body?.student_name === 'string'
      ? request.body.student_name.trim()
      : '';

  if (!Number.isInteger(stationId) || stationId <= 0 || !studentName) {
    return response.status(400).json({
      error: 'station_id and student_name are required',
    });
  }

  try {
    const db = request.app.locals.db;
    const station = db
      .prepare('SELECT id FROM stations WHERE id = ?')
      .get(stationId);

    if (!station) {
      return response.status(400).json({
        error: 'station_id does not reference an existing station',
      });
    }

    const result = db
      .prepare(`
        INSERT INTO calls (station_id, student_name, status)
        VALUES (?, ?, 'waiting')
      `)
      .run(stationId, studentName);

    const call = db
      .prepare(`
        SELECT
          id,
          station_id,
          student_name,
          status,
          created_at,
          accepted_at,
          arrived_at
        FROM calls
        WHERE id = ?
      `)
      .get(result.lastInsertRowid);

    response.status(201).json(call);
  } catch (error) {
    next(error);
  }
});

router.patch('/calls/:id/accept', (request, response, next) => {
  const callId = Number(request.params.id);
  const driverId = Number(request.body?.driver_id);

  if (!Number.isInteger(callId) || callId <= 0 || !Number.isInteger(driverId) || driverId <= 0) {
    return response.status(400).json({
      error: 'A valid call id and driver_id are required',
    });
  }

  try {
    const db = request.app.locals.db;
    const acceptCall = db.transaction(() => {
      const call = db
        .prepare(`
          SELECT
            calls.id,
            calls.status,
            calls.station_id,
            stations.name AS station_name
          FROM calls
          JOIN stations ON stations.id = calls.station_id
          WHERE calls.id = ?
        `)
        .get(callId);

      if (!call) {
        throw new HttpError(404, 'Call not found');
      }

      if (call.status !== 'waiting') {
        throw new HttpError(409, 'Call is not waiting');
      }

      const driver = db
        .prepare('SELECT id, name, bus_number, status FROM drivers WHERE id = ?')
        .get(driverId);

      if (!driver) {
        throw new HttpError(404, 'Driver not found');
      }

      if (driver.status !== 'idle') {
        throw new HttpError(409, 'Driver is not idle');
      }

      const callResult = db
        .prepare(`
          UPDATE calls
          SET status = 'accepted',
              driver_id = ?,
              accepted_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'waiting'
        `)
        .run(driverId, callId);
      const driverResult = db
        .prepare(`
          UPDATE drivers
          SET status = 'busy'
          WHERE id = ? AND status = 'idle'
        `)
        .run(driverId);

      if (callResult.changes !== 1 || driverResult.changes !== 1) {
        throw new HttpError(409, 'Call or driver state changed');
      }

      return {
        call: db
          .prepare(`
            SELECT
              id,
              station_id,
              driver_id,
              student_name,
              status,
              created_at,
              accepted_at,
              arrived_at
            FROM calls
            WHERE id = ?
          `)
          .get(callId),
        driver: db
          .prepare('SELECT id, name, bus_number, status FROM drivers WHERE id = ?')
          .get(driverId),
      };
    });

    response.json(acceptCall());
  } catch (error) {
    sendRouteError(error, response, next);
  }
});

router.patch('/calls/:id/arrive', (request, response, next) => {
  const callId = Number(request.params.id);
  const driverId = Number(request.body?.driver_id);

  if (!Number.isInteger(callId) || callId <= 0 || !Number.isInteger(driverId) || driverId <= 0) {
    return response.status(400).json({
      error: 'A valid call id and driver_id are required',
    });
  }

  try {
    const db = request.app.locals.db;
    const arriveCall = db.transaction(() => {
      const call = db
        .prepare('SELECT id, status, driver_id FROM calls WHERE id = ?')
        .get(callId);

      if (!call) {
        throw new HttpError(404, 'Call not found');
      }

      if (call.status !== 'accepted') {
        throw new HttpError(409, 'Call is not accepted');
      }

      if (call.driver_id !== driverId) {
        throw new HttpError(409, 'Call is assigned to a different driver');
      }

      const driver = db
        .prepare('SELECT id FROM drivers WHERE id = ?')
        .get(driverId);

      if (!driver) {
        throw new HttpError(404, 'Driver not found');
      }

      const callResult = db
        .prepare(`
          UPDATE calls
          SET status = 'arrived',
              arrived_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'accepted' AND driver_id = ?
        `)
        .run(callId, driverId);
      const driverResult = db
        .prepare('UPDATE drivers SET status = ? WHERE id = ?')
        .run('idle', driverId);

      if (callResult.changes !== 1 || driverResult.changes !== 1) {
        throw new HttpError(409, 'Call or driver state changed');
      }

      return {
        call: db
          .prepare(`
            SELECT
              id,
              station_id,
              driver_id,
              student_name,
              status,
              created_at,
              accepted_at,
              arrived_at
            FROM calls
            WHERE id = ?
          `)
          .get(callId),
        driver: db
          .prepare('SELECT id, name, bus_number, status FROM drivers WHERE id = ?')
          .get(driverId),
      };
    });

    response.json(arriveCall());
  } catch (error) {
    sendRouteError(error, response, next);
  }
});

export default router;
