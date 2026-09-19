import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import { getUnit, listConsumables, listLinens } from "@/lib/inventory";

export const dynamic = "force-dynamic";

interface CleanBody {
  staff_name?: string;
  parking?: "ok" | "missing" | null;
  consumables?: { id: string; low: boolean }[];
  linens_ok?: boolean;
  linen_flags?: { linen_type: string; actual: number }[];
}

// Records a completed clean: confirms parking, applies the cleaner's consumable
// "needs restock" taps, reconciles linens, and writes a clean_log row.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as CleanBody;

  try {
    const unit = await getUnit(id);
    if (!unit) {
      return NextResponse.json({ error: "Unit not found." }, { status: 404 });
    }

    const sb = getSupabase();
    const now = new Date().toISOString();

    // 1. Unit: stamp the clean, confirm parking when the unit has a pass.
    const unitPatch: Record<string, unknown> = { last_cleaned_at: now };
    let parkingOk: boolean | null = null;
    if (unit.has_parking_pass && (body.parking === "ok" || body.parking === "missing")) {
      unitPatch.parking_status = body.parking;
      unitPatch.parking_confirmed_at = body.parking === "ok" ? now : unit.parking_confirmed_at;
      parkingOk = body.parking === "ok";
    }
    const { error: uErr } = await sb.from("units").update(unitPatch).eq("unit_id", id);
    if (uErr) throw new Error(uErr.message);

    // 2. Consumables: a flag lowers the count to the reorder point. An item
    //    that isn't flagged is left exactly as it was — cleaners never top a
    //    closet up, so nothing they do can raise a count. (The old rule wrote
    //    unflagged items as full, which meant tapping a pre-flagged item back
    //    to "OK" quietly cancelled its restock with nothing pulled.)
    const cons = await listConsumables(id);
    const consById = new Map(cons.map((c) => [c.id, c]));
    const consUpdates = (body.consumables ?? [])
      .map((entry) => {
        const row = consById.get(entry.id);
        if (!row || !entry.low || row.current_actual <= row.reorder_point) return null;
        return { id: row.id, current_actual: row.reorder_point };
      })
      .filter((x): x is { id: string; current_actual: number } => x !== null);

    // 3. Linens: confirm match (all -> par) or apply specific flags.
    const linens = await listLinens(id);
    const flagByType = new Map(
      (body.linen_flags ?? []).map((f) => [f.linen_type, f.actual]),
    );
    const linensOk = body.linens_ok !== false;
    const linenUpdates = linens.map((l) => {
      let actual = l.par_count;
      if (!linensOk && flagByType.has(l.linen_type)) {
        const raw = Number(flagByType.get(l.linen_type));
        actual = Math.max(0, Math.min(l.par_count, Number.isFinite(raw) ? raw : l.par_count));
      }
      return { id: l.id, current_actual: actual };
    });

    await Promise.all([
      ...consUpdates.map((u) =>
        sb
          .from("consumable_par")
          .update({ current_actual: u.current_actual, updated_at: now })
          .eq("id", u.id),
      ),
      ...linenUpdates.map((u) =>
        sb
          .from("linen_par")
          .update({ current_actual: u.current_actual, updated_at: now })
          .eq("id", u.id),
      ),
    ]);

    // 4. Clean log, with what this clean flagged so a manager can see the
    //    routine being done (or rubber-stamped) from Home.
    const flagged = consUpdates
      .map((u) => consById.get(u.id)?.item_name)
      .filter((n): n is string => !!n);
    const { error: clErr } = await sb.from("clean_log").insert({
      unit_id: id,
      staff_name: body.staff_name?.trim() || null,
      parking_ok: parkingOk,
      linens_ok: linensOk,
      flagged_items: flagged,
    });
    if (clErr) throw new Error(clErr.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}
