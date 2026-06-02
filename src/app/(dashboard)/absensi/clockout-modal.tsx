"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALFRED_WA, waLink } from "@/lib/wa";

export function ClockoutModal({
  initialSummary,
  onClose,
}: {
  initialSummary: string;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialSummary);

  function sendWA() {
    const url = waLink(ALFRED_WA, text);
    const win = window.open(url, "_blank", "noreferrer");
    if (!win) toast.error("Popup diblokir. Pakai 'Salin pesan' lalu paste manual.");
    else onClose();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Disalin");
    } catch {
      toast.error("Gagal menyalin");
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-soft"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">Lapor selesai kerja</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Edit pesan kalau perlu, lalu kirim ke Alfred via WhatsApp.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={sendWA}>
              <MessageCircle className="mr-2 h-4 w-4" /> Kirim via WhatsApp
            </Button>
            <Button variant="secondary" onClick={copy}>
              <Copy className="mr-2 h-4 w-4" /> Salin pesan
            </Button>
            <Button variant="ghost" onClick={onClose}>Tutup</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
