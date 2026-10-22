import { emailLoginReady } from "@/lib/access-policy";
import { emailAuthClient } from "@/lib/email-auth";
import { ownerLogin } from "@/lib/login-flow";
import { readBody, authOriginMatches } from "@/lib/api";
export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authOriginMatches(req))
    return Response.json(
      { error: "Start this action from the app." },
      { status: 403, headers },
    );
  if (!emailLoginReady())
    return Response.json(
      { error: "Email login is awaiting its one-time connection." },
      { status: 503, headers },
    );
  try {
    const body = await readBody(req, 2048);
    const client = await emailAuthClient();
    const result = await ownerLogin("send", body, client.auth);
    return Response.json(
      result.error ? { error: result.error } : { ok: true },
      { status: result.status, headers },
    );
  } catch {
    return Response.json(
      { error: "Unable to complete sign-in. Please try again." },
      { status: 400, headers },
    );
  }
}
