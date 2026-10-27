import { NextResponse } from "next/server";
import { authOriginMatches, readBody } from "@/lib/api";
import { emailLoginEnabled } from "@/lib/access-policy";
import {
  issuePasswordSession,
  passwordMatches,
  PASSWORD_COOKIE,
  PASSWORD_SESSION_SECONDS,
} from "@/lib/password-session";
import { createHash } from "node:crypto";
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authOriginMatches(req))
    return NextResponse.json(
      { error: "Open this form from the app." },
      { status: 403, headers },
    );
  if (emailLoginEnabled() || !process.env.APP_PASSWORD)
    return NextResponse.json(
      { error: "Password sign-in is unavailable." },
      { status: 503, headers },
    );
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.until <= now) attempts.delete(key);
  const key = createHash("sha256")
    .update(
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown",
    )
    .digest("hex");
  const state = attempts.get(key);
  if ((state?.count || 0) >= 10 || (!state && attempts.size >= 1024))
    return NextResponse.json(
      { error: "Too many attempts. Please try again in 15 minutes." },
      { status: 429, headers: { ...headers, "Retry-After": "900" } },
    );
  attempts.set(key, {
    count: (state?.count || 0) + 1,
    until: state?.until || now + 15 * 60 * 1000,
  });
  try {
    const body = await readBody(req, 2048);
    if (!passwordMatches(body?.password))
      return NextResponse.json(
        { error: "Incorrect app password. Please try again." },
        { status: 401, headers },
      );
    attempts.delete(key);
    const response = NextResponse.json({ ok: true }, { headers });
    response.cookies.set(PASSWORD_COOKIE, issuePasswordSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PASSWORD_SESSION_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to sign in. Please try again." },
      { status: 400, headers },
    );
  }
}
