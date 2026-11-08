# Database backup & restore

## From the dashboard
**Super Admin → Database Backups → Create backup now.** Files are written to `BACKUP_DIR`
(`/data/backups` in Docker) in PostgreSQL *custom* format and can be downloaded from the same page.
Only the newest `BACKUP_RETENTION` files (default 14) are kept.

> `pg_dump` must be installed on the server and match the PostgreSQL major version
> (the Docker image ships `postgresql16-client`).

## Automatic daily backups (cron)
```bash
# Docker
0 2 * * * docker compose -f /srv/sakshi-mobile/docker-compose.yml exec -T app node dist/scripts/backup.js

# PM2 / plain VPS
0 2 * * * cd /srv/sakshi-mobile/server && /usr/bin/node dist/scripts/backup.js >> /var/log/sakshi-backup.log 2>&1
```

## Off-site copies (strongly recommended)
Backups on the same server are lost if the server is lost. Sync them daily, e.g.:
```bash
rclone copy /srv/sakshi-mobile/backups remote:sakshi-mobile-backups --max-age 48h
```
Managed Postgres (Neon, Supabase, RDS, Render) also provides point-in-time recovery — enable it.

## Restore
```bash
# 1. stop the app (prevents writes)
docker compose stop app
# 2. restore (drops & recreates objects)
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" sakshi-mobile-YYYYMMDD-HHMMSS.dump
# 3. start again
docker compose start app
```
Test a restore into a scratch database every few months:
`createdb sakshi_restore_test && pg_restore --no-owner -d sakshi_restore_test file.dump`.

## Images
Product images live in Cloudinary (back up via Cloudinary's backup add-on) or, without Cloudinary,
in `UPLOAD_DIR` — include that folder in your file backups.
