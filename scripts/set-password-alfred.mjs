// One-off: set password Alfred ke 'Alfred88'.
// Jalankan: node --env-file=.env.local scripts/set-password-alfred.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_EMAIL = "alfred.budiman@gmail.com";
const NEW_PASSWORD = "Alfred88";

if (!url || !secret) {
  console.error("FATAL: env Supabase kosong.");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const list = await admin.auth.admin.listUsers();
if (list.error) {
  console.error("LIST USERS ERROR:", list.error.message);
  process.exit(2);
}
const user = list.data.users.find((u) => u.email === OWNER_EMAIL);
if (!user) {
  console.error("User tidak ditemukan:", OWNER_EMAIL);
  process.exit(3);
}

const upd = await admin.auth.admin.updateUserById(user.id, { password: NEW_PASSWORD });
if (upd.error) {
  console.error("UPDATE PASSWORD ERROR:", upd.error.message);
  process.exit(4);
}
console.log("OK: password Alfred di-set ke", NEW_PASSWORD);
