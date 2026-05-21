// Verifikasi auth + RLS. Jalankan:
//   node --experimental-websocket --env-file=.env.local scripts/verify-rls.mjs "<owner_password>"
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerPw = process.argv[2];
const OWNER_EMAIL = "alfred.budiman@gmail.com";

if (!ownerPw) { console.error("Beri owner password sebagai argumen."); process.exit(1); }

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, opts);

let failures = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

// 1. Owner bisa login
const ownerClient = createClient(url, anon, opts);
const oLogin = await ownerClient.auth.signInWithPassword({ email: OWNER_EMAIL, password: ownerPw });
check("owner bisa login", !oLogin.error, oLogin.error?.message);

// 2. Buat editor sementara untuk uji RLS
const editorEmail = `editor-test-${crypto.randomBytes(3).toString("hex")}@example.com`;
const editorPw = "Editor-" + crypto.randomBytes(6).toString("base64url");
const created = await admin.auth.admin.createUser({
  email: editorEmail, password: editorPw, email_confirm: true,
  user_metadata: { nama: "Editor Test", role: "editor" },
});
check("editor sementara dibuat", !created.error, created.error?.message);
const editorId = created.data?.user?.id;

// 3. Profil editor otomatis role 'editor' (via trigger)
const ep = await admin.from("profiles").select("role").eq("id", editorId).single();
check("editor profil role=editor", ep.data?.role === "editor", "role=" + ep.data?.role);

// 4. Owner (login) melihat SEMUA profil (>=2: owner + editor)
const ownerView = await ownerClient.from("profiles").select("id, email, role");
check("owner melihat semua profil", !ownerView.error && (ownerView.data?.length ?? 0) >= 2,
  "rows=" + (ownerView.data?.length ?? 0));

// 5. Editor (login) HANYA melihat profil sendiri (RLS isolasi)
const editorClient = createClient(url, anon, opts);
const eLogin = await editorClient.auth.signInWithPassword({ email: editorEmail, password: editorPw });
check("editor bisa login", !eLogin.error, eLogin.error?.message);
const editorView = await editorClient.from("profiles").select("id, email, role");
const onlySelf = (editorView.data?.length === 1) && editorView.data[0].id === editorId;
check("editor HANYA lihat profil sendiri (RLS)", onlySelf,
  "rows=" + (editorView.data?.length ?? 0));

// 6. Editor TIDAK bisa promosikan dirinya jadi owner (update policy owner-only)
const selfPromote = await editorClient.from("profiles").update({ role: "owner" }).eq("id", editorId);
const recheck = await admin.from("profiles").select("role").eq("id", editorId).single();
check("editor TIDAK bisa naikkan role sendiri", recheck.data?.role === "editor",
  "role setelah coba=" + recheck.data?.role);

// Bersihkan editor sementara
if (editorId) {
  await admin.auth.admin.deleteUser(editorId);
  console.log("INFO: editor sementara dihapus (cleanup).");
}

console.log(`\n${failures === 0 ? "SEMUA LULUS ✅" : failures + " GAGAL ❌"}`);
process.exit(failures === 0 ? 0 : 1);
