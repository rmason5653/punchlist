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

export interface PullVelocity {
  /** Units per week. */
  weekly: number;
  /** "recent": from the last VELOCITY_WEEKS weeks of pulls. "history": no
   *  pull in that window, so the average over the item's whole pull log. */
  basis: "recent" | "history";
}

/**
 * Weekly use of each consumable, from what was actually pulled from the
 * Stockroom. The last VELOCITY_WEEKS weeks when there are pulls in them (a
 * log younger than the window is divided by the history it really has, never
 * less than a week); otherwise the average over everything ever pulled, so a
 * quiet month doesn't drop an item back to the old theoretical target. Items
 * never pulled are absent — the caller keeps the estimate for those.
 */
export async function weeklyPullVelocity(): Promise<Map<string, PullVelocity>> {
  const sb = getSupabase();
  // The whole consumable pull log, oldest first. A weekly run across the
  // portfolio is a few hundred rows, so years fit under the cap.
  const { data, error } = await sb
    .from("central_pull_log")
    .select("item_name, quantity, pulled_at")
    .eq("category", "consumable")
    .order("pulled_at", { ascending: true })
    .limit(20000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { item_name: string; quantity: number; pulled_at: string }[];
  const WEEK = 7 * 86_400_000;
  const now = Date.now();
  const since = now - VELOCITY_WEEKS * WEEK;
  const logStart = rows.length ? new Date(rows[0].pulled_at).getTime() : now;
  const windowWeeks = Math.max(1, Math.min(VELOCITY_WEEKS, (now - logStart) / WEEK));

  const recent = new Map<string, number>();
  const all = new Map<string, { qty: number; firstAt: number }>();
  for (const p of rows) {
    const t = new Date(p.pulled_at).getTime();
    if (t >= since) recent.set(p.item_name, (recent.get(p.item_name) ?? 0) + p.quantity);
    const a = all.get(p.item_name);
    if (a) a.qty += p.quantity;
    else all.set(p.item_name, { qty: p.quantity, firstAt: t });
  }
  const out = new Map<string, PullVelocity>();
  for (const [item, a] of all) {
    const r = recent.get(item);
    if (r !== undefined) out.set(item, { weekly: r / windowWeeks, basis: "recent" });
    else out.set(item, { weekly: a.qty / Math.max(1, (now - a.firstAt) / WEEK), basis: "history" });
  }
  return out;
}

/**
 * The Stockroom with targets that mean something: for calculated consumables,
 * reorder = one week of real pulls and par = that × the Stockroom buffer from
 * Settings. The stored numbers assumed every unit turns over three times a
 * week and is refilled in full, which flagged nearly everything Low. Linens
 * and bulk supplies keep their hand-set targets; an item with no pull history
 * keeps the estimate until it has one, and one with no pull in the window
 * uses its whole-log average rather than falling back to the estimate.
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
    if (!v) return { ...r, target_basis: "calculated" as const };
    const weekly = Math.round(v.weekly);
    return {
      ...r,
      reorder_point: weekly,
      par_level: Math.round(weekly * settings.central_buffer),
      target_basis: v.basis === "recent" ? ("pulls" as const) : ("history" as const),
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

/** Every unit one person has ever cleaned, most recent first, no repeats. */
export async function unitIdsCleanedBy(staffName: string): Promise<string[]> {
  if (!staffName) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from("clean_log")
    .select("unit_id, completed_at")
    .eq("staff_name", staffName)
    .order("completed_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  for (const r of (data ?? []) as { unit_id: string | null }[]) if (r.unit_id) seen.add(r.unit_id);
  return [...seen];
}

export interface MeasuredTurnover {
  weeks: number;
  cleans: number;
  /** Distinct units with at least one clean in the window. */
  units: number;
  /** Cleans per unit per week, across the units that were cleaned at all. */
  perUnitPerWeek: number;
}

/** What the clean log says about turnover, to set beside the number in
 *  Settings that par is built on. */
export async function measuredTurnover(weeks = 8): Promise<MeasuredTurnover> {
  const sb = getSupabase();
  const since = new Date(Date.now() - weeks * 7 * 86_400_000).toISOString();
  const { data, error } = await sb
    .from("clean_log")
    .select("unit_id")
    .gte("completed_at", since)
    .limit(10000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { unit_id: string | null }[];
  const units = new Set(rows.map((r) => r.unit_id).filter((id): id is string => !!id));
  return {
    weeks,
    cleans: rows.length,
    units: units.size,
    perUnitPerWeek: units.size ? rows.length / units.size / weeks : 0,
  };
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
  /** Consumables and bulk supplies at or below reorder. */
  centralLow: number;
  /** Linen replacement stock at or below reorder — counted apart, since the
   *  Stockroom rarely holds spare linen and fifteen zeros would drown the
   *  number that drives a shopping trip. */
  linenStockLow: number;
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
    centralLow: reserve.filter((r) => r.category !== "linen" && r.quantity_on_hand <= r.reorder_point).length,
    linenStockLow: reserve.filter((r) => r.category === "linen" && r.quantity_on_hand <= r.reorder_point).length,
    linenShortUnits: integrity.filter((u) => u.short.length > 0).length,
    parkingMissing: units.filter((u) => u.parking_status === "missing").length,
  };
}
