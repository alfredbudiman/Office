import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui-kit";
import { listPeople, listCharges } from "@/lib/debt-data";
import { HutangView } from "./hutang-view";

export const metadata = { title: "Rekapitulasi Hutang" };

export default async function HutangPage() {
  await requireRole("owner", "finance");
  const [people, charges] = await Promise.all([listPeople(), listCharges()]);

  return (
    <div className="space-y-6">
      <PageHeader title="Rekapitulasi Hutang" description="Catat iuran Monday Lab, PA bulanan, & lainnya — lacak yang belum lunas." />
      <HutangView people={people} charges={charges} />
    </div>
  );
}
