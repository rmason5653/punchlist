import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { isAdmin } from "@/lib/auth-context";
import {
  deleteUser,
  getUserById,
  regenerateInvite,
  resetUserPassword,
  updateUser,
} from "@/lib/users-db";
import { emailConfigured, sendInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    if (body.regenerate) {
      const token = await regenerateInvite(id);
      return NextResponse.json({ ok: true, invite_token: token });
    }
    if (body.reset_password) {
      // Clear their password and issue a fresh setup link.
      const token = await resetUserPassword(id);
      return NextResponse.json({ ok: true, invite_token: token, reset: true });
    }
    if (body.send_email) {
      const u = await getUserById(id);
      if (!u) return NextResponse.json({ error: "Not found." }, { status: 404 });
      if (!u.email)
        return NextResponse.json({ error: "No email on file for this person." }, { status: 400 });
      if (!emailConfigured())
        return NextResponse.json({ error: "Email isn't connected yet — copy or text the link instead." }, { status: 400 });
      const origin = new URL(req.url).origin;
      await sendInviteEmail(u.email, u.name, `${origin}/join/${u.invite_token}`);
      return NextResponse.json({ ok: true, emailed: true });
    }
    const patch: Record<string, unknown> = {};
    if (body.role === "admin" || body.role === "cleaner") patch.role = body.role;
    if (body.status === "active" || body.status === "disabled") patch.status = body.status;
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (body.phone !== undefined) patch.phone = body.phone ? String(body.phone).trim() : null;
    if (body.email !== undefined) patch.email = body.email ? String(body.email).trim() : null;
    if (Object.keys(patch).length > 0) await updateUser(id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  try {
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}
