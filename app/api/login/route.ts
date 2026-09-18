import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { getAuthUserByEmail, recordLogin } from "@/lib/users-db";
import { verifyPassword } from "@/lib/passwords";
import { SESSION_COOKIE, createSessionCookie } from "@/lib/users";

export const dynamic = "force-dynamic";

// Email + password login. Sets the signed session cookie used everywhere.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Enter your email and password." },
      { status: 400 },
    );
  }

  try {
    const user = await getAuthUserByEmail(email);
    // One generic message whether the email is unknown, disabled, has no
    // password yet, or the password is wrong — don't leak which.
    if (
      !user ||
      user.status !== "active" ||
      !(await verifyPassword(password, user.password_hash))
    ) {
      return NextResponse.json(
        { ok: false, error: "Wrong email or password." },
        { status: 401 },
      );
    }

    await recordLogin(user.id);
    const value = await createSessionCookie({
      id: user.id,
      role: user.role,
      name: user.name,
    });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: friendlyError(e, "Couldn't log you in right now. Try again in a moment.") }, { status: 500 });
  }
}
