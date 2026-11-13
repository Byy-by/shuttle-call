import { Router } from 'express';

const router = Router();
const AUTO_ARRIVAL_MINUTES = 3;

class HttpError extends Error {
  constructor(status, message, code = undefined) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendRouteError(error, response, next) {
  if (error instanceof HttpError) {
    return response.status(error.status).json({
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
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
          calls.destination,
          calls.passenger_count,
          calls.scheduled_time,
          calls.status,
          calls.created_at
        FROM calls
        JOIN stations ON stations.id = calls.station_id
        WHERE calls.status IN ('waiting', 'scheduled')
          AND (
            calls.scheduled_time IS NULL
            OR julianday(calls.scheduled_time) <
              julianday('now', '+15 minutes')
          )
        ORDER BY calls.created_at ASC, calls.id ASC
      `)
      .all();

    response.json(calls);
  } catch (error) {
    next(error);
  }
});

router.get('/calls/scheduled', (request, response, next) => {
  try {
    const calls = request.app.locals.db
      .prepare(`
        SELECT
          calls.id,
          calls.station_id,
          stations.name AS station_name,
          calls.student_name,
          calls.destination,
          calls.passenger_count,
          calls.scheduled_time,
          calls.status,
          calls.created_at
        FROM calls
        JOIN stations ON stations.id = calls.station_id
        WHERE calls.status IN ('waiting', 'scheduled')
          AND calls.scheduled_time IS NOT NULL
          AND julianday(calls.scheduled_time) > julianday('now')
        ORDER BY julianday(calls.scheduled_time) ASC, calls.id ASC
      `)
      .all();

    response.json(calls);
  } catch (error) {
    next(error);
  }
});

router.get('/calls/mine', (request, response, next) => {
  const studentName =
    typeof request.query.student_name === 'string'
      ? request.query.student_name.trim()
      : '';

  if (!studentName) {
    return response.status(400).json({
      error: 'student_name is required',
    });
  }

  try {
    const calls = request.app.locals.db
      .prepare(`
        SELECT
          calls.id,
          calls.station_id,
          stations.name AS station_name,
          calls.student_name,
          calls.destination,
          calls.passenger_count,
          calls.scheduled_time,
          calls.status,
          calls.created_at,
          calls.accepted_at,
          calls.departed_at,
          calls.arrived_at,
          drivers.name AS driver_name,
          drivers.bus_number,
          drivers.status AS driver_status
        FROM calls
        JOIN stations ON stations.id = calls.station_id
        LEFT JOIN drivers ON drivers.id = calls.driver_id
        WHERE calls.student_name = ?
          AND calls.status IN (
            'waiting',
            'scheduled',
            'accepted',
            'en_route',
            'arrived'
          )
        ORDER BY calls.created_at DESC, calls.id DESC
      `)
      .all(studentName);

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
  const destination =
    typeof request.body?.destination === 'string'
      ? request.body.destination.trim()
      : '';
  const passengerCount =
    request.body?.passenger_count === undefined
      ? 1
      : Number(request.body.passenger_count);
  const requestedScheduledTime = request.body?.scheduled_time;
  let scheduledTime = null;

  if (
    requestedScheduledTime !== undefined &&
    requestedScheduledTime !== null &&
    requestedScheduledTime !== ''
  ) {
    if (typeof requestedScheduledTime !== 'string') {
      return response.status(400).json({
        error: 'scheduled_time must be an ISO date-time string',
      });
    }

    const scheduledDate = new Date(requestedScheduledTime);

    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      return response.status(400).json({
        error: 'scheduled_time must be a valid future date-time',
      });
    }

    scheduledTime = scheduledDate.toISOString();
  }

  if (
    !Number.isInteger(stationId) ||
    stationId <= 0 ||
    !studentName ||
    !destination ||
    !Number.isInteger(passengerCount) ||
    passengerCount < 1 ||
    passengerCount > 5
  ) {
    return response.status(400).json({
      error: 'station_id, student_name, destination and passenger_count (1-5) are required',
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

    const createCall = db.transaction(() => {
      if (scheduledTime === null) {
        const duplicateCall = db
          .prepare(`
            SELECT id
            FROM calls
            WHERE station_id = ?
              AND student_name = ?
              AND status = 'waiting'
              AND scheduled_time IS NULL
            LIMIT 1
          `)
          .get(stationId, studentName);

        if (duplicateCall) {
          throw new HttpError(409, 'An identical immediate call is already waiting');
        }
      }

      const result = db
        .prepare(`
          INSERT INTO calls (
            station_id,
            student_name,
            destination,
            passenger_count,
            scheduled_time,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          stationId,
          studentName,
          destination,
          passengerCount,
          scheduledTime,
          scheduledTime ? 'scheduled' : 'waiting',
        );

      return db
        .prepare(`
          SELECT
            id,
            station_id,
            student_name,
            destination,
            passenger_count,
            scheduled_time,
            status,
            created_at,
            accepted_at,
            departed_at,
            arrived_at
          FROM calls
          WHERE id = ?
        `)
        .get(result.lastInsertRowid);
    });

    const call = createCall();

    response.status(201).json(call);
  } catch (error) {
    sendRouteError(error, response, next);
  }
});

router.patch('/calls/:id/cancel', (request, response, next) => {
  const callId = Number(request.params.id);
  const studentName =
    typeof request.body?.student_name === 'string'
      ? request.body.student_name.trim()
      : '';

  if (!Number.isInteger(callId) || callId <= 0 || !studentName) {
    return response.status(400).json({
      error: 'A valid call id and student_name are required',
    });
  }

  try {
    const db = request.app.locals.db;
    const cancelCall = db.transaction(() => {
      const call = db
        .prepare(`
          SELECT id, student_name, status, scheduled_time
          FROM calls
          WHERE id = ?
        `)
        .get(callId);

      if (!call) {
        throw new HttpError(404, 'Call not found');
      }

      if (call.student_name !== studentName) {
        throw new HttpError(403, 'Call does not belong to this student');
      }

      if (!['waiting', 'scheduled'].includes(call.status)) {
        throw new HttpError(409, 'Call cannot be cancelled');
      }

      if (call.scheduled_time) {
        const scheduledAt = new Date(call.scheduled_time).getTime();
        const millisecondsUntilPickup = scheduledAt - Date.now();

        if (
          Number.isNaN(scheduledAt) ||
          millisecondsUntilPickup < 5 * 60 * 1000
        ) {
          throw new HttpError(
            409,
            '车辆已派发，无法取消',
            'CANCELLATION_LOCKED',
          );
        }
      }

      const result = db
        .prepare(`
          UPDATE calls
          SET status = 'cancelled'
          WHERE id = ? AND status IN ('waiting', 'scheduled')
        `)
        .run(callId);

      if (result.changes !== 1) {
        throw new HttpError(409, 'Call cannot be cancelled');
      }

      return db
        .prepare(`
          SELECT
            id,
            station_id,
            student_name,
            destination,
            passenger_count,
            scheduled_time,
            status,
            created_at,
            accepted_at,
            arrived_at
          FROM calls
          WHERE id = ?
        `)
        .get(callId);
    });

    response.json(cancelCall());
  } catch (error) {
    sendRouteError(error, response, next);
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

      if (!['waiting', 'scheduled'].includes(call.status)) {
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
          WHERE id = ? AND status IN ('waiting', 'scheduled')
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
              destination,
              passenger_count,
              scheduled_time,
              status,
              created_at,
              accepted_at,
              departed_at,
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

router.patch('/calls/:id/depart', (request, response, next) => {
  const callId = Number(request.params.id);
  const driverId = Number(request.body?.driver_id);

  if (!Number.isInteger(callId) || callId <= 0 || !Number.isInteger(driverId) || driverId <= 0) {
    return response.status(400).json({
      error: 'A valid call id and driver_id are required',
    });
  }

  try {
    const db = request.app.locals.db;
    const departCall = db.transaction(() => {
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

      const result = db
        .prepare(`
          UPDATE calls
          SET status = 'en_route',
              departed_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'accepted' AND driver_id = ?
        `)
        .run(callId, driverId);

      if (result.changes !== 1) {
        throw new HttpError(409, 'Call state changed');
      }

      return {
        call: db
          .prepare(`
            SELECT
              id,
              station_id,
              driver_id,
              student_name,
              destination,
              passenger_count,
              scheduled_time,
              status,
              created_at,
              accepted_at,
              departed_at,
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

    response.json(departCall());
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
              destination,
              passenger_count,
              scheduled_time,
              status,
              created_at,
              accepted_at,
              departed_at,
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

export function completeExpiredTrips(db) {
  const completeTrips = db.transaction(() => {
    const expiredCalls = db
      .prepare(`
        SELECT id, driver_id
        FROM calls
        WHERE status = 'en_route'
          AND departed_at IS NOT NULL
          AND julianday(departed_at) <= julianday('now', ?)
      `)
      .all(`-${AUTO_ARRIVAL_MINUTES} minutes`);

    for (const call of expiredCalls) {
      const callResult = db
        .prepare(`
          UPDATE calls
          SET status = 'arrived',
              arrived_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'en_route'
        `)
        .run(call.id);

      if (callResult.changes === 1 && call.driver_id) {
        db.prepare('UPDATE drivers SET status = ? WHERE id = ?').run(
          'idle',
          call.driver_id,
        );
      }
    }

    return expiredCalls.length;
  });

  return completeTrips();
}

export default router;
