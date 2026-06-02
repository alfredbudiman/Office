"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveDriveFolderUrl } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { ok: boolean; error?: string } | null;

export function SettingsForm({ initialUrl }: { initialUrl: string }) {
  const [state, action, pending] = useActionState(saveDriveFolderUrl, null as State);

  useEffect(() => {
    if (state?.ok) toast.success("Disimpan");
    else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="drive_folder_url">URL Folder Drive</Label>
        <Input
          id="drive_folder_url"
          name="drive_folder_url"
          defaultValue={initialUrl}
          placeholder="https://drive.google.com/drive/folders/..."
        />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</Button>
    </form>
  );
}
