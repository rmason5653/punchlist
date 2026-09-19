import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSettings,
  getUnit,
  listConsumables,
  listLinens,
  measuredTurnoverForUnit,
} from "@/lib/inventory";
import { Container, Pill, SetupNotice, formatWhen } from "@/app/components/ui";
import UnitAdmin from "./UnitAdmin";
import PullDialog from "@/app/components/PullDialog";
import CleanFlow from "./CleanFlow";
import LinenEditor from "./LinenEditor";
import { getViewer } from "@/lib/auth-context";
import { listActiveStaffNames } from "@/lib/users-db";

export const dynamic = "force-dynamic";

export default async function UnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Look the unit up outside the try: notFound() works by throwing, and a
  // catch-all around it turned every stale link into a "database" error.
  let unit: Awaited<ReturnType<typeof getUnit>> = null;
  try {
    unit = await getUnit(id);
  } catch (err) {
    return (
      <Container>
        <SetupNotice message={(err as Error).message} />
      </Container>
    );
  }
  if (!unit) notFound();

  try {
    const [consumables, linens, staffNames, viewer] = await Promise.all([
      listConsumables(id),
      listLinens(id),
      listActiveStaffNames(),
      getViewer(),
    ]);
    const admin = viewer?.role === "admin";
    const retired = !!unit.retired_at;
    // Manager-only extras: the global turnover default and this unit's own
    // cadence, for the override control.
    const [settings, measured] = admin
      ? await Promise.all([getSettings(), measuredTurnoverForUnit(unit.unit_id)])
      : [null, null];

    return (
      <Container>
        <Link
          href="/"
          className="text-sm text-ink-tertiary transition hover:text-ink-primary"
        >
          ← All units
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
              {unit.property_name}
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink-primary">
              {unit.name}
            </h1>
          </div>
          {retired && <Pill tone="neutral">Retired</Pill>}
        </div>

        {retired && (
          <div className="mt-4 rounded-card border border-line bg-surface-2 px-4 py-3 text-sm text-ink-secondary">
            Retired {formatWhen(unit.retired_at ?? null)}. It no longer appears in any list or on
            the restock run; its pulls and cleans stay in the logs.
          </div>
        )}

        {!retired && (
        <div className="mt-6">
          <CleanFlow
            unit={unit}
            consumables={consumables}
            linens={linens}
            staffNames={staffNames}
            viewerName={viewer?.name ?? ""}
          />
        </div>
        )}

        {/* The manager's setup tools come after the clean steps: a manager
            cleaning a unit shouldn't scroll past them to start. The bottom
            padding clears the clean flow's sticky bar. */}
        {admin && settings && measured && (
          <section className={retired ? "mt-6 space-y-3" : "-mt-16 space-y-3 pb-28"}>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
              Manager tools
            </h2>
            {!retired && (
              <LinenEditor
                unitId={unit.unit_id}
                linens={linens}
                hasPullout={unit.has_pullout}
                rollawayBeds={unit.rollaway_beds}
              />
            )}
            <UnitAdmin
              unitId={unit.unit_id}
              name={unit.name}
              turnover={unit.turnover_frequency}
              defaultTurnover={settings.default_turnover_frequency}
              measured={measured}
              retired={retired}
            />
            {!retired && (
              <div>
                <PullDialog
                  label="Pull from Stockroom"
                  variant="ghost"
                  prefill={{ unit_id: unit.unit_id }}
                />
              </div>
            )}
          </section>
        )}
      </Container>
    );
  } catch (err) {
    return (
      <Container>
        <SetupNotice message={(err as Error).message} />
      </Container>
    );
  }
}
