import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getVideo, getDrafts, getComments, getStatusEvents } from "@/lib/videos";
import { createClient } from "@/lib/supabase/server";
import { actionsFor, STATUS_LABEL, TYPE_LABEL } from "@/lib/video-workflow";
import { StatusActions } from "./status-actions";
import { Comments } from "./comments";
import { Badge } from "@/components/ui/badge";

export default async function VideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const video = await getVideo(id);
  if (!video) notFound();

  const [drafts, comments, events] = await Promise.all([
    getDrafts(id), getComments(id), getStatusEvents(id),
  ]);

  const supabase = await createClient();
  const { data: profs } = await supabase.from("profiles").select("id, nama");
  const namaById = new Map((profs ?? []).map((p: { id: string; nama: string }) => [p.id, p.nama]));

  const actions = actionsFor(video.status, profile.role);
  const commentView = comments.map((c) => ({
    id: c.id, isi: c.isi, created_at: c.created_at,
    nama: c.user_id ? namaById.get(c.user_id) ?? "—" : "—",
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div>
          <Link href="/video" className="text-sm text-muted-foreground hover:underline">← Kembali</Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{video.judul}</h1>
            <Badge>{STATUS_LABEL[video.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {TYPE_LABEL[video.tipe]}
            {video.editor_id ? ` · Editor: ${namaById.get(video.editor_id) ?? "—"}` : " · belum ditugaskan"}
          </p>
          {video.link_source && (
            <a href={video.link_source} target="_blank" rel="noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 hover:underline">Link source ↗</a>
          )}
        </div>

        <StatusActions videoId={video.id} actions={actions} />

        <div className="space-y-2">
          <h3 className="font-medium">Riwayat Draft</h3>
          {drafts.length === 0 && <p className="text-sm text-muted-foreground">Belum ada draft.</p>}
          {drafts.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>Draft {d.nomor_draft}</span>
              <a href={d.link_draft} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                Buka link ↗
              </a>
            </div>
          ))}
        </div>

        <Comments videoId={video.id} comments={commentView} />
      </div>

      <aside className="space-y-2">
        <h3 className="font-medium">Timeline Status</h3>
        <ol className="space-y-2 border-l pl-4">
          {events.map((e) => (
            <li key={e.id} className="text-sm">
              <span className="font-medium">{STATUS_LABEL[e.status_baru]}</span>
              <span className="block text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString("id-ID")}
              </span>
            </li>
          ))}
          {events.length === 0 && <li className="text-sm text-muted-foreground">Belum ada perubahan status.</li>}
        </ol>
      </aside>
    </div>
  );
}
