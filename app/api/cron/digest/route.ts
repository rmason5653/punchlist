import { NextResponse } from "next/server";
import { slackConfigured, sendSlack } from "@/lib/slack";
import { buildDigest } from "@/lib/digest";
import { markDigestPosted } from "@/lib/inventory";

export const dynamic = "force-dynamic";

// Scheduled daily digest (Vercel Cron) posted to Slack. Only posts when there's
// something to act on, so quiet days stay silent. Secured by CRON_SECRET when
// set (Vercel includes it as a Bearer token on cron requests).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!slackConfigured()) {
    return NextResponse.json({ ok: false, skipped: "slack not configured" });
  }

  try {
    const origin = new URL(req.url).origin;
    const digest = await buildDigest(origin);
    if (!digest.anyIssues) return NextResponse.json({ ok: true, skipped: "all good" });
    await sendSlack(digest.slackText);
    await markDigestPosted();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
