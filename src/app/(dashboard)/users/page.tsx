import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NewUserForm } from "./new-user-form";
import { UserRowActions } from "./user-row-actions";
import type { Role } from "@/lib/roles";

export default async function UsersPage() {
  await requireRole("owner");
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, nama, email, role, aktif")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kelola User</h1>
        <NewUserForm />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(users ?? []).map((u: { id: string; nama: string; email: string; role: Role; aktif: boolean }) => (
            <TableRow key={u.id}>
              <TableCell>{u.nama}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell className="capitalize">{u.role}</TableCell>
              <TableCell>
                <Badge variant={u.aktif ? "default" : "secondary"}>
                  {u.aktif ? "Aktif" : "Nonaktif"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <UserRowActions id={u.id} role={u.role} aktif={u.aktif} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
