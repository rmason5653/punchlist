import { redirect } from "next/navigation";
import {
  buildRestockRun,
  listConsumables,
  listCentralReserve,
  listUnits,
} from "@/lib/inventory";
import {
  Container,
  EmptyState,
  PageHeader,
  SetupNotice,
} from "@/app/components/ui";
import { getViewer, isAdmin } from "@/lib/auth-context";
import { listActiveStaffNames } from "@/lib/users-db";
import RestockClient, {
  type PickItem,
  type RestockRun,
} from "./RestockClient";
import DigestButton from "./DigestButton";

export const dynamic = "force-dynamic";

export default async function RestockPage() {
  // Manager-only. Middleware already gates /restock; this is the second lock so
  // the page can't render a run for a cleaner if that list ever drifts.
  if (!(await isAdmin())) redirect("/");

  let runs: RestockRun[] = [];
  let pickList: PickItem[] = [];
  let staffNames: string[] = [];
  let viewerName = "";
  let loadError: string | null = null;

  try {
    const [units, cons, reserve, names, viewer] = await Promise.all([
      listUnits(),
      listConsumables(),
      listCentralReserve(),
      // Managers only — the run is theirs, so the picker can't attribute it
      // to a cleaner.
      listActiveStaffNames("admin"),
      getViewer(),
    ]);
    staffNames = names;
    viewerName = viewer?.name ?? "";

    runs = buildRestockRun(units, cons).map((r) => ({
      unit_id: r.unit.unit_id,
      unit_name: r.unit.name,
      property_name: r.unit.property_name,
      items: r.items.map((i) => ({
        item_name: i.par.item_name,
        needed: i.needed,
        closet_par: i.par.closet_par,
        current_actual: i.par.current_actual,
      })),
    }));

    // Aggregate everything to pull from central across the whole run, so the
    // cleaner loads up once. Flag any item central can't fully cover.
    const needByItem = new Map<string, number>();
    for (const r of runs) {
      for (const it of r.items) {
        needByItem.set(it.item_name, (needByItem.get(it.item_name) ?? 0) + it.needed);
      }
    }
    const onHand = new Map(
      reserve
        .filter((r) => r.category === "consumable")
        .map((r) => [r.item_name, r.quantity_on_hand]),
    );
    pickList = [...needByItem.entries()]
      .map(([item_name, needed]) => {
        const on_hand = onHand.get(item_name) ?? 0;
        return { item_name, needed, on_hand, short: needed > on_hand };
      })
      .sort((a, b) => b.needed - a.needed);
  } catch (err) {
    loadError = (err as Error).message;
  }

  return (
    <Container>
      <PageHeader eyebrow="Weekly run · managers" title="Restock run">
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {runs.length > 0 && (
            <p className="text-sm text-ink-tertiary">
              {runs.length} {runs.length === 1 ? "unit" : "units"} below reorder
            </p>
          )}
          <DigestButton />
        </div>
      </PageHeader>

      {loadError ? (
        <SetupNotice message={loadError} />
      ) : runs.length === 0 ? (
        <EmptyState punch="All at par" line="No closet is below its reorder point. Nothing to restock." />
      ) : (
        <RestockClient
          runs={runs}
          pickList={pickList}
          staffNames={staffNames}
          viewerName={viewerName}
        />
      )}
    </Container>
  );
}
