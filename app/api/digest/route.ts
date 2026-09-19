import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { getViewer } from "@/lib/auth-context";
import { slackConfigured, sendSlack } from "@/lib/slack";
import { buildDigest } from "@/lib/digest";
import { markDigestPosted } from "@/lib/inventory";

export const dynamic = "force-dynamic";

// Admin-triggered "post the summary to Slack now" (also tests the alert).
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (viewer?.role !== "admin")
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  if (!slackConfigured())
    return NextResponse.json(
      { ok: false, error: "Slack isn't connected yet." },
      { status: 400 },
    );

  try {
    const origin = new URL(req.url).origin;
    const digest = await buildDigest(origin);
    await sendSlack(digest.slackText);
    await markDigestPosted();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: friendlyError(e) }, { status: 500 });
  }
}
