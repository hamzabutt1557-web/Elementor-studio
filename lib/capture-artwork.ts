import type { Page } from "playwright-core";
import sharp from "sharp";
import { createHash } from "node:crypto";

/** Shared by the live crawler and browser acceptance tests. Never export source SVG/code. */
export async function captureArtwork(
  page: Page,
  assets: Record<string, string>,
  warnings: string[],
) {
  // Re-evaluate each breakpoint: a menu icon or SVG can change color and shape.
  const candidates = await page.evaluate(() => {
    document
      .querySelectorAll("[data-studio-artwork],[data-studio-artwork-index]")
      .forEach((el) => {
        el.removeAttribute("data-studio-artwork");
        el.removeAttribute("data-studio-artwork-index");
      });
    const selected: Element[] = [];
    const painted = (s: CSSStyleDeclaration) =>
      s.content !== "none" &&
      s.content !== "normal" &&
      (s.content !== '""' ||
        s.backgroundColor !== "rgba(0, 0, 0, 0)" ||
        parseFloat(s.borderTopWidth) > 0 ||
        (!!s.boxShadow && s.boxShadow !== "none"));
    for (const el of Array.from(
      document.querySelectorAll("svg,button,a,span,i,label,div"),
    )) {
      if (selected.length >= 500) break;
      const r = el.getBoundingClientRect(),
        s = getComputedStyle(el);
      if (
        r.width < 2 ||
        r.height < 2 ||
        s.display === "none" ||
        s.visibility === "hidden" ||
        s.opacity === "0"
      )
        continue;
      if (el.closest("svg") !== null && el.tagName.toLowerCase() !== "svg")
        continue;
      const svg = el.tagName.toLowerCase() === "svg";
      const cssIcon =
        !svg &&
        r.width <= 160 &&
        r.height <= 160 &&
        !(el.textContent || "").trim() &&
        !el.querySelector("img,svg,input,video") &&
        [el, ...Array.from(el.querySelectorAll("span,i")).slice(0, 8)].some(
          (e) =>
            painted(getComputedStyle(e, "::before")) ||
            painted(getComputedStyle(e, "::after")),
        );
      if (!svg && !cssIcon) continue;
      if (selected.some((parent) => parent.contains(el))) continue;
      const props = [
        "color",
        "fill",
        "stroke",
        "stroke-width",
        "background",
        "border",
        "border-radius",
        "box-shadow",
        "font",
        "content",
        "width",
        "height",
        "transform",
        "position",
        "top",
        "left",
        "right",
        "bottom",
        "margin",
        "padding",
        "display",
      ];
      const paint = (e: Element, pseudo?: string) => {
        const st = getComputedStyle(e, pseudo);
        return props.map((p) => st.getPropertyValue(p));
      };
      const signature = JSON.stringify([
        el.outerHTML,
        r.width,
        r.height,
        [el, ...Array.from(el.querySelectorAll("*")).slice(0, 30)].map((e) => [
          paint(e),
          paint(e, "::before"),
          paint(e, "::after"),
        ]),
      ]);
      const index = String(selected.length);
      el.setAttribute("data-studio-artwork-index", index);
      selected.push(el);
      // Signature calculated before adding our attributes, to reuse repeated store icons.
      (el as any).__studioArtworkSignature = signature;
    }
    return selected.map((el, index) => ({
      index,
      signature: (el as any).__studioArtworkSignature,
    }));
  });
  const cache = new Map<string, string>();
  let totalBytes = Object.values(assets).reduce(
    (n, v) => n + Buffer.from(v.split(",")[1] || "", "base64").length,
    0,
  );
  let captures = 0,
    skipped = 0;
  const deadline = Date.now() + 12000;
  for (const { index, signature } of candidates) {
    const el = page.locator(`[data-studio-artwork-index="${index}"]`);
    let url = cache.get(signature);
    if (!url) {
      if (captures >= 40 || Date.now() > deadline) {
        skipped++;
        continue;
      }
      captures++;
      try {
        const png = await el.screenshot({ timeout: 1200 });
        const bytes = await sharp(png)
          .resize({
            width: 800,
            height: 800,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 90 })
          .toBuffer();
        url =
          "https://studio-upload.invalid/" +
          createHash("sha256").update(bytes).digest("hex").slice(0, 32) +
          ".webp";
        if (
          !assets[url] &&
          (Object.keys(assets).length >= 32 ||
            totalBytes + bytes.length > 800000 ||
            bytes.length > 250000)
        ) {
          skipped++;
          continue;
        }
        if (!assets[url]) {
          assets[url] = "data:image/webp;base64," + bytes.toString("base64");
          totalBytes += bytes.length;
        }
        cache.set(signature, url);
      } catch {
        skipped++;
        continue;
      }
    }
    await el.evaluate(
      (e, url) => e.setAttribute("data-studio-artwork", url),
      url,
    );
  }
  if (skipped)
    warnings.push(
      `${skipped} artwork instances exceeded capture time/size limits or could not be rendered. Review icons before export.`,
    );
  return { candidates: candidates.length, captures, skipped };
}
