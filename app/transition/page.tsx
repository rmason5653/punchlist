import { redirect } from "next/navigation";
import Link from "next/link";
import { cleanSummaryByUnit, listUnits, type UnitCleanSummary } from "@/lib/inventory";
import { isAdmin } from "@/lib/auth-context";
import { Container, PageHeader, Pill, SetupNotice, formatWhen } from "@/app/components/ui";
import type { Unit } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The in-house transition, one screen: which units have had a clean recorded
 * in Par (so an in-house cleaner has been through with the app) and which
 * haven't yet. Nothing here changes data; it makes the gap visible weekly.
 */
export default async function TransitionPage() {
  // Managers only. Middleware gates the path; this is the second lock.
  if (!(await isAdmin())) redirect("/");

  let units: Unit[] = [];
  let summary = new Map<string, UnitCleanSummary>();
  let loadError: string | null = null;
  try {
    [units, summary] = await Promise.all([listUnits(), cleanSummaryByUnit()]);
  } catch (err) {
    loadError = (err as Error).message;
  }

  const onPar = units.filter((u) => summary.has(u.unit_id)).length;
  const groups = new Map<string, Unit[]>();
  for (const u of units) {
    const arr = groups.get(u.property_name) ?? [];
    arr.push(u);
    groups.set(u.property_name, arr);
  }

  return (
    <Container>
      <PageHeader eyebrow="In-house transition · managers" title="Transition">
        {!loadError && units.length > 0 && (
          <p className="tnum text-sm text-ink-tertiary">
            <span className="text-ink-primary">{onPar}</span> of {units.length} units on Par
          </p>
        )}
      </PageHeader>

      {loadError ? (
        <SetupNotice message={loadError} />
      ) : (
        <>
          <p className="mb-6 max-w-2xl text-sm text-ink-tertiary">
            A unit is <b className="text-ink-secondary">on Par</b> once a clean has been
            recorded here. The rest are still with outside cleaners, or in-house
            but not logging yet. Every building below shows both.
          </p>

          <div className="space-y-8">
            {[...groups.entries()].map(([building, list]) => {
              const on = list.filter((u) => summary.has(u.unit_id)).length;
              return (
                <section key={building}>
                  <h2 className="mb-3 flex items-baseline gap-2 font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
                    {building}
                    <span className="tnum text-xs font-medium normal-case tracking-normal text-ink-muted">
                      {on} of {list.length} on Par
                    </span>
                  </h2>
                  <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-e1">
                    {list.map((u, idx) => {
                      const s = summary.get(u.unit_id);
                      return (
                        <div
                          key={u.unit_id}
                          className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm ${
                            idx > 0 ? "border-t border-line" : ""
                          }`}
                        >
                          {/* On a phone the name takes the first line and the
                              detail and pill wrap to a second. */}
                          <Link
                            href={`/unit/${u.unit_id}`}
                            className="min-w-0 basis-full font-medium text-ink-primary hover:underline sm:basis-0 sm:flex-1"
                          >
                            {u.name}
                          </Link>
                          <span className="tnum mr-auto text-xs text-ink-muted sm:mr-0">
                            {s
                              ? `Last clean ${formatWhen(s.last)}${s.who ? ` · ${s.who}` : ""} · ${s.count} ${
                                  s.count === 1 ? "clean" : "cleans"
                                }`
                              : "No cleans recorded"}
                          </span>
                          {s ? <Pill tone="ok">On Par</Pill> : <Pill tone="neutral">Not yet</Pill>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </Container>
  );
}
