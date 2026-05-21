import { STATUS_ORDER, type VideoStatus, type VideoType } from "@/lib/video-workflow";

export type StockVideo = { tipe: VideoType; status: VideoStatus; sudah_tayang: boolean };

const TYPES: VideoType[] = ["monolog", "podcast", "shorts", "clipping"];

export function stockReadyByType(videos: StockVideo[]): Record<VideoType, number> {
  const out = { monolog: 0, podcast: 0, shorts: 0, clipping: 0 } as Record<VideoType, number>;
  for (const v of videos) {
    if (v.status === "final" && !v.sudah_tayang) out[v.tipe]++;
  }
  return out;
}

export function pipelineByStatus(videos: StockVideo[]): Record<VideoStatus, number> {
  const out = {} as Record<VideoStatus, number>;
  for (const s of STATUS_ORDER) out[s] = 0;
  for (const v of videos) out[v.status]++;
  return out;
}

export const STOCK_TYPES = TYPES;
