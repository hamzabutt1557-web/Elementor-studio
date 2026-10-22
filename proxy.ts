import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  basicAccess,
  isOwner,
  emailLoginEnabled,
  emailLoginReady,
} from "./lib/access-policy";

async function emailProxy(req: NextRequest) {
  if (req.nextUrl.pathname === "/share") return NextResponse.next();
  let response = NextResponse.next({ request: req });
  const client = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (items) => {
          for (const { name, value } of items) req.cookies.set(name, value);
          response = NextResponse.next({ request: req });
          for (const { name, value, options } of items)
            response.cookies.set(name, value, options);
        },
      },
    },
  );
  const path = req.nextUrl.pathname;
  // Only these endpoints can establish/clear a session; each validates origin and input.
  if (
    path === "/sign-in" ||
    path === "/access-denied" ||
    ["/api/auth/send", "/api/auth/verify", "/api/auth/sign-out"].includes(path)
  )
    return response;
  let user = null;
  try {
    const result = await client.auth.getUser();
    if (!result.error) user = result.data.user;
  } catch {}
  if (user && isOwner(user)) {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const blocked = path.startsWith("/api/")
    ? NextResponse.json(
        {
          error: user
            ? "This account does not have workspace access."
            : "Please sign in.",
        },
        { status: user ? 403 : 401 },
      )
    : NextResponse.redirect(
        new URL(user ? "/access-denied" : "/sign-in", req.url),
      );
  for (const cookie of response.cookies.getAll()) blocked.cookies.set(cookie);
  blocked.headers.set("Cache-Control", "no-store");
  return blocked;
}
export function proxy(req: NextRequest, event: NextFetchEvent) {
  if (emailLoginEnabled()) {
    if (!emailLoginReady()) {
      if (req.nextUrl.pathname === "/share") return NextResponse.next();
      return new NextResponse(
        "Email login setup is incomplete. Contact the workspace owner.",
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return emailProxy(req);
  }
  if (req.nextUrl.pathname === "/share") return NextResponse.next();
  const password = process.env.APP_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "production")
      return NextResponse.json(
        {
          error:
            "Owner setup required: configure private access before using this workspace.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.next();
  }
  return basicAccess(req.headers.get("authorization"))
    ? NextResponse.next()
    : new NextResponse("Private app. Enter your app password.", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Elementor Studio", charset="UTF-8"',
          "Cache-Control": "no-store",
        },
      });
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
