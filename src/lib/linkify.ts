export type Part = { type: "text"; value: string } | { type: "link"; value: string };

const URL_RE = /(https?:\/\/[^\s]+|wa\.me\/[^\s]+|www\.[^\s]+)/gi;
const TRAIL_PUNCT = /[.,!?)\]>;:]+$/;

function isValidUrl(raw: string): boolean {
  const candidate = raw.startsWith("http") ? raw : `https://${raw}`;
  try {
    const u = new URL(candidate);
    return u.hostname.length > 0 && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function linkify(text: string): Part[] {
  if (!text) return [];
  const parts: Part[] = [];
  let lastIndex = 0;
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0];
    const start = m.index ?? 0;
    const trailMatch = raw.match(TRAIL_PUNCT);
    const trail = trailMatch ? trailMatch[0] : "";
    const url = trail ? raw.slice(0, raw.length - trail.length) : raw;

    if (!isValidUrl(url)) continue;

    if (start > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, start) });
    }
    parts.push({ type: "link", value: url });
    lastIndex = start + url.length;
    if (trail) {
      parts.push({ type: "text", value: trail });
      lastIndex += trail.length;
    }
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  const merged: Part[] = [];
  for (const p of parts) {
    const last = merged[merged.length - 1];
    if (last && last.type === "text" && p.type === "text") {
      last.value += p.value;
    } else {
      merged.push(p);
    }
  }
  return merged;
}
