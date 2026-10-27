/** Browser regression uses the exact artwork helper called by the production crawler. */
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { captureArtwork } from "../lib/capture-artwork";
import { captureDocument } from "../lib/capture-document";
import { mergeResponsive } from "../lib/responsive";
import { previewHtml } from "../lib/elementor";
import { validateDesign } from "../lib/design";
import { restoreCaptureViewport } from "../lib/capture-viewport";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || ".qa/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.addInitScript("window.__name=(f)=>f");
    await page.evaluate("window.__name=(f)=>f");
    const assets: Record<string, string> = {};
    const warnings: string[] = [];
    const snapshots: any[] = [];
    const reports = [];
    await page.route("https://studio-upload.invalid/**", (r) =>
      r.fulfill({
        body: Buffer.from(assets[r.request().url()].split(",")[1], "base64"),
        contentType: "image/webp",
      }),
    );
    const svg =
      '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>';
    const html = `<style>body{margin:0;color:#123456}svg{display:inline-block}.menu{display:block;width:30px;height:30px;position:relative}.menu span:before{content:'';position:absolute;left:3px;top:5px;width:24px;height:2px;background:currentColor;box-shadow:0 8px currentColor,0 16px currentColor}@media(max-width:767px){body{color:#c81020}}</style><main>${svg.repeat(25)}<a class="menu" aria-label="Open menu"><span></span></a><p>Editable text stays native</p></main>`;
    await page.setContent(html);
    let desktopUrl = "";
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const report = await captureArtwork(page, assets, warnings);
      reports.push(report);
      assert.equal(report.candidates, 26);
      assert.equal(report.skipped, 0);
      assert.equal(
        report.captures,
        2,
        "Repeated SVGs must reuse one rasterization",
      );
      const urls = await page
        .locator("svg")
        .evaluateAll((es) =>
          es.map((e) => e.getAttribute("data-studio-artwork")),
        );
      assert.equal(new Set(urls).size, 1);
      assert.ok(urls[24]);
      assert.ok(
        await page.locator(".menu").getAttribute("data-studio-artwork"),
        "CSS hamburger must be captured after the first 20 SVGs",
      );
      if (width === 1440) desktopUrl = urls[0]!;
      if (width === 390)
        assert.notEqual(
          urls[0],
          desktopUrl,
          "Mobile icon color must be recaptured",
        );
      await restoreCaptureViewport(page, width);
      snapshots.push(
        await page.evaluate(
          `(()=>{const __name=f=>f;return (${captureDocument.toString()})();})()`,
        ),
      );
    }
    const d = validateDesign({
      title: "Artwork acceptance",
      source: "https://fixture.example/",
      nodes: mergeResponsive(
        snapshots[0].nodes,
        snapshots[1].nodes,
        snapshots[2].nodes,
      ),
      warnings,
      assets,
    });
    const preview = [];
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(previewHtml(d));
      const images = await page
        .locator("img:visible")
        .evaluateAll((es) =>
          es.map((e) => ({
            url: (e as HTMLImageElement).src,
            loaded: (e as HTMLImageElement).naturalWidth > 0,
          })),
        );
      assert.equal(images.length, 26);
      assert.ok(images.every((i) => i.loaded));
      assert.equal(images[0].url === assets[desktopUrl], width !== 390);
      preview.push({ width, visibleImages: images.length, loaded: true });
    }
    console.log(
      JSON.stringify({
        reports,
        preview,
        warnings,
        uniqueAssets: Object.keys(assets).length,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
