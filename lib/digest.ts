import { linenLabel } from "./constants";
import {
  buildLinenIntegrity,
  buildRestockRun,
  listCentralReserveWithTargets,
  listConsumables,
  listLinens,
  listUnits,
} from "./inventory";

export interface Digest {
  anyIssues: boolean;
  slackText: string;
}

function slackSection(title: string, items: string[]): string {
  if (items.length === 0) return "";
  return `*${title}:* ${items.join(", ")}\n`;
}

// Builds the inventory summary posted to Slack (daily cron + manual send).
export async function buildDigest(origin: string): Promise<Digest> {
  const [units, cons, linens, reserve] = await Promise.all([
    listUnits(),
    listConsumables(),
    listLinens(),
    listCentralReserveWithTargets(),
  ]);

  const restock = buildRestockRun(units, cons);
  const linenShort = buildLinenIntegrity(units, linens).filter((u) => u.short.length > 0);
  const centralLow = reserve.filter((r) => r.quantity_on_hand <= r.reorder_point);
  const parkingMissing = units.filter((u) => u.parking_status === "missing");

  const anyIssues =
    restock.length > 0 ||
    centralLow.length > 0 ||
    linenShort.length > 0 ||
    parkingMissing.length > 0;

  if (!anyIssues) {
    return {
      anyIssues,
      slackText: "*Par — all good.* Everything's at par; nothing to restock.",
    };
  }

  const centralItems = centralLow.map((r) => {
    const label = r.category === "linen" ? linenLabel(r.item_name) : r.item_name;
    return `${label} (${r.quantity_on_hand}/${r.reorder_point})`;
  });

  const slackText =
    "*Par — inventory summary*\n" +
    slackSection(`Closets below reorder (${restock.length})`, restock.map((r) => r.unit.name)) +
    slackSection(`Stockroom low (${centralLow.length})`, centralItems) +
    slackSection(`Units short on linens (${linenShort.length})`, linenShort.map((u) => u.unit.name)) +
    slackSection(`Parking missing (${parkingMissing.length})`, parkingMissing.map((u) => u.name)) +
    `<${origin}/restock|Open Par>`;

  return { anyIssues, slackText };
}
