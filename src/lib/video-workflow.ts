import type { Role } from "@/lib/roles";

export type VideoType = "monolog" | "podcast" | "shorts" | "clipping";
export type VideoStatus =
  | "draft_brief" | "cut_to_cut" | "review_cut"
  | "editing" | "review_draft" | "final" | "tayang";
export type VideoAction =
  | "start_cut" | "submit_cut" | "approve_cut" | "request_cut_revision"
  | "submit_draft" | "approve_final" | "request_revision" | "mark_tayang";

export const STATUS_ORDER: VideoStatus[] = [
  "draft_brief", "cut_to_cut", "review_cut", "editing", "review_draft", "final", "tayang",
];

export const STATUS_LABEL: Record<VideoStatus, string> = {
  draft_brief: "Draft Brief",
  cut_to_cut: "Cut-to-Cut",
  review_cut: "Review Cut",
  editing: "Editing",
  review_draft: "Review Draft",
  final: "Final",
  tayang: "Tayang",
};

export const TYPE_LABEL: Record<VideoType, string> = {
  monolog: "Monolog",
  podcast: "Podcast",
  shorts: "Shorts",
  clipping: "Clipping",
};

export const ACTION_LABEL: Record<VideoAction, string> = {
  start_cut: "Mulai Cut-to-Cut",
  submit_cut: "Kirim Cut-to-Cut",
  approve_cut: "Approve Cut",
  request_cut_revision: "Minta Revisi Cut",
  submit_draft: "Kirim Draft",
  approve_final: "Centang Final",
  request_revision: "Minta Revisi",
  mark_tayang: "Tandai Tayang",
};

type ActionDef = {
  from: VideoStatus;
  to: VideoStatus;
  role: "owner" | "editor";
  requiresLink?: boolean;
  createsDraft?: boolean;
};

export const ACTIONS: Record<VideoAction, ActionDef> = {
  start_cut: { from: "draft_brief", to: "cut_to_cut", role: "editor" },
  submit_cut: { from: "cut_to_cut", to: "review_cut", role: "editor", requiresLink: true },
  approve_cut: { from: "review_cut", to: "editing", role: "owner" },
  request_cut_revision: { from: "review_cut", to: "cut_to_cut", role: "owner" },
  submit_draft: { from: "editing", to: "review_draft", role: "editor", requiresLink: true, createsDraft: true },
  approve_final: { from: "review_draft", to: "final", role: "owner" },
  request_revision: { from: "review_draft", to: "editing", role: "owner" },
  mark_tayang: { from: "final", to: "tayang", role: "owner" },
};

export function initialStatus(type: VideoType): VideoStatus {
  return type === "clipping" ? "editing" : "draft_brief";
}

export function actionsFor(status: VideoStatus, role: Role): VideoAction[] {
  if (role !== "owner" && role !== "editor") return [];
  return (Object.keys(ACTIONS) as VideoAction[]).filter(
    (a) => ACTIONS[a].from === status && ACTIONS[a].role === role
  );
}

export function applyAction(
  status: VideoStatus,
  action: VideoAction
): { ok: true; to: VideoStatus } | { ok: false; error: string } {
  const def = ACTIONS[action];
  if (!def) return { ok: false, error: "Aksi tidak dikenal" };
  if (def.from !== status) {
    return { ok: false, error: `Aksi '${action}' tidak valid dari status '${STATUS_LABEL[status]}'` };
  }
  return { ok: true, to: def.to };
}
