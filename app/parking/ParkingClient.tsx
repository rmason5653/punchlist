"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill, formatWhen } from "@/app/components/ui";
import { useToast } from "@/app/components/Toast";
import type { ParkingStatus } from "@/lib/types";

interface ParkingUnit {
  unit_id: string;
  name: string;
  parking_pass_label: string;
  parking_status: ParkingStatus;
  parking_confirmed_at: string | null;
}

export default function ParkingClient({ units }: { units: ParkingUnit[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function setStatus(u: ParkingUnit, status: "ok" | "missing") {
    const id = u.unit_id;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/units/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parking_status: status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not update.");
      }
      toast(`${u.name}: pass marked ${status === "ok" ? "present" : "missing"}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      {error && (
        <p className="mb-3 text-sm text-state-bad" role="alert">
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-e1">
        {units.map((u, idx) => {
          const missing = u.parking_status === "missing";
          return (
            <div
              key={u.unit_id}
              className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                idx > 0 ? "border-t border-line" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink-primary">
                  {u.name}
                </div>
                <div className="text-[11px] text-ink-muted">
                  {u.parking_pass_label} ·{" "}
                  {missing
                    ? "flagged missing"
                    : `confirmed ${formatWhen(u.parking_confirmed_at)}`}
                </div>
              </div>

              {missing ? <Pill tone="bad">Missing</Pill> : <Pill tone="ok">OK</Pill>}

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatus(u, "ok")}
                  disabled={busyId === u.unit_id}
                  className="rounded-control border border-line-strong bg-surface-3 px-3 py-1.5 text-xs font-semibold text-ink-secondary transition hover:border-[rgba(31,138,76,.5)] hover:text-state-ok disabled:opacity-50"
                >
                  Present
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(u, "missing")}
                  disabled={busyId === u.unit_id}
                  className="rounded-control border border-line-strong bg-surface-3 px-3 py-1.5 text-xs font-semibold text-ink-tertiary transition hover:border-red hover:text-state-bad disabled:opacity-50"
                >
                  Missing
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
