import { ownerApiAccess } from "@/lib/owner-access";
import { toElementor } from "@/lib/elementor";
import { errorResponse, readBody, sameOrigin } from "@/lib/api";
export async function POST(req: Request) {
  const denied = await ownerApiAccess(req);
  if (denied) return denied;
  try {
    sameOrigin(req);
    const body = await readBody(req, 3500000);
    return Response.json(
      { template: toElementor(body.design) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
