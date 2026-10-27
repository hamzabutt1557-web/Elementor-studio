import { passwordSessionAccess } from "./password-session";
import { emailAuthClient } from "./email-auth";
import {
  basicAccess,
  emailLoginEnabled,
  emailLoginReady,
  isOwner,
} from "./access-policy";

/** Real identity check at the API boundary, independent of proxy redirects. */
export async function ownerApiAccess(req: Request): Promise<Response | null> {
  const headers = { "Cache-Control": "no-store" };
  if (!emailLoginEnabled()) {
    if (
      basicAccess(req.headers.get("authorization")) ||
      passwordSessionAccess(req.headers.get("cookie"))
    )
      return null;
    if (!process.env.APP_PASSWORD && process.env.NODE_ENV !== "production")
      return null;
    return Response.json(
      { error: "Please sign in to your private workspace." },
      { status: process.env.APP_PASSWORD ? 401 : 503, headers },
    );
  }
  if (!emailLoginReady())
    return Response.json(
      { error: "Email login setup is incomplete. Contact the owner." },
      { status: 503, headers },
    );
  try {
    const client = await emailAuthClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user)
      return Response.json(
        { error: "Please sign in." },
        { status: 401, headers },
      );
    if (!isOwner(user))
      return Response.json(
        { error: "This account does not have workspace access." },
        { status: 403, headers },
      );
    return null;
  } catch {
    return Response.json(
      { error: "Unable to verify your login. Please try again." },
      { status: 503, headers },
    );
  }
}
