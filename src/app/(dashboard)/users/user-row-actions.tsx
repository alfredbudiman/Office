"use client";

import { useTransition } from "react";
import { setUserRole, setUserAktif } from "./actions";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/roles";

export function UserRowActions({ id, role, aktif }: { id: string; role: Role; aktif: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex justify-end gap-2">
      <select
        defaultValue={role}
        disabled={pending}
        className="h-8 rounded-md border px-2 text-sm"
        onChange={(e) => start(() => { setUserRole(id, e.target.value as Role); })}
      >
        <option value="editor">editor</option>
        <option value="hrd">hrd</option>
        <option value="owner">owner</option>
      </select>
      <Button
        size="sm"
        variant={aktif ? "secondary" : "default"}
        disabled={pending}
        onClick={() => start(() => { setUserAktif(id, !aktif); })}
      >
        {aktif ? "Nonaktifkan" : "Aktifkan"}
      </Button>
    </div>
  );
}
