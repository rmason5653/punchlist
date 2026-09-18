import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import { getViewer } from "@/lib/auth-context";
import { LINEN_SORT, linenLabel } from "@/lib/constants";
import { getUnit } from "@/lib/inventory";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Managers set per-unit linen par counts and choose which sized bedding each
// unit carries (King vs Queen). Cleaners never touch these numbers. Every
// change is recorded to the audit log.
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (viewer?.role !== "admin")
    return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const unitId = String(body.unit_id ?? "");
  const linenType = String(body.linen_type ?? "");
  const par = Number(body.par_count);

  if (!unitId || !linenType)
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  if (!LINEN_SORT.has(linenType))
    return NextResponse.json({ error: "Unknown linen type." }, { status: 400 });
  if (!Number.isInteger(par) || par < 0)
    return NextResponse.json({ error: "Par must be a whole number." }, { status: 400 });

  try {
    const sb = getSupabase();
    const { data: existing } = await sb
      .from("linen_par")
      .select("id, par_count")
      .eq("unit_id", unitId)
      .eq("linen_type", linenType)
      .maybeSingle();

    if (existing) {
      // Update par only — never silently reset the counted actual.
      const { error } = await sb
        .from("linen_par")
        .update({ par_count: par })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      // New row starts stocked to par (assumed placed), so it isn't flagged short.
      const { error } = await sb.from("linen_par").insert({
        unit_id: unitId,
        linen_type: linenType,
        sort: LINEN_SORT.get(linenType) ?? 0,
        par_count: par,
        current_actual: par,
      });
      if (error) throw new Error(error.message);
    }

    const unit = await getUnit(unitId).catch(() => null);
    await logAudit({
      actor: viewer?.name ?? "Unknown",
      action: existing ? "Linen par" : "Linen added",
      item: linenLabel(linenType),
      unit_name: unit?.name ?? null,
      detail: existing ? `${existing.par_count} → ${par}` : `par ${par}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const viewer = await getViewer();
  if (viewer?.role !== "admin")
    return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const unitId = String(body.unit_id ?? "");
  const linenType = String(body.linen_type ?? "");
  if (!unitId || !linenType)
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });

  try {
    const sb = getSupabase();
    const { error } = await sb
      .from("linen_par")
      .delete()
      .eq("unit_id", unitId)
      .eq("linen_type", linenType);
    if (error) throw new Error(error.message);

    const unit = await getUnit(unitId).catch(() => null);
    await logAudit({
      actor: viewer?.name ?? "Unknown",
      action: "Linen removed",
      item: linenLabel(linenType),
      unit_name: unit?.name ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}
