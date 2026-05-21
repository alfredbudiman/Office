// Verifikasi alur status + RLS video. Jalankan:
//   node --experimental-websocket --env-file=.env.local scripts/verify-video-flow.mjs "<owner_password>"
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerPw = process.argv[2];
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, opts);
let fail = 0;
const check = (n, c, d) => { console.log(`${c ? "PASS" : "FAIL"}: ${n}${d ? " — " + d : ""}`); if (!c) fail++; };

// Owner login
const owner = createClient(url, anon, opts);
const ol = await owner.auth.signInWithPassword({ email: "alfred.budiman@gmail.com", password: ownerPw });
check("owner login", !ol.error, ol.error?.message);

// Buat 2 editor sementara
const mk = async (role) => {
  const email = `t-${role}-${crypto.randomBytes(3).toString("hex")}@example.com`;
  const pw = "Pw-" + crypto.randomBytes(6).toString("base64url");
  const { data } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { nama: role, role } });
  return { id: data.user.id, email, pw };
};
const edA = await mk("editor");
const edB = await mk("editor");

// Owner buat video utk editor A
const ins = await owner.from("videos").insert({ judul: "Vid A", tipe: "monolog", status: "draft_brief", editor_id: edA.id }).select("id").single();
check("owner buat video", !ins.error, ins.error?.message);
const vid = ins.data?.id;

// Editor A & B login
const cliA = createClient(url, anon, opts); await cliA.auth.signInWithPassword({ email: edA.email, password: edA.pw });
const cliB = createClient(url, anon, opts); await cliB.auth.signInWithPassword({ email: edB.email, password: edB.pw });
const aSees = await cliA.from("videos").select("id").eq("id", vid);
const bSees = await cliB.from("videos").select("id").eq("id", vid);
check("editor A lihat video miliknya", aSees.data?.length === 1);
check("editor B TIDAK lihat video editor A (RLS)", (bSees.data?.length ?? 0) === 0);

// Editor B tidak bisa update video editor A
await cliB.from("videos").update({ status: "review_cut" }).eq("id", vid);
const after = await admin.from("videos").select("status").eq("id", vid).single();
check("editor B TIDAK bisa ubah video editor A", after.data?.status === "draft_brief", "status=" + after.data?.status);

// Cleanup
await admin.from("videos").delete().eq("id", vid);
await admin.auth.admin.deleteUser(edA.id);
await admin.auth.admin.deleteUser(edB.id);
console.log(`\n${fail === 0 ? "SEMUA LULUS ✅" : fail + " GAGAL ❌"}`);
process.exit(fail === 0 ? 0 : 1);
