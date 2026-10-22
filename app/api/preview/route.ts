import { ownerApiAccess } from "@/lib/owner-access";
import { previewHtml } from "@/lib/elementor";
import { errorResponse, readBody, sameOrigin } from "@/lib/api";
export async function POST(req: Request) {
  const denied = await ownerApiAccess(req);
  if (denied) return denied;
  try {
    sameOrigin(req);
    const body = await readBody(req, 3500000);
    return Response.json(
      { preview: previewHtml(body.design, body.editable === true) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
