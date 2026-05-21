// Verifikasi RLS & clock in/out absensi. Jalankan:
//   node --experimental-websocket --env-file=.env.local scripts/verify-absensi.mjs
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, opts);
let fail = 0;
const check = (n, c, d) => { console.log(`${c ? "PASS" : "FAIL"}: ${n}${d ? " — " + d : ""}`); if (!c) fail++; };

const mk = async (role) => {
  const email = `t-abs-${role}-${crypto.randomBytes(3).toString("hex")}@example.com`;
  const pw = "Pw-" + crypto.randomBytes(6).toString("base64url");
  const { data } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { nama: role, role } });
  const cli = createClient(url, anon, opts);
  await cli.auth.signInWithPassword({ email, password: pw });
  return { id: data.user.id, cli };
};
const A = await mk("editor");
const B = await mk("editor");

const today = new Date().toISOString().slice(0, 10);
let r = await A.cli.from("attendance").insert({ user_id: A.id, tanggal: today, clock_in: new Date().toISOString() });
check("editor A clock in (own insert)", !r.error, r.error?.message);
const bSees = await B.cli.from("attendance").select("id").eq("user_id", A.id);
check("editor B TIDAK lihat absensi A (RLS)", (bSees.data?.length ?? 0) === 0, "rows=" + bSees.data?.length);
const bHack = await B.cli.from("attendance").insert({ user_id: A.id, tanggal: today, clock_in: new Date().toISOString() });
check("editor B TIDAK bisa absen atas nama A", !!bHack.error, "err=" + (bHack.error?.message ?? "tidak ada (BAHAYA)"));

await admin.from("attendance").delete().eq("user_id", A.id);
await admin.from("attendance").delete().eq("user_id", B.id);
await admin.auth.admin.deleteUser(A.id);
await admin.auth.admin.deleteUser(B.id);
console.log(`\n${fail === 0 ? "SEMUA LULUS ✅" : fail + " GAGAL ❌"}`);
process.exit(fail === 0 ? 0 : 1);
