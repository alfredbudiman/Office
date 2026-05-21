// Jalankan file SQL ke DB. Pakai: node --env-file=.env.local scripts/db-migrate.mjs supabase/migrations/0002_videos.sql
import { readFileSync } from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) { console.error("Beri path file SQL."); process.exit(1); }
const conn = process.env.DATABASE_URL;
if (!conn) { console.error("DATABASE_URL kosong di .env.local"); process.exit(1); }

const sql = readFileSync(file, "utf8");
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("OK: migrasi diterapkan:", file);
} catch (e) {
  console.error("MIGRASI GAGAL:", e.message);
  process.exitCode = 2;
} finally {
  await client.end();
}
