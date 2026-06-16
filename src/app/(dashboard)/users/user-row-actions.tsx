"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setUserRole, setUserAktif } from "./actions";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/roles";

export function UserRowActions({ id, role, aktif }: { id: string; role: Role; aktif: boolean }) {
  const [pending, start] = useTransition();
  const [curRole, setCurRole] = useState<Role>(role);

  return (
    <div className="flex justify-end gap-2">
      <select
        value={curRole}
        disabled={pending}
        className="h-8 rounded-md border px-2 text-sm"
        onChange={(e) => {
          const next = e.target.value as Role;
          const prev = curRole;
          setCurRole(next);
          start(async () => {
            const res = await setUserRole(id, next);
            if (!res?.ok) {
              setCurRole(prev); // kembalikan ke nilai semula bila gagal
              toast.error(res?.error ?? "Gagal mengubah role");
            } else {
              toast.success("Role diperbarui");
            }
          });
        }}
      >
        <option value="editor">editor (konten)</option>
        <option value="hrd">recruitment</option>
        <option value="owner">owner (semua akses)</option>
      </select>
      <Button
        size="sm"
        variant={aktif ? "secondary" : "default"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setUserAktif(id, !aktif);
            if (!res?.ok) {
              toast.error(res?.error ?? "Gagal mengubah status");
            } else {
              toast.success(aktif ? "User dinonaktifkan" : "User diaktifkan");
            }
          })
        }
      >
        {aktif ? "Nonaktifkan" : "Aktifkan"}
      </Button>
    </div>
  );
}
