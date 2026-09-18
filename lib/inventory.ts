import { getSupabase } from "./supabase";
import { needsRestock, restockNeeded } from "./rules";
import type {
  CentralReserveItem,
  ConsumableItem,
  ConsumablePar,
  LinenPar,
  PullLogEntry,
  Settings,
  StockAuditEntry,
  Unit,
} from "./types";

export async function getSettings(): Promise<Settings> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("settings")
    .select("default_turnover_frequency, buffer_turnovers, central_buffer")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as Settings | null;
  return {
    default_turnover_frequency: row?.default_turnover_frequency ?? 3,
    buffer_turnovers: row?.buffer_turnovers ?? 1,
    central_buffer: Number(row?.central_buffer ?? 2),
  };
}

/** Distinct consumable items with their (global) leave-behind. */
export async function listConsumableItems(): Promise<ConsumableItem[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("consumable_par")
    .select("item_name, sort, leave_behind, fixed_par")
    .order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  const seen = new Map<string, ConsumableItem>();
  for (const r of (data ?? []) as ConsumableItem[]) {
    if (!seen.has(r.item_name)) seen.set(r.item_name, r);
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// Raw reads
// ---------------------------------------------------------------------------

export async function listUnits(): Promise<Unit[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("units")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Unit[];
}

export async function getUnit(id: string): Promise<Unit | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("units")
    .select("*")
    .eq("unit_id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Unit) ?? null;
}

export async function listConsumables(unitId?: string): Promise<ConsumablePar[]> {
  const sb = getSupabase();
  let q = sb.from("consumable_par").select("*").order("sort", { ascending: true });
  if (unitId) q = q.eq("unit_id", unitId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ConsumablePar[];
}

export async function listLinens(unitId?: string): Promise<LinenPar[]> {
  const sb = getSupabase();
  let q = sb.from("linen_par").select("*").order("sort", { ascending: true });
  if (unitId) q = q.eq("unit_id", unitId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as LinenPar[];
}

export async function listCentralReserve(): Promise<CentralReserveItem[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("central_reserve")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CentralReserveItem[];
}

/** How many weeks of pull history set the Stockroom's targets. */
export const VELOCITY_WEEKS = 4;

/**
 * Weekly use of each consumable, from what was actually pulled from the
 * Stockroom over the last VELOCITY_WEEKS weeks. A log younger than the
 * window is divided by the history it really has (never less than a week).
 * Items with no pulls in the window are absent — the caller can't tell
 * "unused" from "new", so it keeps the estimate for those.
 */
export async function weeklyPullVelocity(): Promise<Map<string, number>> {
  const sb = getSupabase();
  const since = new Date(Date.now() - VELOCITY_WEEKS * 7 * 86_400_000).toISOString();
  const [recent, oldest] = await Promise.all([
    sb
      .from("central_pull_log")
      .select("item_name, quantity")
      .eq("category", "consumable")
      .gte("pulled_at", since),
    sb.from("central_pull_log").select("pulled_at").order("pulled_at", { ascending: true }).limit(1),
  ]);
  if (recent.error) throw new Error(recent.error.message);
  if (oldest.error) throw new Error(oldest.error.message);
  const firstAt = oldest.data?.[0]?.pulled_at
    ? new Date((oldest.data[0] as { pulled_at: string }).pulled_at).getTime()
    : Date.now();
  const weeks = Math.max(1, Math.min(VELOCITY_WEEKS, (Date.now() - firstAt) / (7 * 86_400_000)));
  const totals = new Map<string, number>();
  for (const p of (recent.data ?? []) as { item_name: string; quantity: number }[]) {
    totals.set(p.item_name, (totals.get(p.item_name) ?? 0) + p.quantity);
  }
  return new Map([...totals].map(([k, v]) => [k, v / weeks]));
}

/**
 * The Stockroom with targets that mean something: for calculated consumables,
 * reorder = one week of real pulls and par = that × the Stockroom buffer from
 * Settings. The stored numbers assumed every unit turns over three times a
 * week and is refilled in full, which flagged nearly everything Low. Linens
 * and bulk supplies keep their hand-set targets; an item with no pull history
 * keeps the estimate until it has one.
 */
export async function listCentralReserveWithTargets(): Promise<CentralReserveItem[]> {
  const [reserve, velocity, settings] = await Promise.all([
    listCentralReserve(),
    weeklyPullVelocity(),
    getSettings(),
  ]);
  return reserve.map((r) => {
    if (r.category !== "consumable" || r.fixed_par) return { ...r, target_basis: "set" as const };
    const v = velocity.get(r.item_name);
    if (v === undefined) return { ...r, target_basis: "calculated" as const };
    const weekly = Math.round(v);
    return {
      ...r,
      reorder_point: weekly,
      par_level: Math.round(weekly * settings.central_buffer),
      target_basis: "pulls" as const,
      weekly_use: weekly,
    };
  });
}

export interface PullLogQuery {
  /** Matches item, person, or destination unit (case-insensitive substring). */
  q?: string;
  /** ISO instants; inclusive. */
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
}

/** The Stockroom audit trail, newest first, filtered and paged on the
 *  server so the whole history stays reachable. */
export async function queryPullLog(opts: PullLogQuery = {}): Promise<PullLogEntry[]> {
  const sb = getSupabase();
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 5000);
  const offset = Math.max(opts.offset ?? 0, 0);
  let q = sb
    .from("central_pull_log")
    .select("*")
    .order("pulled_at", { ascending: false });
  const term = opts.q?.trim();
  if (term) {
    // PostgREST's or() splits on commas and parens; item, person and unit
    // names never contain them, so drop them rather than quote them.
    const pat = `*${term.replace(/[,()"]/g, "").replace(/\s+/g, "*")}*`;
    q = q.or(
      `item_name.ilike.${pat},staff_name.ilike.${pat},destination_name.ilike.${pat}`,
    );
  }
  if (opts.from) q = q.gte("pulled_at", opts.from);
  if (opts.to) q = q.lte("pulled_at", opts.to);
  const { data, error } = await q.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as PullLogEntry[];
}

/** Recent manual stock changes for the admin Activity view, newest first. */
export async function listStockAudit(limit = 200): Promise<StockAuditEntry[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("stock_audit")
    .select("*")
    .order("at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as StockAuditEntry[];
}

export interface RecentClean {
  completed_at: string;
  staff_name: string | null;
  unit_name: string | null;
  parking_ok: boolean | null;
  linens_ok: boolean | null;
}

/** Recently completed cleans, newest first, with the unit name embedded. */
export async function listRecentCleans(limit = 8): Promise<RecentClean[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("clean_log")
    .select("completed_at, staff_name, parking_ok, linens_ok, units(name)")
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as {
      completed_at: string;
      staff_name: string | null;
      parking_ok: boolean | null;
      linens_ok: boolean | null;
      units: { name: string } | { name: string }[] | null;
    };
    const unit = Array.isArray(row.units) ? row.units[0] : row.units;
    return {
      completed_at: row.completed_at,
      staff_name: row.staff_name,
      parking_ok: row.parking_ok,
      linens_ok: row.linens_ok,
      unit_name: unit?.name ?? null,
    };
  });
}

/** Unit ids one person cleaned most recently, newest first, no repeats. */
export async function recentUnitIdsFor(staffName: string, limit = 5): Promise<string[]> {
  if (!staffName) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from("clean_log")
    .select("unit_id, completed_at")
    .eq("staff_name", staffName)
    .order("completed_at", { ascending: false })
    .limit(limit * 4);
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  for (const r of (data ?? []) as { unit_id: string | null }[]) {
    if (r.unit_id) seen.add(r.unit_id);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

// ---------------------------------------------------------------------------
// Derived views (computed from the raw reads)
// ---------------------------------------------------------------------------

export interface UnitRestock {
  unit: Unit;
  items: { par: ConsumablePar; needed: number }[];
}

/** The weekly run — every unit with a closet item below par, and how many
 *  of each to bring. Includes remainders from a refill the Stockroom
 *  couldn't cover in full. */
export function buildRestockRun(
  units: Unit[],
  consumables: ConsumablePar[],
): UnitRestock[] {
  const byUnit = new Map<string, UnitRestock>();
  for (const u of units) byUnit.set(u.unit_id, { unit: u, items: [] });
  for (const c of consumables) {
    if (needsRestock(c)) {
      const needed = restockNeeded(c);
      if (needed > 0) byUnit.get(c.unit_id)?.items.push({ par: c, needed });
    }
  }
  return units
    .map((u) => byUnit.get(u.unit_id)!)
    .filter((r) => r.items.length > 0);
}

export interface UnitLinens {
  unit: Unit;
  linens: LinenPar[];
  short: LinenPar[];
}

/** View 3 — par vs actual linens per unit, flagging any unit below par. */
export function buildLinenIntegrity(
  units: Unit[],
  linens: LinenPar[],
): UnitLinens[] {
  const byUnit = new Map<string, LinenPar[]>();
  for (const l of linens) {
    const arr = byUnit.get(l.unit_id) ?? [];
    arr.push(l);
    byUnit.set(l.unit_id, arr);
  }
  return units.map((u) => {
    const ls = byUnit.get(u.unit_id) ?? [];
    return {
      unit: u,
      linens: ls,
      short: ls.filter((l) => l.current_actual < l.par_count),
    };
  });
}

export interface DashboardCounts {
  unitsBelowReorder: number;
  centralLow: number;
  linenShortUnits: number;
  parkingMissing: number;
}

export function buildCounts(
  units: Unit[],
  consumables: ConsumablePar[],
  linens: LinenPar[],
  reserve: CentralReserveItem[],
): DashboardCounts {
  const restock = buildRestockRun(units, consumables);
  const integrity = buildLinenIntegrity(units, linens);
  return {
    unitsBelowReorder: restock.length,
    centralLow: reserve.filter((r) => r.quantity_on_hand <= r.reorder_point).length,
    linenShortUnits: integrity.filter((u) => u.short.length > 0).length,
    parkingMissing: units.filter((u) => u.parking_status === "missing").length,
  };
}
