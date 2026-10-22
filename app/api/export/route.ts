import { ownerApiAccess } from "@/lib/owner-access";
import { exportZip } from "@/lib/export";
import { errorResponse, readBody, sameOrigin } from "@/lib/api";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  const denied = await ownerApiAccess(req);
  if (denied) return denied;
  try {
    sameOrigin(req);
    const body = await readBody(req, 3500000);
    if (!Array.isArray(body.designs))
      throw new Error("Select pages to export.");
    const archive = await exportZip(body.designs, body.media !== false);
    return new Response(new Uint8Array(archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="elementor-pages.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
