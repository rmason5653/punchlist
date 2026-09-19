import Link from "next/link";
import {
  buildCounts,
  listConsumables,
  listCentralReserveWithTargets,
  listLinens,
  listRecentCleans,
  listUnits,
  recentUnitIdsFor,
  type RecentClean,
} from "@/lib/inventory";
import type { ConsumablePar, LinenPar, Unit } from "@/lib/types";
import { needsRestock } from "@/lib/rules";
import {
  Container,
  SetupNotice,
  StatCard,
  formatWhen,
} from "@/app/components/ui";
import UnitPicker, { type UnitSummary } from "@/app/components/UnitPicker";
import { getViewer } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

interface UnitRollup {
  consLow: number;
  linenShort: number;
}

function rollup(
  units: Unit[],
  cons: ConsumablePar[],
  linens: LinenPar[],
): Map<string, UnitRollup> {
  const map = new Map<string, UnitRollup>();
  for (const u of units) map.set(u.unit_id, { consLow: 0, linenShort: 0 });
  for (const c of cons) {
    if (needsRestock(c)) {
      const r = map.get(c.unit_id);
      if (r) r.consLow += 1;
    }
  }
  for (const l of linens) {
    if (l.current_actual < l.par_count) {
      const r = map.get(l.unit_id);
      if (r) r.linenShort += 1;
    }
  }
  return map;
}

export default async function HomePage() {
  // Portfolio status below is the manager view — every card on it links to a
  // page cleaners can't open. Resolve the role once, then skip both the
  // section and the reads that exist only to feed it.
  const viewer = await getViewer();
  const admin = viewer?.role === "admin";

  let units: Unit[] = [];
  let cons: ConsumablePar[] = [];
  let linens: LinenPar[] = [];
  let counts = {
    unitsBelowReorder: 0,
    centralLow: 0,
    linenShortUnits: 0,
    parkingMissing: 0,
  };
  let loadError: string | null = null;
  let recentCleans: RecentClean[] = [];
  let recentIds: string[] = [];

  try {
    [units, cons, linens] = await Promise.all([
      listUnits(),
      listConsumables(),
      listLinens(),
    ]);
    if (admin) {
      const reserve = await listCentralReserveWithTargets();
      counts = buildCounts(units, cons, linens, reserve);
    }
  } catch (err) {
    loadError = (err as Error).message;
  }

  if (admin) {
    try {
      recentCleans = await listRecentCleans();
    } catch {
      // Non-critical — the dashboard still renders without the clean feed.
    }
  } else {
    // A cleaner's own last few units, so the one they're walking to is a tap
    // away instead of a search.
    try {
      recentIds = await recentUnitIdsFor(viewer?.name ?? "");
    } catch {
      // Non-critical.
    }
  }

  const roll = rollup(units, cons, linens);
  const summaries: UnitSummary[] = units.map((u) => {
    const r = roll.get(u.unit_id) ?? { consLow: 0, linenShort: 0 };
    return {
      unit_id: u.unit_id,
      name: u.name,
      property_name: u.property_name,
      parking_pass_label: u.parking_pass_label,
      parking_status: u.parking_status,
      last_cleaned_at: u.last_cleaned_at,
      consLow: r.consLow,
      linenShort: r.linenShort,
    };
  });

  return (
    <Container>
      {/* Compact header — cleaner-first: the unit picker leads the page. */}
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            Mason Homes
          </p>
          <h1 className="mt-0.5 font-display text-4xl font-black leading-none tracking-[-0.02em] text-ink-primary">
            Par
          </h1>
        </div>
        <Link
          href="/guide"
          className="shrink-0 rounded-control border border-line-strong bg-surface-3 px-3 py-2 text-xs font-semibold text-state-warn transition hover:border-red hover:text-ink-primary"
        >
          How to use →
        </Link>
      </div>

      {/* Nothing loaded: say so and stop. Rendering the picker and the KPIs
          here showed "No units match" and four green zeros under the error. */}
      {loadError && <SetupNotice message={loadError} />}

      {/* Portfolio status — the manager's numbers, first. It used to sit
          below all 63 unit cards (4,400px down on desktop, ten screens on a
          phone). Cleaners never see it: every card links to a manager page. */}
      {admin && !loadError && (
        <section className="mb-10 border-b border-line pb-8">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
            Portfolio status
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="Units to restock"
              value={counts.unitsBelowReorder}
              tone={counts.unitsBelowReorder > 0 ? "warn" : "ok"}
              hint="Below reorder point"
              href="/restock"
            />
            <StatCard
              label="Stockroom low"
              value={counts.centralLow}
              tone={counts.centralLow > 0 ? "warn" : "ok"}
              hint="Time to buy bulk"
              href="/central"
            />
            <StatCard
              label="Linen issues"
              value={counts.linenShortUnits}
              tone={counts.linenShortUnits > 0 ? "bad" : "ok"}
              hint="Units below par"
              href="/linens"
            />
            <StatCard
              label="Parking missing"
              value={counts.parkingMissing}
              tone={counts.parkingMissing > 0 ? "bad" : "ok"}
              hint="Passes unaccounted"
              href="/parking"
            />
          </div>

          {recentCleans.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
                Recent cleans
              </h3>
              <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-e1">
                {recentCleans.map((c, idx) => (
                  <div
                    key={`${c.unit_name}-${c.completed_at}-${idx}`}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                      idx > 0 ? "border-t border-line" : ""
                    }`}
                  >
                    <span className="font-medium text-ink-primary">
                      {c.unit_name ?? "—"}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-ink-muted">
                      {c.staff_name && <span>{c.staff_name}</span>}
                      <span className="tnum">{formatWhen(c.completed_at)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Find your unit — the cleaner's first and primary action; second for a manager. */}
      {!loadError && (
        <h2 className="mb-3 font-display text-lg font-bold text-ink-primary">
          Find your unit
          <span className="ml-2 text-sm font-medium text-ink-muted">
            {units.length}
          </span>
        </h2>
      )}

      {loadError ? null : units.length === 0 ? (
        <p className="text-sm text-ink-tertiary">
          No units yet.
          {process.env.NODE_ENV === "development" && (
            <> Run <code>supabase/schema.sql</code> to seed the portfolio.</>
          )}
        </p>
      ) : (
        <UnitPicker
          units={summaries}
          recent={recentIds
            .map((id) => summaries.find((s) => s.unit_id === id))
            .filter((s): s is UnitSummary => !!s)}
        />
      )}

    </Container>
  );
}
