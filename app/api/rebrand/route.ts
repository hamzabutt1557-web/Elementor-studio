import { ownerApiAccess } from "@/lib/owner-access";
import { readBody, sameOrigin, errorResponse } from "@/lib/api";
import { brandSchema, rebrand } from "@/lib/brand";
import { previewHtml, toElementor } from "@/lib/elementor";
export async function POST(req: Request) {
  const denied = await ownerApiAccess(req);
  if (denied) return denied;
  try {
    sameOrigin(req);
    const body = await readBody(req, 2000000);
    if (
      !Array.isArray(body.designs) ||
      body.designs.length < 1 ||
      body.designs.length > 3
    )
      throw new Error("Choose between one and three pages.");
    const brand = brandSchema.parse(body.brand);
    return Response.json({
      pages: body.designs.map((d: unknown) => {
        const design = rebrand(d, brand);
        return {
          design,
          preview: previewHtml(design),
          ...(body.includeTemplate !== false
            ? { template: toElementor(design) }
            : {}),
        };
      }),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
