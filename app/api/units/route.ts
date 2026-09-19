import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { isAdmin } from "@/lib/auth-context";
import { createUnit } from "@/lib/inventory";

export const dynamic = "force-dynamic";

const PARKING_LABELS = ["None", "1 pass", "2 passes", "Card"];

// Add a unit from Settings. Managers only. Creates the unit, its standard
// closet of consumables and its linen profile, then recalculates par — the
// same shape the seed gives every other unit, without a SQL editor.
export async function POST(req: Request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  const property = String(body.property_name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60)
    return NextResponse.json({ error: "Give the unit a name, like Waites 401." }, { status: 400 });
  if (property.length < 2 || property.length > 40)
    return NextResponse.json({ error: "Which building is it in?" }, { status: 400 });

  const bedrooms = Number(body.bedrooms);
  if (bedrooms !== 1 && bedrooms !== 2)
    return NextResponse.json({ error: "Bedrooms must be 1 or 2." }, { status: 400 });

  const parking = String(body.parking_pass_label ?? "None");
  if (!PARKING_LABELS.includes(parking))
    return NextResponse.json({ error: "Pick a parking option." }, { status: 400 });

  const rollaways = Number(body.rollaway_beds ?? 0);
  if (!Number.isInteger(rollaways) || rollaways < 0 || rollaways > 4)
    return NextResponse.json({ error: "Rollaway beds must be 0 to 4." }, { status: 400 });

  const hid = String(body.hostaway_listing_id ?? "").trim();
  if (hid && !/^\d{3,12}$/.test(hid))
    return NextResponse.json({ error: "A Hostaway listing id is a number." }, { status: 400 });

  try {
    const unit = await createUnit({
      name,
      property_name: property,
      bedrooms,
      parking_pass_label: parking,
      has_pullout: body.has_pullout === true,
      rollaway_beds: rollaways,
      hostaway_listing_id: hid || null,
    });
    return NextResponse.json({ ok: true, unit_id: unit.unit_id, name: unit.name });
  } catch (err) {
    const msg = (err as Error).message;
    if (/already a unit called/.test(msg)) return NextResponse.json({ error: msg }, { status: 409 });
    if (/duplicate key/.test(msg) && /hostaway/.test(msg))
      return NextResponse.json({ error: "Another unit already has that Hostaway listing id." }, { status: 409 });
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}
