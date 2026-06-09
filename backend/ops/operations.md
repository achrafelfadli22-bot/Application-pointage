# Operations

## Monitoring

- Liveness: `GET /api/health/live`
- Readiness: `GET /api/health`
- Dependencies checked: PostgreSQL, Redis, MinIO
- Expected status: `ok` when all dependencies are up, `degraded` when at least one dependency is down

Recommended production checks:

- Ping `/api/health/live` every 30 seconds from the load balancer.
- Ping `/api/health` every 60 seconds from monitoring.
- Alert when `/api/health` returns `degraded` for 3 consecutive checks.
- Alert when API error rate is above 2 percent for 5 minutes.
- Alert when p95 API latency is above 1 second for 5 minutes.

## Logs

The API emits structured JSON logs for every HTTP request through `RequestLoggingInterceptor`.

Logged fields:

- `event`
- `method`
- `path`
- `statusCode`
- `durationMs`
- `userId`
- `tenantId`
- `role`
- `requestId`
- `userAgent`

Production recommendation:

- Forward stdout/stderr to the host log collector.
- Keep at least 30 days of API logs.
- Send `x-request-id` from the reverse proxy so frontend, API, and proxy logs can be correlated.

## Backups

Use `backend/ops/backup-postgres.ps1` for PostgreSQL logical backups.

Example:

```powershell
$env:DATABASE_URL="postgresql://user:password@host:5432/pointage360"
.\backend\ops\backup-postgres.ps1 -OutputDir "D:\backups\pointage360"
```

Recommended schedule:

- Daily full backup.
- Keep 7 daily backups, 4 weekly backups, and 12 monthly backups.
- Test restore monthly on a separate database.

Restore example:

```powershell
pg_restore --clean --if-exists --dbname "postgresql://user:password@host:5432/pointage360_restore" "D:\backups\pointage360\pointage360-YYYYMMDD-HHMMSS.dump"
```
