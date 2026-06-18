import { STATUS_LABEL, type VideoStatus } from "@/lib/video-workflow";

// Nada brand: netral (dalam proses) · gold (menunggu review owner) · hijau (selesai) · hijau solid (tayang).
const TONE: Record<VideoStatus, string> = {
  draft_brief: "bg-muted text-muted-foreground",
  cut_to_cut: "bg-muted text-foreground/70",
  review_cut: "bg-[#fbf1c9] text-[#7a5e00]",
  editing: "bg-brand-muted text-[#1d5128]",
  review_draft: "bg-[#fbf1c9] text-[#7a5e00]",
  final: "bg-[#dff3d3] text-[#1d5128]",
  tayang: "bg-brand text-brand-foreground",
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
