// Display labels and ordering. Linens are keyed internally by a stable key;
// central reserve uses the same key for the linen category so a pull can find
// the right reserve row.

import type { Category, PullReason } from "./types";

/**
 * Every timestamp in the app is shown in the team's own zone. Formatting with
 * an explicit zone makes the server and the phone agree on the text, so pages
 * don't re-render on load, and a manager travelling still reads "the clean
 * happened at 3 PM our time". One constant to change if the business moves.
 */
export const BUSINESS_TZ = "America/New_York";

// Towels carry no size. Sheets, quilts, and pillowcases come in King and Queen
// — a unit only stocks the sizes its beds use, so these are added per unit in
// the linen editor rather than seeded onto every unit.
export type LinenSize = "King" | "Queen" | "Twin";

export const LINEN_TYPES: { key: string; label: string; size?: LinenSize }[] = [
  { key: "bath_towel", label: "Bath towels" },
  { key: "washcloth", label: "Washcloths" },
  { key: "hand_towel", label: "Hand towels" },
  { key: "makeup_towel", label: "Makeup towels" },
  { key: "kitchen_towel", label: "Kitchen towels" },
  { key: "fitted_sheet_queen", label: "Fitted sheets (Queen)", size: "Queen" },
  { key: "fitted_sheet_king", label: "Fitted sheets (King)", size: "King" },
  { key: "flat_sheet_queen", label: "Flat sheets (Queen)", size: "Queen" },
  { key: "flat_sheet_king", label: "Flat sheets (King)", size: "King" },
  { key: "quilt_queen", label: "Quilts (Queen)", size: "Queen" },
  { key: "quilt_king", label: "Quilts (King)", size: "King" },
  { key: "pillowcase_queen", label: "Pillowcases (Queen)", size: "Queen" },
  { key: "pillowcase_king", label: "Pillowcases (King)", size: "King" },
  { key: "fitted_sheet_twin", label: "Fitted sheets (Twin)", size: "Twin" },
  { key: "flat_sheet_twin", label: "Flat sheets (Twin)", size: "Twin" },
  { key: "quilt_twin", label: "Quilts (Twin)", size: "Twin" },
];

const LINEN_LABEL = new Map(LINEN_TYPES.map((l) => [l.key, l.label]));

/** Sort index of a linen type by catalog order; unknown keys sort last. */
export const LINEN_SORT = new Map(LINEN_TYPES.map((l, i) => [l.key, i + 1]));

/** Human label for a linen type key; falls back to the raw key. */
export function linenLabel(key: string): string {
  return LINEN_LABEL.get(key) ?? key;
}

export const REASON_LABELS: Record<PullReason, string> = {
  weekly_restock: "Weekly restock",
  damage_replacement: "Damage replacement",
  stain_out: "Stain out",
};

export function reasonLabel(reason: string): string {
  return REASON_LABELS[reason as PullReason] ?? reason;
}

/** Reasons valid for each category — consumables restock, linens are exceptions. */
export const REASONS_BY_CATEGORY: Record<Category, PullReason[]> = {
  consumable: ["weekly_restock"],
  linen: ["damage_replacement", "stain_out"],
};
