import { redirect } from "next/navigation";
import { listUnits } from "@/lib/inventory";
import { isAdmin } from "@/lib/auth-context";
import { Container, PageHeader, SetupNotice } from "@/app/components/ui";
import type { Unit } from "@/lib/types";
import ParkingClient from "./ParkingClient";

export const dynamic = "force-dynamic";

export default async function ParkingPage() {
  // Managers only. Middleware gates the path; this is the second lock.
  if (!(await isAdmin())) redirect("/");

  let units: Unit[] = [];
  let loadError: string | null = null;

  try {
    units = await listUnits();
  } catch (err) {
    loadError = (err as Error).message;
  }

  const withPass = units.filter((u) => u.has_parking_pass);
  const noPass = units.filter((u) => !u.has_parking_pass);
  const missing = withPass.filter((u) => u.parking_status === "missing").length;

  return (
    <Container>
      <PageHeader eyebrow="View 5" title="Parking passes">
        {!loadError && (
          <p className="text-sm text-ink-tertiary">
            {missing > 0 ? (
              <span className="text-state-bad">{missing} missing</span>
            ) : (
              "All accounted for"
            )}
          </p>
        )}
      </PageHeader>

      {loadError ? (
        <SetupNotice message={loadError} />
      ) : (
        <div className="space-y-8">
          <ParkingClient
            units={withPass.map((u) => ({
              unit_id: u.unit_id,
              name: u.name,
              parking_pass_label: u.parking_pass_label,
              parking_status: u.parking_status,
              parking_confirmed_at: u.parking_confirmed_at,
            }))}
          />

          {noPass.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-muted">
                No parking pass
              </h2>
              <div className="flex flex-wrap gap-2">
                {noPass.map((u) => (
                  <span
                    key={u.unit_id}
                    className="rounded-control border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-tertiary"
                  >
                    {u.name}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Container>
  );
}
