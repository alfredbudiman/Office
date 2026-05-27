import type { ReactNode } from "react";

const URL_RE = /https?:\/\/[^\s<>"']+/g;
const TRAILING_PUNCT = /[.,;:!?)\]}'"]+$/;

export function linkifyText(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let url = m[0];
    let trailing = "";
    const trailMatch = url.match(TRAILING_PUNCT);
    if (trailMatch) {
      trailing = trailMatch[0];
      url = url.slice(0, -trailing.length);
    }
    if (start > lastIndex) out.push(text.slice(lastIndex, start));
    out.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-all text-brand underline underline-offset-2 transition-opacity hover:opacity-80"
      >
        {url}
      </a>,
    );
    if (trailing) out.push(trailing);
    lastIndex = start + m[0].length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}
