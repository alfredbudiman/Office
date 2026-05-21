// Uji alur penuh + RLS operasi tulis (yang dilakukan server actions). Jalankan:
//   node --experimental-websocket --env-file=.env.local scripts/verify-video-fullflow.mjs "<owner_password>"
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

const owner = createClient(url, anon, opts);
await owner.auth.signInWithPassword({ email: "alfred.budiman@gmail.com", password: ownerPw });
const ownerId = (await owner.auth.getUser()).data.user.id;

const mk = async () => {
  const email = `t-ed-${crypto.randomBytes(3).toString("hex")}@example.com`;
  const pw = "Pw-" + crypto.randomBytes(6).toString("base64url");
  const { data } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { nama: "Ed", role: "editor" } });
  const cli = createClient(url, anon, opts);
  await cli.auth.signInWithPassword({ email, password: pw });
  return { id: data.user.id, cli };
};
const A = await mk();
const B = await mk();

// owner buat video utk A
const ins = await owner.from("videos").insert({ judul: "Flow", tipe: "monolog", status: "draft_brief", editor_id: A.id, created_by: ownerId }).select("id").single();
const vid = ins.data?.id;
const setStatus = (cli, to) => cli.from("videos").update({ status: to }).eq("id", vid);
const event = (cli, lama, baru, who) => cli.from("status_events").insert({ video_id: vid, status_lama: lama, status_baru: baru, changed_by: who });

// editor A: draft_brief -> cut_to_cut -> review_cut (boleh tulis status + event di video sendiri)
let r = await setStatus(A.cli, "cut_to_cut"); check("editor A update status (own)", !r.error, r.error?.message);
r = await event(A.cli, "draft_brief", "cut_to_cut", A.id); check("editor A tulis status_event (own)", !r.error, r.error?.message);
await setStatus(A.cli, "review_cut");

// owner approve cut -> editing
await setStatus(owner, "editing");

// editor A submit_draft 1 -> draft + review_draft
r = await A.cli.from("drafts").insert({ video_id: vid, nomor_draft: 1, link_draft: "https://x/1", created_by: A.id });
check("editor A insert draft (own)", !r.error, r.error?.message);
await setStatus(A.cli, "review_draft");

// owner request_revision -> editing ; editor A submit_draft 2
await setStatus(owner, "editing");
await A.cli.from("drafts").insert({ video_id: vid, nomor_draft: 2, link_draft: "https://x/2", created_by: A.id });
await setStatus(A.cli, "review_draft");

// owner approve_final -> final ; mark_tayang -> tayang
await owner.from("videos").update({ status: "final", final_at: new Date().toISOString() }).eq("id", vid);
await owner.from("videos").update({ status: "tayang", sudah_tayang: true, published_at: new Date().toISOString() }).eq("id", vid);

// editor A komentar (own) boleh; editor B komentar (bukan own) ditolak RLS
r = await A.cli.from("comments").insert({ video_id: vid, user_id: A.id, isi: "siap" });
check("editor A komentar (own)", !r.error, r.error?.message);
await B.cli.from("comments").insert({ video_id: vid, user_id: B.id, isi: "hack" });
const cmts = await admin.from("comments").select("id").eq("video_id", vid);
check("editor B TIDAK bisa komentar video A (RLS)", cmts.data?.length === 1, "comments=" + cmts.data?.length);

// Verifikasi akhir
const fin = await admin.from("videos").select("status, sudah_tayang").eq("id", vid).single();
const dr = await admin.from("drafts").select("id").eq("video_id", vid);
check("status akhir = tayang", fin.data?.status === "tayang", fin.data?.status);
check("sudah_tayang = true", fin.data?.sudah_tayang === true);
check("2 draft tersimpan (riwayat append)", dr.data?.length === 2, "drafts=" + dr.data?.length);

// cleanup
await admin.from("videos").delete().eq("id", vid);
await admin.auth.admin.deleteUser(A.id);
await admin.auth.admin.deleteUser(B.id);
console.log(`\n${fail === 0 ? "SEMUA LULUS ✅" : fail + " GAGAL ❌"}`);
process.exit(fail === 0 ? 0 : 1);
