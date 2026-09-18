import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { isAdmin } from "@/lib/auth-context";
import { createUser, listUsers } from "@/lib/users-db";
import { emailConfigured, sendInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    return NextResponse.json({ users: await listUsers() });
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const phone = body.phone ? String(body.phone).trim() : null;
  const email = body.email ? String(body.email).trim() : null;
  const role = body.role === "admin" ? "admin" : "cleaner";

  if (!name)
    return NextResponse.json({ error: "Name is required." }, { status: 400 });

  try {
    const user = await createUser(name, phone, email, role);

    // Auto-send the login link by email when configured.
    let emailed = false;
    let emailError: string | null = null;
    if (email && emailConfigured()) {
      const origin = new URL(req.url).origin;
      try {
        await sendInviteEmail(email, name, `${origin}/join/${user.invite_token}`);
        emailed = true;
      } catch (e) {
        emailError = (e as Error).message;
      }
    }

    return NextResponse.json({ user, emailed, emailError });
  } catch (err) {
    const msg = (err as Error).message;
    const friendly = /duplicate|unique/i.test(msg)
      ? "That phone number is already on the team."
      : friendlyError(err, "Couldn't add them. Give it a moment and try again.");
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
