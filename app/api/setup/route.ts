import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { getAuthUserByToken, setUserPassword, recordLogin } from "@/lib/users-db";
import { hashPassword } from "@/lib/passwords";
import { SESSION_COOKIE, createSessionCookie } from "@/lib/users";

export const dynamic = "force-dynamic";

// First-time account setup from an invite link: the user picks their own
// password. Validates the token, stores the hash, and logs them in.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const user = await getAuthUserByToken(token);
    if (!user || user.status !== "active") {
      return NextResponse.json({ ok: false, error: "This setup link isn't valid." }, { status: 400 });
    }
    if (user.password_hash) {
      return NextResponse.json(
        { ok: false, error: "This account already has a password. Log in instead." },
        { status: 400 },
      );
    }

    await setUserPassword(user.id, await hashPassword(password));
    const { firstTime } = await recordLogin(user.id);
    const value = await createSessionCookie({
      id: user.id,
      role: user.role,
      name: user.name,
    });
    const res = NextResponse.json({ ok: true, firstTime });
    res.cookies.set(SESSION_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: friendlyError(e, "Couldn't set your password right now. Try again in a moment.") }, { status: 500 });
  }
}
