import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

// Update the global par inputs (and optionally per-item leave-behind), then
// recompute all calculated par from them.
export async function PATCH(req: Request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (body.default_turnover_frequency !== undefined) {
    const n = Number(body.default_turnover_frequency);
    if (!Number.isInteger(n) || n < 1)
      return NextResponse.json({ error: "Turnover frequency must be a whole number ≥ 1." }, { status: 400 });
    patch.default_turnover_frequency = n;
  }
  if (body.buffer_turnovers !== undefined) {
    const n = Number(body.buffer_turnovers);
    if (!Number.isInteger(n) || n < 0)
      return NextResponse.json({ error: "Buffer must be a whole number ≥ 0." }, { status: 400 });
    patch.buffer_turnovers = n;
  }
  if (body.central_buffer !== undefined) {
    const n = Number(body.central_buffer);
    if (!Number.isFinite(n) || n <= 0)
      return NextResponse.json({ error: "Central buffer must be a positive number." }, { status: 400 });
    patch.central_buffer = n;
  }

  const leaveBehind: { item_name: string; value: number }[] = Array.isArray(body.leave_behind)
    ? body.leave_behind
    : [];
  for (const lb of leaveBehind) {
    const n = Number(lb.value);
    if (!Number.isInteger(n) || n < 0)
      return NextResponse.json({ error: `Leave-behind for ${lb.item_name} must be a whole number ≥ 0.` }, { status: 400 });
  }

  try {
    const sb = getSupabase();

    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString();
      const { error } = await sb.from("settings").update(patch).eq("id", 1);
      if (error) throw new Error(error.message);
    }

    for (const lb of leaveBehind) {
      const { error } = await sb
        .from("consumable_par")
        .update({ leave_behind: Number(lb.value), updated_at: new Date().toISOString() })
        .eq("item_name", lb.item_name);
      if (error) throw new Error(error.message);
    }

    // Recompute closet par, reorder, and central targets from the new inputs.
    const { error: rErr } = await sb.rpc("recalc_par");
    if (rErr) throw new Error(rErr.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}
