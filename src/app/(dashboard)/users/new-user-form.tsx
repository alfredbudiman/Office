"use client";

import { useActionState, useEffect, useState } from "react";
import { createUser } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewUserForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createUser, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (!open) return <Button onClick={() => setOpen(true)}>+ User baru</Button>;

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-md border p-4">
      <div className="space-y-1">
        <Label htmlFor="nama">Nama</Label>
        <Input id="nama" name="nama" />
        {state?.errors?.nama && <p className="text-xs text-red-500">{state.errors.nama}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" />
        {state?.errors?.email && <p className="text-xs text-red-500">{state.errors.email}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="text" />
        {state?.errors?.password && <p className="text-xs text-red-500">{state.errors.password}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="role">Role</Label>
        <select id="role" name="role" className="h-9 rounded-md border px-2 text-sm">
          <option value="editor">editor</option>
          <option value="hrd">hrd</option>
          <option value="owner">owner</option>
        </select>
        {state?.errors?.role && <p className="text-xs text-red-500">{state.errors.role}</p>}
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
    </form>
  );
}
