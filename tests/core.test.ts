import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { briefDesign, validateDesign } from "../lib/design";
import { toElementor, previewHtml } from "../lib/elementor";
import { normalizeUrl, publicIP } from "../lib/network";
import { staticDesign } from "../lib/crawler";
import { exportZip } from "../lib/export";
import { POST as build } from "../app/api/build/route";
import { refine } from "../lib/provider";
test("private, loopback, mapped, reserved and credentialed URLs are rejected", () => {
  for (const u of [
    "http://127.0.0.1",
    "http://2130706433",
    "http://10.0.0.1",
    "http://169.254.169.254/latest",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "file:///etc/passwd",
    "http://localhost",
    "http://user:pass@example.com",
    "http://example.com:3000",
  ])
    assert.throws(() => normalizeUrl(u));
  assert.equal(publicIP("100.64.0.1"), false);
  assert.equal(publicIP("172.16.0.2"), false);
  assert.equal(publicIP("8.8.8.8"), true);
  assert.equal(
    normalizeUrl("https://example.com/page#x").href,
    "https://example.com/page",
  );
});
test("brief creates separate native widgets with no HTML widget", () => {
  const template = toElementor(
    briefDesign("My brand\nMy original description", "Brand", "business"),
  );
  assert.equal(template.version, "0.4");
  const kinds: string[] = [];
  function walk(xs: any[]) {
    for (const x of xs) {
      kinds.push(x.widgetType || x.elType);
      walk(x.elements);
    }
  }
  walk(template.content);
  assert.ok(kinds.includes("heading"));
  assert.ok(kinds.includes("text-editor"));
  assert.ok(kinds.includes("button"));
  assert.ok(!kinds.includes("html"));
});
test("text is escaped in preview and JSON text editor", () => {
  const d = briefDesign("<script>alert(1)</script>\nText", "", "landing");
  assert.ok(!previewHtml(d).includes("<script>alert(1)</script>"));
  assert.ok(previewHtml(d).includes("&lt;script&gt;"));
  assert.ok(JSON.stringify(toElementor(d)).includes("&lt;script&gt;"));
});
test("unsafe links and duplicate IDs are rejected", () => {
  const d = briefDesign("Brand", "Brand", "landing");
  d.nodes[0].children[0].url = "javascript:alert(1)";
  assert.throws(() => validateDesign(d));
  delete d.nodes[0].children[0].url;
  d.nodes[1].id = d.nodes[0].id;
  assert.throws(() => validateDesign(d));
});
test("static landing fixture keeps headings, text and image while discarding scripts", () => {
  const d = staticDesign(
    '<title>Landing</title><body><main><h1>Hello</h1><p>Real content</p><img src="/logo.png"><a href="/about">About</a><script>alert(1)</script></main></body>',
    "https://example.com",
  );
  const s = JSON.stringify(d);
  assert.ok(s.includes("https://example.com/logo.png"));
  assert.ok(s.includes("Real content"));
  assert.ok(!s.includes("alert(1)"));
  assert.ok(d.warnings.some((w) => w.includes("HTML-only")));
});
test("WooCommerce-like fixture remains a static draft, never fabricated dynamic tags", () => {
  const d = staticDesign(
    '<body><section class="product"><h2>Bracket</h2><p class="price">Rs 250</p><a class="add_to_cart_button" href="/?add-to-cart=1">Add to cart</a></section></body>',
    "https://example.com",
  );
  const t = JSON.stringify(toElementor(d));
  assert.ok(t.includes("Bracket"));
  assert.ok(!t.includes("__dynamic__"));
});
test("multipage export packages independent templates, reports, previews and setup", async () => {
  const archive = await exportZip(
    [
      briefDesign("One", "One", "business"),
      briefDesign("Two", "Two", "portfolio"),
    ],
    false,
  );
  const zip = await JSZip.loadAsync(archive);
  assert.equal(
    Object.keys(zip.files).filter(
      (n) => n.endsWith(".json") && n.startsWith("templates/"),
    ).length,
    2,
  );
  assert.ok(zip.file("SETUP.txt"));
  const setup = await zip.file("SETUP.txt")!.async("string");
  assert.ok(setup.includes("Your exported page still needs testing on staging"));
  const manifest=JSON.parse(await zip.file("studio-manifest.json")!.async("string"));
  assert.equal(manifest.format,"elementor-studio-v2");
  assert.equal(manifest.pages.length,2);
  const importer=await JSZip.loadAsync(await zip.file("elementor-studio-importer.zip")!.async("nodebuffer"));
  assert.ok(importer.file("elementor-studio-importer/elementor-studio-importer.php"));
});
test("no-AI build API works without credentials and labels import untested", async () => {
  const response = await build(
    new Request("http://localhost/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route: "brief",
        mode: "none",
        input: "Client brand\nServices for local businesses",
        title: "Client",
        type: "business",
      }),
    }),
  );
  assert.equal(response.status, 200);
  const r = await response.json();
  assert.equal(r.usage.requests, 0);
  assert.equal(r.checks.wordpressImport, "Not tested");
  assert.equal(r.template.type, "page");
  assert.ok(r.preview.includes("Client"));
});
test("AI budget is checked before any provider call", async () => {
  const before = { ...process.env };
  process.env.AI_API_KEY = "test";
  process.env.AI_BASE_URL = "https://example.com/v1/";
  process.env.AI_MODEL = "test";
  process.env.AI_INPUT_RATE = "10";
  process.env.AI_OUTPUT_RATE = "20";
  try {
    await assert.rejects(
      () => refine(briefDesign("Brand", "Brand", "business"), 0),
      /No paid request was sent/,
    );
  } finally {
    for (const k of [
      "AI_API_KEY",
      "AI_BASE_URL",
      "AI_MODEL",
      "AI_INPUT_RATE",
      "AI_OUTPUT_RATE",
    ])
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
  }
});
test("failed provider calls remain recorded instead of reporting zero usage", async () => {
  const original = global.fetch;
  const before = { ...process.env };
  process.env.AI_API_KEY = "test";
  process.env.AI_BASE_URL = "https://example.com/v1/";
  process.env.AI_MODEL = "test";
  process.env.AI_INPUT_RATE = "0";
  process.env.AI_OUTPUT_RATE = "0";
  global.fetch = async () => {
    throw new Error("Offline");
  };
  try {
    const response = await build(
      new Request("http://localhost/api/build", {
        method: "POST",
        body: JSON.stringify({
          route: "brief",
          mode: "paid",
          input: "Brand",
          title: "Brand",
          type: "business",
          budget: 1,
        }),
      }),
    );
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.usage.requests, 1);
    assert.equal(result.usage.cost, null);
    assert.equal(result.usage.exact, false);
    assert.ok(result.template.content.length);
  } finally {
    global.fetch = original;
    for (const k of [
      "AI_API_KEY",
      "AI_BASE_URL",
      "AI_MODEL",
      "AI_INPUT_RATE",
      "AI_OUTPUT_RATE",
    ])
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
  }
});
test("export rejects private image destinations as well as unsafe script links", () => {
  const d = briefDesign("Brand", "Brand", "business");
  d.nodes[0].children.push({
    id: "abcd1234",
    kind: "image",
    url: "http://169.254.169.254/latest",
    style: {},
    children: [],
  });
  assert.throws(() => toElementor(d), /Unsafe image/);
});
test("DNS-pinned transport supports Node address-array lookup requests", async () => {
  const { pinnedLookup } = await import("../lib/network");
  const lookup = pinnedLookup({ address: "8.8.8.8", family: 4 });
  const values = await new Promise<unknown>((resolve, reject) =>
    lookup("example.com", { all: true }, (error, address) =>
      error ? reject(error) : resolve(address),
    ),
  );
  assert.deepEqual(values, [{ address: "8.8.8.8", family: 4 }]);
  const single = await new Promise<unknown>((resolve, reject) =>
    lookup("example.com", {}, (error, address, family) =>
      error ? reject(error) : resolve([address, family]),
    ),
  );
  assert.deepEqual(single, ["8.8.8.8", 4]);
});
test("responsive hidden elements stay hidden in preview and Elementor export", () => {
  const d = briefDesign("Business page", "Example", "business");
  d.nodes[0].mobile = { hidden: true };
  d.nodes[0].tablet = { hidden: true };
  const html = previewHtml(d);
  assert.match(html, /display:none/);
  const result = toElementor(d);
  assert.equal(result.content[0].settings.hide_mobile, "hidden-mobile");
  assert.equal(result.content[0].settings.hide_tablet, "hidden-tablet");
});

test("preview preserves background image query parameters", () => {
  const d = briefDesign("Business page", "Example", "business");
  d.nodes[0].style.backgroundImage = "https://example.com/hero.jpg?v=123&width=1200";
  const html = previewHtml(d);
  assert.match(html, /background-image:url\("https:\/\/example.com\/hero.jpg\?v=123&width=1200"\)/);
  assert.ok(!html.includes("&amp;width"));
});
