"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClippingTask } from "@/app/(dashboard)/video/actions";

/** Tombol buat tugas clipping dari konten yang sudah jadi (owner only). */
export function ClippingButton({ title, link }: { title: string; link: string | null }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="xs"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await createClippingTask(title, link);
          if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
          toast.success("Tugas clipping dibuat — assign editor di modul Video");
          router.refresh();
        })
      }
    >
      <Scissors className="mr-1 h-3 w-3" /> Clipping
    </Button>
  );
}
