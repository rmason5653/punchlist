import { redirect } from "next/navigation";
import { buildLinenIntegrity, listLinens, listUnits } from "@/lib/inventory";
import { isAdmin } from "@/lib/auth-context";
import { Container, EmptyState, PageHeader, SetupNotice } from "@/app/components/ui";
import type { UnitLinens } from "@/lib/inventory";
import LinensClient from "./LinensClient";

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
        <LinensClient
          units={sorted.map(({ unit, linens, short }) => ({
            unit_id: unit.unit_id,
            name: unit.name,
            property_name: unit.property_name,
            linens,
            short: short.length,
          }))}
        />
      )}
    </Container>
  );
}
