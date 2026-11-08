/**
 * Command-line backup — use from cron / a scheduler:
 *   npm run backup            (development, via tsx)
 *   node dist/scripts/backup.js   (production)
 */
import { pool } from '../db/index.js';
import { createBackup } from '../routes/admin/system.js';

createBackup()
  .then(async (b) => {
    console.log(`✅ Backup created: ${b.name} (${(b.size / 1024).toFixed(1)} KB)`);
    await pool.end();
  })
  .catch(async (err) => {
    console.error('❌ Backup failed', err);
    await pool.end();
    process.exit(1);
  });
