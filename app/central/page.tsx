import { redirect } from "next/navigation";
import { listCentralReserve } from "@/lib/inventory";
import { isAdmin } from "@/lib/auth-context";
import { Container, PageHeader, SetupNotice } from "@/app/components/ui";
import type { CentralReserveItem } from "@/lib/types";
import CentralClient from "./CentralClient";

export const dynamic = "force-dynamic";

export default async function CentralPage() {
  // Managers only. Middleware gates the path; this is the second lock.
  if (!(await isAdmin())) redirect("/");

  let items: CentralReserveItem[] = [];
  let loadError: string | null = null;

  try {
    items = await listCentralReserve();
  } catch (err) {
    loadError = (err as Error).message;
  }

  const low = items.filter((i) => i.quantity_on_hand <= i.reorder_point).length;
  const toPar = items.reduce(
    (s, i) => s + Math.max(0, i.par_level - i.quantity_on_hand),
    0,
  );

  return (
    <Container>
      <PageHeader eyebrow="View 2" title="Stockroom">
        {!loadError && (
          <p className="text-sm text-ink-tertiary">
            {low > 0 && <span className="text-state-warn">{low} below reorder</span>}
            {low > 0 && toPar > 0 && " · "}
            {toPar > 0 && <span className="text-ink-secondary">{toPar} to buy to par</span>}
            {low === 0 && toPar === 0 && "All bulk stock at par"}
          </p>
        )}
      </PageHeader>

      {loadError ? (
        <SetupNotice message={loadError} />
      ) : (
        <CentralClient items={items} />
      )}
    </Container>
  );
}
