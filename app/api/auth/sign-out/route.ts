import { authOriginMatches } from "@/lib/api";
import { emailAuthClient } from "@/lib/email-auth";
export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authOriginMatches(req))
    return Response.json(
      { error: "Start this action from the app." },
      { status: 403, headers },
    );
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
