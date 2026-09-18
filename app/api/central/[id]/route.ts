import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import { getViewer } from "@/lib/auth-context";
import { linenLabel } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Stock actions on a central reserve item: receive a delivery (add), set the
// counted on-hand amount (count, absolute), and/or adjust the reorder point or
// par (target) level. Every change is recorded to the audit log.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (viewer?.role !== "admin")
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const add = body.add === undefined ? null : Number(body.add);
  const count = body.count === undefined ? null : Number(body.count);
  const reorder = body.reorder_point === undefined ? null : Number(body.reorder_point);
  const par = body.par_level === undefined ? null : Number(body.par_level);

  if (add !== null && (!Number.isInteger(add) || add < 1)) {
    return NextResponse.json({ error: "Amount to receive must be a positive whole number." }, { status: 400 });
  }
  if (count !== null && (!Number.isInteger(count) || count < 0)) {
    return NextResponse.json({ error: "Counted amount must be zero or a positive whole number." }, { status: 400 });
  }
  if (reorder !== null && (!Number.isInteger(reorder) || reorder < 0)) {
    return NextResponse.json({ error: "Reorder point must be zero or a positive whole number." }, { status: 400 });
  }
  if (par !== null && (!Number.isInteger(par) || par < 0)) {
    return NextResponse.json({ error: "Par level must be zero or a positive whole number." }, { status: 400 });
  }

  try {
    const sb = getSupabase();
    const { data: row, error: rErr } = await sb
      .from("central_reserve")
      .select("item_name, category, quantity_on_hand, reorder_point, par_level")
      .eq("id", id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!row) return NextResponse.json({ error: "Item not found." }, { status: 404 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (add !== null) patch.quantity_on_hand = row.quantity_on_hand + add;
    if (count !== null) patch.quantity_on_hand = count; // absolute recount wins
    if (reorder !== null) patch.reorder_point = reorder;
    if (par !== null) patch.par_level = par;

    const { error } = await sb.from("central_reserve").update(patch).eq("id", id);
    if (error) throw new Error(error.message);

    // Record what changed.
    const label = row.category === "linen" ? linenLabel(row.item_name) : row.item_name;
    const actor = viewer?.name ?? "Unknown";
    if (count !== null) {
      await logAudit({ actor, action: "Counted central", item: label, detail: `${row.quantity_on_hand} → ${count}` });
    }
    if (add !== null) {
      await logAudit({ actor, action: "Received central", item: label, detail: `+${add} (→ ${row.quantity_on_hand + add})` });
    }
    if (reorder !== null || par !== null) {
      const parts: string[] = [];
      if (par !== null) parts.push(`par ${row.par_level} → ${par}`);
      if (reorder !== null) parts.push(`reorder ${row.reorder_point} → ${reorder}`);
      await logAudit({ actor, action: "Central targets", item: label, detail: parts.join(", ") });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}
