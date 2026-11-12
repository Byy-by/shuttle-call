import express from 'express';
import { initializeDatabase } from './db.js';
import apiRouter from './routes.js';

const PORT = Number(process.env.PORT) || 3001;

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

const server = app.listen(PORT, () => {
  console.log(`Shuttle Call server listening on http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
