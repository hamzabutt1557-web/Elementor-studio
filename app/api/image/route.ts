import { ownerApiAccess } from "@/lib/owner-access";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { readBody, sameOrigin, errorResponse } from "@/lib/api";
import { uploadPrefix } from "@/lib/uploaded-assets";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const denied = await ownerApiAccess(req);
  if (denied) return denied;
  try {
    sameOrigin(req);
    const { data } = await readBody(req, 2900000);
    if (
      typeof data !== "string" ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data)
    )
      throw new Error("Choose a JPG, PNG or WebP image under 2 MB.");
    const input = Buffer.from(data.split(",")[1], "base64");
    if (input.length > 2000000) throw new Error("Choose an image under 2 MB.");
    const bytes = await sharp(input, { limitInputPixels: 24000000 })
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toBuffer();
    if (bytes.length > 250000)
      throw new Error(
        "This image is too detailed. Try a smaller image (under 1200px).",
      );
    const url =
      uploadPrefix +
      createHash("sha256").update(bytes).digest("hex").slice(0, 32) +
      ".webp";
    return Response.json(
      { url, data: "data:image/webp;base64," + bytes.toString("base64") },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
