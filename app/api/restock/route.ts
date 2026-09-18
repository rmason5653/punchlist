import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { getViewer } from "@/lib/auth-context";
import { listActiveStaffNames } from "@/lib/users-db";
import { getSupabase } from "@/lib/supabase";
import { getUnit, listCentralReserve, listConsumables } from "@/lib/inventory";
import { needsRestock, restockNeeded } from "@/lib/rules";

export const dynamic = "force-dynamic";

// Run the weekly restock for one unit. For each closet item below par, pull
// what the Stockroom actually has — up to what's needed — draw the Stockroom
// down by that much, and log the movement. If the Stockroom is short, the
// closet is raised by what was delivered and the remainder stays on the run,
// instead of logging a full pull that never physically happened.
// Returns how many items moved and which are still short.
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
    const [unit, cons, reserve] = await Promise.all([
      getUnit(unitId),
      listConsumables(unitId),
      listCentralReserve(),
    ]);
    if (!unit) return NextResponse.json({ error: "Unit not found." }, { status: 404 });

    const now = new Date().toISOString();
    let restocked = 0;
    const short: { item_name: string; by: number }[] = [];

    for (const c of cons.filter(needsRestock)) {
      const needed = restockNeeded(c);
      const cr = reserve.find((r) => r.item_name === c.item_name && r.category === "consumable");
      const available = Math.max(0, cr?.quantity_on_hand ?? 0);
      const qty = Math.min(needed, available);
      if (qty < needed) short.push({ item_name: c.item_name, by: needed - qty });
      if (qty <= 0) continue;

      if (cr) {
        const { error } = await sb
          .from("central_reserve")
          .update({ quantity_on_hand: available - qty, updated_at: now })
          .eq("id", cr.id);
        if (error) throw new Error(error.message);
      }
      const { error: cErr } = await sb
        .from("consumable_par")
        .update({ current_actual: c.current_actual + qty, updated_at: now })
        .eq("id", c.id);
      if (cErr) throw new Error(cErr.message);
      const { error: lErr } = await sb.from("central_pull_log").insert({
        staff_name: staff,
        item_name: c.item_name,
        category: "consumable",
        quantity: qty,
        destination_unit_id: unitId,
        destination_name: unit.name,
        reason: "weekly_restock",
      });
      if (lErr) throw new Error(lErr.message);
      restocked += 1;
    }

    return NextResponse.json({ ok: true, restocked, short });
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}
