import { ownerApiAccess } from "@/lib/owner-access";
import { connection } from "@/lib/api-provider";
import { readBody, sameOrigin, errorResponse } from "@/lib/api";
export async function POST(req: Request) {
  const denied = await ownerApiAccess(req);
  if (denied) return denied;
  try {
    sameOrigin(req);
    const body = await readBody(req, 3000);
    const listing = body.list === true;
    const c = connection({
      ...body.connection,
      ...(listing ? { model: "model-discovery" } : {}),
    });
    const res = await fetch(c.base + "models", {
      headers: { Authorization: "Bearer " + c.key },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok)
      throw new Error(
        "Connection failed (HTTP " +
          res.status +
          "). Check provider and API key.",
      );
    const data = await res.json();
    const ids = Array.isArray(data.data)
      ? data.data
          .map((m: { id?: unknown } | null) => m?.id)
          .filter(
            (id: unknown): id is string =>
              typeof id === "string" &&
              id.length <= 120 &&
              /^[a-zA-Z0-9_.:/-]+$/.test(id),
          )
      : [];
    if (listing)
      return Response.json(
        { models: [...new Set<string>(ids)].sort().slice(0, 300) },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (!ids.includes(c.model))
      throw new Error(
        "Key accepted, but the selected model is not listed for this account. Check the model ID.",
      );
    return Response.json(
      {
        message:
          "Connection verified. Model is available. Generation and billing depend on your provider quota.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
