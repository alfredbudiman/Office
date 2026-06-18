import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getVideo, getDrafts, getComments, getStatusEvents } from "@/lib/videos";
import { createClient } from "@/lib/supabase/server";
import { actionsFor, STATUS_LABEL, typeLabel } from "@/lib/video-workflow";
import { StatusActions } from "./status-actions";
import { Comments } from "./comments";
import { StatusBadge } from "@/components/status-badge";
import { SectionTitle } from "@/components/ui-kit";

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
        {/* Header */}
        <div>
          <Link
            href="/video"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl tracking-tight sm:text-[28px]">{video.judul}</h1>
            <StatusBadge status={video.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {typeLabel(video)}
            {video.editor_id ? ` · Editor: ${namaById.get(video.editor_id) ?? "—"}` : " · belum ditugaskan"}
          </p>
          {video.link_source && (
            <a
              href={video.link_source}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-brand transition-colors hover:text-brand/80"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Link source
            </a>
          )}
        </div>

        {/* Status actions card */}
        <StatusActions
          videoId={video.id}
          actions={actions}
          isOwner={profile.role === "owner"}
          currentStatus={video.status}
        />

        {/* Draft history card */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <SectionTitle>Riwayat Draft</SectionTitle>
          {drafts.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">Belum ada draft.</p>
          )}
          {drafts.length > 0 && (
            <ul className="mt-3 space-y-2">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="text-foreground">Draft {d.nomor_draft}</span>
                  <a
                    href={d.link_draft}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-brand transition-colors hover:text-brand/80"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Buka link
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Comments card */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <Comments videoId={video.id} comments={commentView} />
        </div>
      </div>

      {/* Timeline aside */}
      <aside>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <SectionTitle>Timeline Status</SectionTitle>
          <ol className="mt-4 space-y-4 border-l border-border pl-4">
            {events.map((e, i) => (
              <li key={e.id} className="relative">
                <span
                  className={`absolute -left-[1.3125rem] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
                    i === 0 ? "bg-brand" : "bg-muted-foreground/40"
                  }`}
                />
                <span className="text-sm font-medium text-foreground">
                  {STATUS_LABEL[e.status_baru]}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("id-ID")}
                </span>
                {e.note && (
                  <span className="mt-1 block text-xs italic text-muted-foreground/80">
                    &quot;{e.note}&quot;
                  </span>
                )}
              </li>
            ))}
            {events.length === 0 && (
              <li className="text-sm text-muted-foreground">Belum ada perubahan status.</li>
            )}
          </ol>
        </div>
      </aside>
    </div>
  );
}
