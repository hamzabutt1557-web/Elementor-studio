import { CapacityError } from "./build-capacity";
import { ZodError } from "zod";
export async function readBody(req: Request, limit = 350000) {
  if (Number(req.headers.get("content-length") || 0) > limit)
    throw new Error("Request is too large.");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Request has no content.");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > limit) {
      await reader.cancel();
      throw new Error("Request is too large.");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}
export function errorResponse(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof ZodError
          ? "This page could not be converted into a valid editable draft. Try a simpler page or a brief."
          : e instanceof Error
            ? e.message
            : "This request could not be completed.",
    },
    { status: e instanceof CapacityError ? 429 : 400, headers: e instanceof CapacityError ? { "Retry-After": "15" } : undefined },
  );
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if ((origin && !authOriginMatches(req)) || req.headers.get("sec-fetch-site") === "cross-site")
    throw new Error("This action must be started from the app.");
}

/** Auth mutations require an Origin, including when Next uses an internal request hostname. */
export function authOriginMatches(req: Request) {
  const origin = req.headers.get("origin");
  const expected = new URL(req.url);
  const host = req.headers.get("host");
  if (host) expected.host = host;
  return (
    !!origin &&
    origin === expected.origin &&
    req.headers.get("sec-fetch-site") !== "cross-site"
  );
}
