import { getSupabase } from "./supabase";
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

// ---------------------------------------------------------------------------
// Derived views (computed from the raw reads)
// ---------------------------------------------------------------------------

export interface UnitRestock {
  unit: Unit;
  items: { par: ConsumablePar; needed: number }[];
}

/** View 1 — every unit with at least one consumable at/below reorder. */
export function buildRestockRun(
  units: Unit[],
  consumables: ConsumablePar[],
): UnitRestock[] {
  const byUnit = new Map<string, UnitRestock>();
  for (const u of units) byUnit.set(u.unit_id, { unit: u, items: [] });
  for (const c of consumables) {
    if (c.current_actual <= c.reorder_point) {
      const needed = c.closet_par - c.current_actual;
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
