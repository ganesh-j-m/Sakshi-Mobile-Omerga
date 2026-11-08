import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/index.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Sakshi Mobile API running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down gracefully`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
