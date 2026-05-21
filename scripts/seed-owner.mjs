// One-off: verifikasi skema + buat akun owner via admin API.
// Jalankan: node --env-file=.env.local scripts/seed-owner.mjs
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_EMAIL = "alfred.budiman@gmail.com";

if (!url || !secret) {
  console.error("FATAL: NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY kosong.");
  process.exit(1);
}
console.log("URL:", url);

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

// 1. Verifikasi skema profiles
const schema = await admin.from("profiles").select("id").limit(1);
if (schema.error) {
  console.error("SCHEMA ERROR:", schema.error.message);
  console.error(">> Sepertinya blok SQL belum dijalankan di SQL Editor. Hentikan & jalankan SQL dulu.");
  process.exit(2);
}
console.log("OK: tabel profiles ada & bisa diakses.");

// 2. Cek apakah owner sudah ada
const list = await admin.auth.admin.listUsers();
if (list.error) {
  console.error("LIST USERS ERROR:", list.error.message);
  process.exit(3);
}
const existing = list.data.users.find((u) => u.email === OWNER_EMAIL);

let password = null;
if (existing) {
  console.log("INFO: user owner sudah ada (id:", existing.id + "). Tidak membuat ulang.");
} else {
  password = "Owner-" + crypto.randomBytes(6).toString("base64url");
  const created = await admin.auth.admin.createUser({
    email: OWNER_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { nama: "Alfred", role: "owner" },
  });
  if (created.error) {
    console.error("CREATE USER ERROR:", created.error.message);
    process.exit(4);
  }
  console.log("OK: akun owner dibuat (id:", created.data.user.id + ").");
}

// 3. Verifikasi profil owner role=owner (dibuat oleh trigger)
const prof = await admin.from("profiles").select("id, nama, email, role, aktif").eq("email", OWNER_EMAIL).single();
if (prof.error) {
  console.error("PROFILE CHECK ERROR:", prof.error.message);
  process.exit(5);
}
console.log("PROFIL OWNER:", JSON.stringify(prof.data));
if (prof.data.role !== "owner") {
  console.log("Memperbaiki role -> owner...");
  const upd = await admin.from("profiles").update({ role: "owner", nama: "Alfred" }).eq("email", OWNER_EMAIL);
  if (upd.error) { console.error("UPDATE ROLE ERROR:", upd.error.message); process.exit(6); }
  console.log("OK: role di-set owner.");
}

if (password) {
  console.log("\n==============================================");
  console.log("PASSWORD OWNER (login pakai ini, ganti nanti):");
  console.log("  email   :", OWNER_EMAIL);
  console.log("  password:", password);
  console.log("==============================================");
} else {
  console.log("\n(Owner sudah ada sebelumnya — password tidak diubah.)");
}
console.log("SELESAI.");
