import { NextResponse } from "next/server";
import { emailLoginEnabled } from "@/lib/access-policy";
import { PASSWORD_COOKIE } from "@/lib/password-session";
import { authOriginMatches } from "@/lib/api";
import { emailAuthClient } from "@/lib/email-auth";
export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authOriginMatches(req))
    return Response.json(
      { error: "Start this action from the app." },
      { status: 403, headers },
    );
  if (!emailLoginEnabled()) {
    const response = NextResponse.json({ ok: true }, { headers });
    response.cookies.set(PASSWORD_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  }
  try {
    const client = await emailAuthClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error)
      return Response.json(
        { error: "Unable to sign out. Try again." },
        { status: 503, headers },
      );
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json(
      { error: "Unable to sign out. Try again." },
      { status: 503, headers },
    );
  }
}
