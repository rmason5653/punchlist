import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/users";

export const dynamic = "force-dynamic";

// Clears both the per-user session and the shared-password cookie, then
// returns to the login screen. A POST, not a link: a GET that ends a session
// can be triggered by link previews and prefetching.
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
