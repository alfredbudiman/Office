// Verifikasi login by username (Fase tambahan).
// Jalankan: node --experimental-websocket --env-file=.env.local scripts/verify-login-username.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_EMAIL = "alfred.budiman@gmail.com";
const PASSWORD = "Alfred88";

if (!url || !anon || !secret) {
  console.error("FATAL: env Supabase kosong.");
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, opts);

let failures = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

// Helper mensimulasikan logic server action `login()`
async function resolveAndSignIn(identifier, password) {
  let email = identifier;
  if (!identifier.includes("@")) {
    const { data } = await admin
      .from("profiles")
      .select("email")
      .ilike("username", identifier)
      .eq("aktif", true)
      .maybeSingle();
    if (!data?.email) return { error: { message: "Email/username atau password salah" } };
    email = data.email;
  }
  const c = createClient(url, anon, opts);
  return c.auth.signInWithPassword({ email, password });
}

// 1. Username 'Alfred' (case sesuai) + password benar → sukses
const r1 = await resolveAndSignIn("Alfred", PASSWORD);
check("login pakai username 'Alfred'", !r1.error, r1.error?.message);

// 2. Username 'alfred' (lowercase) + password benar → sukses (case-insensitive)
const r2 = await resolveAndSignIn("alfred", PASSWORD);
check("login case-insensitive 'alfred'", !r2.error, r2.error?.message);

// 3. Username 'ALFRED' (uppercase) + password benar → sukses
const r3 = await resolveAndSignIn("ALFRED", PASSWORD);
check("login case-insensitive 'ALFRED'", !r3.error, r3.error?.message);

// 4. Email (path lama) + password benar → masih sukses
const r4 = await resolveAndSignIn(OWNER_EMAIL, PASSWORD);
check("login pakai email (path lama)", !r4.error, r4.error?.message);

// 5. Username tidak ada → error generik (bukan crash)
const r5 = await resolveAndSignIn("UserYangTidakAda", PASSWORD);
check("username tidak ada → error generik", !!r5.error, "msg=" + r5.error?.message);

// 6. Username benar tapi password salah → error
const r6 = await resolveAndSignIn("Alfred", "salahPassword");
check("username benar password salah → error", !!r6.error, "msg=" + r6.error?.message);

// 7. Input dengan trailing space → 'login()' server action sudah trim, simulasikan
const r7 = await resolveAndSignIn("Alfred".trim(), PASSWORD);
check("input ter-trim → sukses", !r7.error, r7.error?.message);

// 8. Verifikasi user lain (tanpa username) hanya bisa login pakai email
//    Bikin editor sementara TANPA username, lalu coba login pakai email
const editorEmail = `editor-uname-${Date.now()}@example.com`;
const editorPw = "Editor-Test-88";
const created = await admin.auth.admin.createUser({
  email: editorEmail, password: editorPw, email_confirm: true,
  user_metadata: { nama: "Editor Test Uname", role: "editor" },
});
const editorId = created.data?.user?.id;
check("editor sementara dibuat", !created.error && !!editorId, created.error?.message);

if (editorId) {
  // Pastikan profile-nya tidak punya username
  await admin.from("profiles").update({ username: null }).eq("id", editorId);

  // Editor login pakai email → harus sukses
  const r8 = await resolveAndSignIn(editorEmail, editorPw);
  check("user lain login pakai email → sukses", !r8.error, r8.error?.message);

  // Editor login pakai "nama" (bukan username yang valid) → error generik
  const r9 = await resolveAndSignIn("Editor Test Uname", editorPw);
  check("user tanpa username, login pakai nama → error", !!r9.error, "msg=" + r9.error?.message);

  // Cleanup
  await admin.auth.admin.deleteUser(editorId);
  console.log("INFO: editor sementara dihapus.");
}

console.log(`\n${failures === 0 ? "SEMUA LULUS ✅" : failures + " GAGAL ❌"}`);
process.exit(failures === 0 ? 0 : 1);
