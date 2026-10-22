import { ownerApiAccess } from "@/lib/owner-access";
import { fontCatalog } from "@/lib/font-library";
export async function GET(req: Request) {
  const denied = await ownerApiAccess(req);
  if (denied) return denied;
  return Response.json(fontCatalog, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
