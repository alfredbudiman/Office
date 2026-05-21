// Polyfill WebSocket untuk Node < 22 (Node 22+ & Edge sudah punya WebSocket global).
// @supabase/realtime-js (dipakai supabase-js) butuh WebSocket global saat client dibuat.
export async function register() {
  if (typeof globalThis.WebSocket === "undefined") {
    const ws = await import("ws");
    // @ts-expect-error - polyfill global WebSocket dari paket ws
    globalThis.WebSocket = ws.default ?? ws.WebSocket;
  }
}
