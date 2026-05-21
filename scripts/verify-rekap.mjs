// Verifikasi angka stok & rekap. Jalankan:
//   node --experimental-websocket --env-file=.env.local scripts/verify-rekap.mjs
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, secret, { auth: { persistSession: false } });
let fail = 0;
const check = (n, c, d) => { console.log(`${c ? "PASS" : "FAIL"}: ${n}${d ? " — " + d : ""}`); if (!c) fail++; };

const created = new Date(Date.now() - 3 * 86400000).toISOString();
const finalAt = new Date(Date.now() - 1 * 86400000).toISOString();

const mk = (judul, status, sudah_tayang, final_at) =>
  admin.from("videos").insert({ judul, tipe: "monolog", status, sudah_tayang, created_at: created, final_at }).select("id").single();
const a = await mk("REKAP-A", "final", false, finalAt);
const b = await mk("REKAP-B", "final", true, finalAt);
const ids = [a.data.id, b.data.id];
await admin.from("status_events").insert({ video_id: a.data.id, status_lama: "review_draft", status_baru: "final", created_at: finalAt });

const ready = await admin.from("videos").select("id").eq("tipe", "monolog").eq("status", "final").eq("sudah_tayang", false);
check("stok monolog final-belum-tayang >= 1", (ready.data?.length ?? 0) >= 1, "count=" + ready.data?.length);

const from = new Date(Date.now() - 7 * 86400000).toISOString();
const done = await admin.from("videos").select("id").not("final_at", "is", null).gte("final_at", from).in("id", ids);
check("2 video selesai terdeteksi di rentang", done.data?.length === 2, "count=" + done.data?.length);

await admin.from("videos").delete().in("id", ids);
console.log(`\n${fail === 0 ? "SEMUA LULUS ✅" : fail + " GAGAL ❌"}`);
process.exit(fail === 0 ? 0 : 1);
