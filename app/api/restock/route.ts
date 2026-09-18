import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { getViewer } from "@/lib/auth-context";
import { listActiveStaffNames } from "@/lib/users-db";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Run the weekly restock for one unit: refill every below-reorder consumable to
// par, drawing down central and logging each transfer (handled atomically by
// the restock_unit RPC). Returns the number of items refilled.
export async function POST(req: Request) {
  // Managers only. Cleaners flag what's low during a clean; the refill itself
  // (and the stock drawdown it writes) is a manager action.
  const viewer = await getViewer();
  if (viewer?.role !== "admin")
    return NextResponse.json(
      { error: "Only a manager can run a restock." },
      { status: 403 },
    );

  const body = await req.json().catch(() => ({}));
  const staff = String(body.staff_name ?? "").trim();
  const unitId = String(body.unit_id ?? "");

  if (!staff || !unitId) {
    return NextResponse.json(
      { error: "Staff name and unit are required." },
      { status: 400 },
    );
  }

  // Whoever the client names is who the pull log will credit, so the name has
  // to be a manager too — otherwise a stale tab or a hand-made request could
  // still write a cleaner into the log, which is what the manager-only rule
  // exists to prevent. The caller's own name needs no lookup (the session is
  // signed), which is also the case "Refill all" hits on every unit.
  if (staff !== viewer.name) {
    const managers = await listActiveStaffNames("admin");
    // An empty roster means the users table isn't set up yet — the rest of the
    // app degrades open there rather than blocking work, so do the same.
    if (managers.length > 0 && !managers.includes(staff)) {
      return NextResponse.json(
        {
          error: `"${staff}" isn't an active manager. A restock is logged to whoever ran it.`,
        },
        { status: 400 },
      );
    }
  }

  try {
    const sb = getSupabase();
    const { data, error } = await sb.rpc("restock_unit", {
      p_staff: staff,
      p_unit: unitId,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, restocked: data ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}
