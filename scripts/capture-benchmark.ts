import { restoreCaptureViewport } from "../lib/capture-viewport";
/** Controlled fixtures only. Run with CHROMIUM_EXECUTABLE_PATH set in restricted environments. */
import { chromium } from "playwright-core";
import serverChromium from "@sparticuz/chromium";
import { captureDocument } from "../lib/capture-document";
import { mergeResponsive } from "../lib/responsive";
import { validateDesign, type DesignNode } from "../lib/design";
import { previewHtml, toElementor } from "../lib/elementor";
import { compareLayout, previewGeometry } from "../lib/layout-audit";
import { viewportWidths } from "../lib/viewports";
import assert from "node:assert/strict";
const fixtures = {
  invisibleFlow: `<main><div style="position:relative;width:180px"><a style="display:block;visibility:hidden;width:30px;height:30px;margin:0 15px 15px auto">Hidden wishlist</a><button>Quick View</button><p>Add to bag</p></div></main>`,
  emptyMargins: `<main><p style="margin-bottom:15px">Price</p><div style="margin-bottom:18px"></div><div style="font-size:0;line-height:0"><span style="display:inline-block;font:12px/20px Arial">Size M</span></div></main><footer style="height:120px">Footer</footer>`,
  search: `<main><form role="search" action="https://source.example/search"><input type="search" placeholder="Search products" value="private-typed-query" style="font:16px/24px Arial;padding:8px 12px;border:1px solid #222;width:240px"></form><form><input type="email" placeholder="Email" value="private@example.test"></form></main>`,

  floatedColumns: `<main><div style="display:flow-root;border-bottom:2px solid #222"><aside style="float:left;width:25%;padding:12px">Sidebar</aside><section style="float:right;width:70%;padding:12px"><h2>Product content</h2><p>Floated columns preserve their source positions.</p></section></div><footer style="clear:both">Footer after floats</footer></main>`,

  negativeGutters: `<div style="padding:30px"><div style="margin:0 -15px;display:flex"><article style="width:33.333%;padding:0 15px"><p>First product</p></article><article style="width:33.333%;padding:0 15px"><p>Second product</p></article><article style="width:33.333%;padding:0 15px"><p>Third product</p></article></div></div>`,
  pseudoMedia: `<style>.media-slot{position:relative}.media-slot:before{content:"";display:block;padding-top:150%}.media-slot img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}</style><main><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">${[1,2,3].map(i=>`<article><div class="media-slot"><img src="https://fixture.example/p${i}.png"></div><h2>Product ${i}</h2><p>Price</p></article>`).join('')}</div><footer>Complete footer</footer></main>`,

  productRatios: `<header style="min-height:120px;align-items:center">Shop header</header><main><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">${[1, 2, 3].map((i) => `<article><a href="/products/${i}" style="display:block"><div class="box-ratio" style="position:relative;padding-bottom:125%;height:0;overflow:hidden"><img src="https://fixture.example/p${i}.png" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover"></div></a><h2>Product ${i}</h2><p>Price</p></article>`).join("")}</div></main><footer style="min-height:180px;display:flex;align-items:center">Footer information</footer>`,

  navigation: `<style>#mobile-toggle{display:none}#fixture-menu{display:flex;gap:20px}@media(max-width:600px){#mobile-toggle{display:block}#fixture-menu{display:none}}</style><header><button id='mobile-toggle' aria-controls='fixture-menu' aria-label='Open navigation menu'>Menu</button><nav id='fixture-menu'><a href='/home'>Home link</a><a href='/about'>About link</a></nav></header><main><h1>Navigation test</h1><p>Visible desktop links must not become a hidden mobile drawer.</p></main>`,
  clippedSlider: `<main><h1>Visible slider state</h1><div style='overflow:hidden'><div style='display:flex;width:100%;transform:translateX(-100%)'><article style='flex:0 0 100%;padding:20px'><p>Offscreen first copy</p></article><article style='flex:0 0 100%;padding:20px'><p>Visible active card</p></article><article style='flex:0 0 100%;padding:20px'><p>Offscreen last copy</p></article></div></div><footer>Content after the slider</footer></main>`,
  fontStack: `<main style='font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"'><h1>Long system font fallback stack</h1><p>A long quoted font list must never disable later CSS rules.</p><section class='cards'><article>First card</article><article>Second card</article></section></main>`,
  markup: `<main><h1>
		Formatted markup
	</h1><p>
	Welcome to our
	<strong>
		travel studio
	</strong>
	 today.
</p><p>First line<br>Second line</p></main>`,
  business: `<header><strong>Studio</strong><nav><a href='/work'>Work</a><a href='/contact'>Contact</a></nav></header><main><section class='intro'><h1>Made for your business</h1><div>Keep this <strong>important text</strong> and <a href='/about'>inline link</a>.</div><div class='mixed'>Before child<h2>A real section</h2>After child</div></section><section class='cards'><article><h2>Design</h2><p>Practical design services.</p></article><article><h2>Build</h2><p>Clear and simple pages.</p></article></section><div class='spacer'></div></main><footer>Contact our studio</footer>`,
  catalog: `<header><strong>Our shop</strong><a href='/contact'>Contact</a></header><main><h1>New collection</h1><section class='cards products'>${["One", "Two", "Three", "Four"].map((n, i) => `<article class='product-card'><a href='/products/${i}'><img src='https://fixture.example/p${i}.png' width='300' height='200'></a><h2>${n}</h2><p>£${i + 10}.00</p></article>`).join("")}</section></main><footer>Delivery and contact</footer>`,
  responsive: `<header>Responsive business</header><main><section class='responsive-box'><h1>Desktop to mobile</h1><p>This layout changes its border, background and positioning.</p></section><section class='reverse'><p>First</p><p>Second</p></section></main><footer>Footer</footer>`,
};
const css = `*{box-sizing:border-box}body{margin:0;padding:24px;font-family:Arial;font-size:16px;color:#202938}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px}nav{display:flex;gap:20px}main{max-width:1000px;margin:auto}h1{font-size:40px;margin:0 0 20px}h2{font-size:24px;margin:0 0 12px}p{margin:0;line-height:24px}.intro{padding:24px;background:#eef2ff}.mixed{margin-top:20px}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin-top:24px}.cards article{padding:20px;border:1px solid #ccc;background:#f9fafb}.products img{display:block;width:100%;height:180px;object-fit:cover}.spacer{height:40px;background:#f5f5f5}.responsive-box{position:relative;left:20px;max-width:700px;min-height:180px;border:3px solid #333;background-image:url('https://fixture.example/bg.png')}.reverse{display:flex;flex-direction:row-reverse;gap:16px}footer{margin-top:40px;padding:20px;background:#e9eef3}@media(max-width:900px){.cards{grid-template-columns:1fr}.responsive-box{position:static;left:auto;max-width:none;min-height:0;border:0;background-image:none}h1{font-size:32px}}@media(max-width:600px){body{padding:16px}.intro{padding:16px}header{gap:12px}.reverse{flex-direction:column}h1{font-size:28px}}`;
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_EXECUTABLE_PATH ||
      (await serverChromium.executablePath()),
    args: serverChromium.args,
    headless: true,
  });
  const report: unknown[] = [];
  try {
    for (const [name, body] of Object.entries(fixtures)) {
      const context = await browser.newContext();
      await context.route("https://fixture.example/**", (r) =>
        r.fulfill({
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
            "base64",
          ),
        }),
      );
      const page = await context.newPage();
      const snapshots: Record<string, DesignNode[]> = {};
      const source: Record<string, ReturnType<typeof captureDocument>> = {};
      for (const [device, width] of Object.entries(viewportWidths)) {
        await page.setViewportSize({ width, height: 900 });
        await page.setContent(
          `<!doctype html><html><head><base href='https://fixture.example/'><style>${css}</style></head><body>${body}</body></html>`,
        );
        source[device] = await page.evaluate(
          `(()=>{const __name=(fn)=>fn;return (${captureDocument.toString()})();})()`,
        );
        snapshots[device] = source[device].nodes;
      }
      const design = validateDesign({
        title: name,
        source: "https://fixture.example/",
        nodes: mergeResponsive(
          snapshots.desktop,
          snapshots.tablet,
          snapshots.mobile,
        ),
        warnings: [],
      });
      const flatten = (nodes: DesignNode[]): DesignNode[] =>
        nodes.flatMap((n) => [n, ...flatten(n.children)]);
      const nodes = flatten(design.nodes);
      if (name === "search") {
        assert.equal(nodes.filter(n => n.kind === "search").length, 1);
        assert.ok(nodes.some(n => n.kind === "text" && n.text === "[Form field: Email]"));
        assert.ok(!JSON.stringify(design).includes("private-typed-query"));
        assert.ok(!JSON.stringify(design).includes("private@example.test"));
      }
      if (name === "productRatios") {
        const images = nodes.filter((n) => n.kind === "image");
        assert.equal(images.length, 3);
        assert.ok(
          images.every(
            (n) =>
              n.style.position === "absolute" && (n.style.height || 0) > 300,
          ),
        );
        assert.ok(
          nodes.some((n) => n.style.marginAuto && n.style.maxWidth === 1000),
        );
        assert.ok(nodes.some((n) => n.style.minHeight === 120));
        assert.ok(nodes.some((n) => n.style.minHeight === 180));
      }
      if (name === "navigation") {
        const link = nodes.find(
          (n) =>
            n.text === "Home link" &&
            !n.panel &&
            n.id !== nodes.find((n) => n.panel)?.id,
        );
        assert.ok(
          link && !link.style.hidden,
          "desktop navigation was not removed by its hidden mobile toggle",
        );
        assert.ok(
          nodes.some(
            (n) => n.panel && n.style.hidden && n.mobile?.hidden === false,
          ),
          "mobile-only drawer remains available",
        );
      }
      if (name === "clippedSlider") {
        const text = nodes.map((n) => n.text || "").join(" ");
        assert.ok(text.includes("Visible active card"));
        assert.ok(!text.includes("Offscreen first copy"));
        assert.ok(!text.includes("Offscreen last copy"));
      }
      if (name === "markup") {
        const text = nodes
          .filter((n) => n.kind === "text" || n.kind === "heading")
          .map((n) => n.text || "");
        assert.ok(text.includes("Formatted markup"));
        assert.ok(
          text.some((t) => t.includes("Welcome to our travel studio today.")),
        );
        assert.ok(text.includes("First line\nSecond line"));
        assert.ok(!text.some((t) => t.includes("\t")));
      }
      if (name === "business") {
        const text = nodes.map((n) => n.text || "").join(" ");
        assert.ok(text.includes("Keep this important text"));
        assert.ok(text.includes("Before child"));
        assert.ok(text.includes("After child"));
        assert.ok(
          nodes.some((n) =>
            n.runs?.some((r) => r.bold && r.text === "important text"),
          ),
        );
        assert.ok(
          nodes.some(
            (n) =>
              n.kind === "container" &&
              !n.children.length &&
              n.style.minHeight === 40,
          ),
          "empty decorative spacer retained",
        );
      }
      if (name === "responsive") {
        const box = nodes.find((n) =>
          n.children.some((c) => c.text === "Desktop to mobile"),
        )!;
        assert.equal(box.tablet?.backgroundImage, "");
        assert.equal(box.tablet?.borderWidth, 0);
        assert.equal(box.tablet?.left, 0);
        assert.equal(box.tablet?.minHeight, 0);
        assert.equal(box.tablet?.maxWidth, 10000);
      }
      const json = toElementor(design);
      assert.ok(json.content.length);
      const measurements = [];
      for (const [device, width] of Object.entries(viewportWidths)) {
        await page.setViewportSize({ width, height: 900 });
        await page.setContent(previewHtml(design));
        measurements.push(
          compareLayout(
            device,
            width,
            source[device].geometry,
            await page.evaluate<ReturnType<typeof previewGeometry>>(
              `(()=>{const __name=(fn)=>fn;return (${previewGeometry.toString()})();})()`,
            ),
          ),
        );
      }
      for (const check of measurements) {
        assert.equal(
          check.missing,
          0,
          `${name}/${check.device}: missing captured elements`,
        );
        assert.ok(
          check.p90DriftPx <= 24,
          `${name}/${check.device}: fixture geometry drift over tolerance`,
        );
      }
      report.push({
        fixture: name,
        elements: nodes.length,
        measurements,
        ...(process.env.BENCHMARK_INCLUDE_DESIGNS
          ? { design, preview: previewHtml(design) }
          : {}),
      });
      await page.close();
    }
    const viewportPage = await browser.newPage();
    await viewportPage.setViewportSize({ width: 820, height: 900 });
    await viewportPage.setContent(
      '<!doctype html><style>html{scroll-behavior:smooth}body{height:3000px}</style><h1>Top</h1><svg style="position:absolute;top:2000px;width:820px;height:100px"><rect width="820" height="100"/></svg>',
    );
    await viewportPage.locator("svg").screenshot();
    const restored = await restoreCaptureViewport(viewportPage, 390);
    assert.equal(restored.width, 390);
    assert.equal(restored.scrollY, 0);
    await viewportPage.close();
    console.log(
      JSON.stringify(
        {
          viewportRestore: restored,
          scope:
            "Controlled DOM geometry fixtures; not public-site pixel fidelity or WordPress acceptance",
          report,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
