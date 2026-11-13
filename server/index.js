import express from 'express';
import { initializeDatabase } from './db.js';
import apiRouter, { completeExpiredTrips } from './routes.js';

const PORT = Number(process.env.PORT) || 3001;
const ARRIVAL_CHECK_INTERVAL_MS = 5000;

const app = express();
const db = initializeDatabase();

app.locals.db = db;
app.use(express.json());
app.use('/api', apiRouter);

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'shuttle-call-server',
  });
});

function updateExpiredTrips() {
  try {
    const completedCount = completeExpiredTrips(db);

    if (completedCount > 0) {
      console.log(`Completed ${completedCount} expired trip(s).`);
    }
  } catch (error) {
    console.error('Failed to complete expired trips:', error);
  }
}

updateExpiredTrips();
const arrivalTimer = setInterval(updateExpiredTrips, ARRIVAL_CHECK_INTERVAL_MS);

const server = app.listen(PORT, () => {
  console.log(`Shuttle Call server listening on http://localhost:${PORT}`);
});

function shutdown() {
  clearInterval(arrivalTimer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
