import { redirect } from "next/navigation";
import { buildLinenIntegrity, listLinens, listUnits } from "@/lib/inventory";
import { isAdmin } from "@/lib/auth-context";
import { linenLabel } from "@/lib/constants";
import {
  Container,
  EmptyState,
  ParBar,
  PageHeader,
  Pill,
  SetupNotice,
} from "@/app/components/ui";
import PullDialog from "@/app/components/PullDialog";
import type { UnitLinens } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export default async function LinensPage() {
  // Managers only. Middleware gates the path; this is the second lock.
  if (!(await isAdmin())) redirect("/");

  let integrity: UnitLinens[] = [];
  let loadError: string | null = null;

  try {
    const [units, linens] = await Promise.all([listUnits(), listLinens()]);
    integrity = buildLinenIntegrity(units, linens);
  } catch (err) {
    loadError = (err as Error).message;
  }

  // Units below par float to the top — this is the loss-detection view.
  const sorted = [...integrity].sort((a, b) => b.short.length - a.short.length);
  const shortUnits = integrity.filter((u) => u.short.length > 0).length;

  return (
    <Container>
      <PageHeader eyebrow="Loss check · managers" title="Linen integrity">
        {!loadError && (
          <p className="text-sm text-ink-tertiary">
            {integrity.length === 0 ? (
              "No units yet"
            ) : shortUnits > 0 ? (
              <span className="text-state-bad">{shortUnits} units below par</span>
            ) : (
              "Every unit at par"
            )}
          </p>
        )}
      </PageHeader>

      {loadError ? (
        <SetupNotice message={loadError} />
      ) : integrity.length === 0 ? (
        <EmptyState punch="No units" line="Linens appear here once the portfolio is loaded." />
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          {sorted.map(({ unit, linens, short }) => {
            const isShort = short.length > 0;
            return (
              <div
                key={unit.unit_id}
                className={`rounded-card border bg-surface-2 p-5 shadow-e1 ${
                  isShort ? "border-[rgba(226,6,2,.35)]" : "border-line"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-display text-base font-bold text-ink-primary">
                    {unit.name}
                  </div>
                  {isShort ? (
                    <Pill tone="bad">{short.length} short</Pill>
                  ) : (
                    <Pill tone="ok">At par</Pill>
                  )}
                </div>

                <ul className="mt-3 space-y-2.5">
                  {linens.map((l) => {
                    const shortBy = l.par_count - l.current_actual;
                    const isRowShort = shortBy > 0;
                    return (
                      <li key={l.id}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-ink-secondary">
                            {linenLabel(l.linen_type)}
                          </span>
                          <div className="flex items-center gap-3">
                            <span
                              className={`tnum text-xs ${
                                isRowShort ? "text-state-bad" : "text-ink-tertiary"
                              }`}
                            >
                              {l.current_actual} / {l.par_count}
                            </span>
                            {isRowShort && (
                              <PullDialog
                                label={`Replace ${shortBy}`}
                                variant="small"
                                prefill={{
                                  item_name: l.linen_type,
                                  category: "linen",
                                  unit_id: unit.unit_id,
                                  reason: "damage_replacement",
                                  quantity: shortBy,
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="mt-1.5">
                          <ParBar
                            actual={l.current_actual}
                            par={l.par_count}
                            tone={isRowShort ? "bad" : "ok"}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Container>
  );
}
