// Pure rules shared by server and client code (nothing here touches the
// database, so client components can import it).

import type { ConsumablePar } from "./types";

/**
 * A closet item is on the restock run while it holds less than par. Cleaners
 * only ever lower a count to its reorder point and a refill only ever raises
 * it, so a count strictly between the two can only mean a partial refill —
 * one the Stockroom couldn't cover in full — and the remainder stays owed.
 */
export function needsRestock(c: Pick<ConsumablePar, "current_actual" | "closet_par">): boolean {
  return c.current_actual < c.closet_par;
}

/** How many to bring to get the closet back to par. */
export function restockNeeded(c: Pick<ConsumablePar, "current_actual" | "closet_par">): number {
  return Math.max(0, c.closet_par - c.current_actual);
}
