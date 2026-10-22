import { isUpload } from "./uploaded-assets";
import sharp from "sharp";
import JSZip from "jszip";
import { importerPhp } from "./importer";
import { Design, validateDesign } from "./design";
import { toElementor, previewHtml } from "./elementor";
import { safeFetch } from "./network";
export async function exportZip(inputs: unknown[], media = true) {
  if (inputs.length < 1 || inputs.length > 3)
    throw new Error("Export between one and three pages.");
  const zip = new JSZip();
  const mediaReport: string[] = [];
  const manifest: {
    format: string;
    pages: string[];
    media: { path: string; url: string }[];
  } = { format: "elementor-studio-v2", pages: [], media: [] };
  const packaged = new Set<string>();
  const plugin = new JSZip();
  plugin.file(
    "elementor-studio-importer/elementor-studio-importer.php",
    importerPhp,
  );
  zip.file(
    "elementor-studio-importer.zip",
    await plugin.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
  const deadline = Date.now() + 45000;
  let assetBytes = 0;
  let assetCount = 0;
  for (let i = 0; i < inputs.length; i++) {
    const d: Design = validateDesign(inputs[i]);
    const name =
      String(i + 1).padStart(2, "0") +
      "-" +
      d.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 50);
    manifest.pages.push(`templates/${name}.json`);
    const template = JSON.stringify(toElementor(d));
    if (Buffer.byteLength(template, "utf8") > 3_000_000) throw new Error("This template exceeds the importer 3 MB limit. Export a smaller page.");
    zip.file(`templates/${name}.json`, template);
    zip.file(`previews/${name}.html`, previewHtml(d));
    const urls = new Set<string>();
    const walk = (nodes: Design["nodes"]) =>
      nodes.forEach((n) => {
        if (n.kind === "image" && n.url) urls.add(n.url);
        for (const style of [n.style, n.tablet, n.mobile])
          if (style?.backgroundImage) urls.add(style.backgroundImage);
        walk(n.children);
      });
    walk(d.nodes);
    for (const url of [...urls].sort(
      (a, b) => Number(isUpload(b)) - Number(isUpload(a)),
    )) {
      if (!media && !isUpload(url)) continue;
      if (packaged.has(url)) continue;
      if (
        assetCount >= 40 ||
        assetBytes >= 3_200_000 ||
        Date.now() > deadline
      ) {
        mediaReport.push(
          "Remaining media kept as source links: package size or time budget reached. See media report.",
        );
        if (isUpload(url))
          throw new Error(
            "Uploaded images exceed the ZIP media budget. Export one page at a time.",
          );
        break;
      }
      try {
        const asset = isUpload(url)
          ? {
              type: "image/webp",
              body: Buffer.from(d.assets![url].split(",")[1], "base64"),
            }
          : await safeFetch(url, 4_000_000);
        if (!/^image\/(png|jpeg|webp|gif)/.test(asset.type))
          throw new Error("Unsupported image format");
        const bytes = await sharp(asset.body, { limitInputPixels: 40000000 })
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 78 })
          .toBuffer();
        if (assetBytes + bytes.length > 3_200_000) {
          if (isUpload(url))
            throw new Error("Uploaded images exceed export limits.");
          mediaReport.push(
            `Kept external to stay within download size: ${url}`,
          );
          continue;
        }
        const path = `media/image-${++assetCount}.webp`;
        assetBytes += bytes.length;
        zip.file(path, bytes);
        packaged.add(url);
        manifest.media.push({ path, url });
        mediaReport.push(`${path}: ${url}`);
      } catch {
        if (isUpload(url))
          throw new Error(
            "Could not package an uploaded image. Please replace it and try again.",
          );
        mediaReport.push(`Could not package image: ${url}`);
      }
    }
    zip.file(
      `reports/${name}.json`,
      JSON.stringify(
        {
          source: d.source,
          warnings: d.warnings,
          structure:
            "validated against internal schema and documented Elementor 0.4 envelope",
          wordpressImport: "Not tested",
          visualSimilarity: "Not measured",
          woocommerce: "Not connected",
        },
        null,
        2,
      ),
    );
  }
  zip.file("studio-manifest.json", JSON.stringify(manifest, null, 2));
  zip.file(
    "SETUP.txt",
    `ELEMENTOR STUDIO — EDITABLE PAGE PACKAGE

1. Use WordPress with Elementor installed (Local WP is suitable for testing). This Vercel app is the builder; WordPress editing needs WordPress.
2. Extract this export. On your WordPress test site, go to Plugins > Add New > Upload Plugin, select elementor-studio-importer.zip and activate.
3. Go to Tools > Elementor Studio and upload the original full export ZIP. It creates new DRAFT pages and uploads packaged images. It does not overwrite pages or change your homepage/theme.
4. Open each draft with Elementor. Change text, images, fonts, colours and spacing using native widgets. Add/remove pages in WordPress > Pages.
5. Review source links and any images not packaged. Set your navigation and homepage in WordPress. Shared header/footer and live products/cart/checkout require separate setup.
6. Optional manual route: import each templates/*.json through Elementor Saved Templates, then insert into a page.
7. Optional: check Add imported colours and fonts as new Elementor Global Styles in the importer. It appends custom Kit styles without replacing existing styles. Bare JSON keeps direct values.
8. Navigation drawers and expandable FAQ sections use the included importer plugin runtime. Keep the importer active for these interactions. Bare JSON retains editable content but does not install this runtime.
9. Images are optimized to WebP (up to 1600 px). Files exceeding download budgets stay linked to the source; review the media report.
10. This release has automated data-contract tests and controlled DOM layout checks. Full admin ZIP upload and interactive Elementor editor acceptance remain pending; use staging first. No complete store or guaranteed exact clone is included. Optional local product tools change the captured layout and are disabled unless you enable them.

Media report:
` + mediaReport.join("\n"),
  );
  const archive = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  if (archive.length > 4_200_000)
    throw new Error(
      "Export exceeds the download limit. Export one page at a time or disable packaged media.",
    );
  return archive;
}
