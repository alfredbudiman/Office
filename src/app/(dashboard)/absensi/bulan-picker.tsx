"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function BulanPicker({ bulan }: { bulan: string }) {
  const router = useRouter();
  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="bulan">Bulan</Label>
        <Input
          id="bulan"
          type="month"
          defaultValue={bulan}
          onChange={(e) => {
            const v = e.target.value;
            if (v) router.push(`/absensi?bulan=${v}`);
          }}
          className="h-9 w-full rounded-lg sm:w-auto"
        />
      </div>
    </div>
  );
}
