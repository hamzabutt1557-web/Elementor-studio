import { ownerApiAccess } from "@/lib/owner-access";
import { discover } from "@/lib/crawler";
import { errorResponse, readBody, sameOrigin } from "@/lib/api";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  const denied = await ownerApiAccess(req);
  if (denied) return denied;
  try {
    sameOrigin(req);
    const body = await readBody(req, 8000);
    if (typeof body.url !== "string" || body.url.length > 2500)
      throw new Error("Enter a valid website URL.");
    return Response.json(await discover(body.url));
  } catch (e) {
    return errorResponse(e);
  }
}
