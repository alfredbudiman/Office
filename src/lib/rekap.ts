import type { VideoStatus } from "@/lib/video-workflow";

export type EventLite = { status_baru: VideoStatus; created_at: string };

export function totalDurationMs(createdAt: string, finalAt: string | null): number | null {
  if (!finalAt) return null;
  return new Date(finalAt).getTime() - new Date(createdAt).getTime();
}

export function average(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const totalMin = Math.round(ms / 60000);
  const hari = Math.floor(totalMin / 1440);
  const jam = Math.floor((totalMin % 1440) / 60);
  const menit = totalMin % 60;
  const parts: string[] = [];
  if (hari) parts.push(`${hari} hari`);
  if (jam) parts.push(`${jam} jam`);
  if (!hari && menit) parts.push(`${menit} menit`);
  return parts.length ? parts.join(" ") : "0 menit";
}

export function stageDurationsMs(
  initialStatus: VideoStatus,
  createdAt: string,
  events: EventLite[]
): Partial<Record<VideoStatus, number>> {
  const timeline: { status: VideoStatus; at: number }[] = [
    { status: initialStatus, at: new Date(createdAt).getTime() },
    ...events.map((e) => ({ status: e.status_baru, at: new Date(e.created_at).getTime() })),
  ];
  const out: Partial<Record<VideoStatus, number>> = {};
  for (let i = 0; i < timeline.length - 1; i++) {
    const dur = timeline[i + 1].at - timeline[i].at;
    const s = timeline[i].status;
    out[s] = (out[s] ?? 0) + dur;
  }
  return out;
}
