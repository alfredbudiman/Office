import { STATUS_LABEL, type VideoStatus } from "@/lib/video-workflow";

// 3 nada: netral (dalam proses), amber (menunggu review owner), emerald (selesai/tayang).
const TONE: Record<VideoStatus, string> = {
  draft_brief: "bg-muted text-muted-foreground",
  cut_to_cut: "bg-muted text-foreground/70",
  review_cut: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  editing: "bg-brand-muted text-brand",
  review_draft: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  final: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  tayang: "bg-emerald-600 text-white dark:bg-emerald-500",
};

export function StatusBadge({ status, className = "" }: { status: VideoStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[status]} ${className}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
