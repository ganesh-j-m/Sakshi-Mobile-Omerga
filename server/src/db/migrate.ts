import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { env, maskUrl } from '../config/env.js';
import { db, pool } from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works from both src/db (tsx) and dist/db (compiled): migrations live in server/drizzle
const migrationsFolder = path.resolve(here, '../../drizzle');

async function main() {
  console.log(`⏳ Running migrations from ${migrationsFolder}`);
  console.log(`   Database: ${maskUrl(env.DATABASE_URL)}`);
  await migrate(db, { migrationsFolder });
  console.log('✅ Migrations complete');
  await pool.end();
}

main().catch(async (err) => {
  console.error('❌ Migration failed', err);
  await pool.end();
  process.exit(1);
});
