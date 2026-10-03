import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

if (process.env.NERVA_ALLOW_DISPOSABLE_DATABASE !== 'true')
  throw new Error(
    'Set NERVA_ALLOW_DISPOSABLE_DATABASE=true only for a disposable CI PostgreSQL instance',
  );
const sourceUrl = new URL(process.env.DATABASE_URL ?? '');
if (!['postgres:', 'postgresql:'].includes(sourceUrl.protocol))
  throw new Error('DATABASE_URL must be PostgreSQL');
const databaseName = `nerva_m02_upgrade_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
const targetUrl = new URL(sourceUrl);
targetUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({
  connectionString: adminUrl.toString(),
  connectionTimeoutMillis: 5_000,
});
let created = false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  const target = new pg.Client({
    connectionString: targetUrl.toString(),
    connectionTimeoutMillis: 5_000,
  });
  try {
    await target.connect();
    const root = process.cwd();
    for (const file of [
      'packages/db/migrations/0000_elite_tempest.sql',
      'packages/db/migrations/0001_useful_hobgoblin.sql',
    ]) {
      const sql = fs.readFileSync(path.join(root, file), 'utf8');
      await target.query(sql);
    }
    const tables = await target.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    );
    const evidence = await target.query(
      "SELECT to_regclass('public.market_snapshots') IS NOT NULL AS market, to_regclass('public.risk_snapshots') IS NOT NULL AS risk, to_regclass('public.provider_checkpoints') IS NOT NULL AS checkpoint",
    );
    const triggerCount = await target.query(
      "SELECT count(*)::int AS n FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('market_snapshots_append_only','position_snapshots_append_only','portfolio_snapshots_append_only','risk_snapshots_append_only','risk_metrics_append_only')",
    );
    if (
      tables.rows[0]?.n !== 11 ||
      !evidence.rows[0]?.market ||
      !evidence.rows[0]?.risk ||
      !evidence.rows[0]?.checkpoint ||
      triggerCount.rows[0]?.n !== 5
    )
      throw new Error(
        'The clean M01-to-M02 migration did not produce the expected tables and append-only triggers',
      );
    console.log(
      JSON.stringify({
        ok: true,
        migrationPath: ['M01 0000_elite_tempest.sql', 'M02 0001_useful_hobgoblin.sql'],
        tables: tables.rows[0].n,
        m02AppendOnlyTriggers: triggerCount.rows[0].n,
      }),
    );
  } finally {
    await target.end();
  }
} finally {
  if (created) {
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  }
  await admin.end();
}
