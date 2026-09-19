import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

// Callers: the Parking view's confirmation toggle, the manager's bagged-
// bedding controls (pullout couch, rollaway count), the per-unit turnover
// override, and retire/restore. Each sends only its field. All are manager
// actions — a cleaner records parking through the clean flow, which has its
// own route.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (body.parking_status !== undefined) {
    const status = String(body.parking_status);
    if (status !== "ok" && status !== "missing") {
      return NextResponse.json({ error: "Invalid parking status." }, { status: 400 });
    }
    patch.parking_status = status;
    if (status === "ok") patch.parking_confirmed_at = new Date().toISOString();
  }

  if (body.has_pullout !== undefined) {
    if (typeof body.has_pullout !== "boolean") {
      return NextResponse.json({ error: "has_pullout must be true or false." }, { status: 400 });
    }
    patch.has_pullout = body.has_pullout;
  }

  if (body.rollaway_beds !== undefined) {
    const n = Number(body.rollaway_beds);
    if (!Number.isInteger(n) || n < 0) {
      return NextResponse.json(
        { error: "Rollaway beds must be a whole number." },
        { status: 400 },
      );
    }
    patch.rollaway_beds = n;
  }

  // Turnovers a week for this unit alone; null goes back to the global default.
  let recalc = false;
  if (body.turnover_frequency !== undefined) {
    if (body.turnover_frequency === null || body.turnover_frequency === "") {
      patch.turnover_frequency = null;
    } else {
      const n = Number(body.turnover_frequency);
      if (!Number.isInteger(n) || n < 1 || n > 14) {
        return NextResponse.json(
          { error: "Turnovers a week must be a whole number from 1 to 14." },
          { status: 400 },
        );
      }
      patch.turnover_frequency = n;
    }
    recalc = true;
  }

  // Retire hides the unit from every list and keeps its history; restore undoes it.
  if (body.retired !== undefined) {
    if (typeof body.retired !== "boolean") {
      return NextResponse.json({ error: "retired must be true or false." }, { status: 400 });
    }
    patch.retired_at = body.retired ? new Date().toISOString() : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const sb = getSupabase();
    const { error } = await sb.from("units").update(patch).eq("unit_id", id);
    if (error) throw new Error(error.message);
    if (recalc) {
      const { error: rErr } = await sb.rpc("recalc_par");
      if (rErr) throw new Error(rErr.message);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}
