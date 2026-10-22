import test from "node:test";
import assert from "node:assert/strict";
import { staticDesign } from "../lib/crawler";
import { briefDesign, DesignNode, validateDesign } from "../lib/design";
import { previewHtml, toElementor, videoSource } from "../lib/elementor";
import {
  assertCaptureAccess,
  assertServerAiAccess,
  serverBudget,
} from "../lib/resource-policy";
import { proxy } from "../proxy";
import { NextRequest, type NextFetchEvent } from "next/server";
import { importerPhp } from "../lib/importer";
import { interactionCss, interactionScript } from "../lib/interactions";

const nodes = (items: DesignNode[]): DesignNode[] =>
  items.flatMap((n) => [n, ...nodes(n.children)]);
test("HTML fallback retains rich emphasis, inline links and linked image cards", () => {
  const d = staticDesign(
    '<title>Agency</title><main><p>Hello <strong>bold</strong> and <a href="/contact"><em>contact</em></a>.</p><a href="/work"><div><img src="/photo.jpg" alt="Work"></div></a></main>',
    "https://example.com",
  );
  const html = previewHtml(d);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(
    html,
    /<a href="https:\/\/example.com\/contact"><em>contact<\/em><\/a>/,
  );
  assert.match(html, /href="https:\/\/example.com\/work"/);
  const e = toElementor(d);
  const card = e.content[0].elements.find((e) => e.settings.html_tag === "a");
  assert.equal((card?.settings.link as any).url, "https://example.com/work");
  assert.equal(e.content[0].elements[0].isInner, false);
});
test("form fields survive as labelled placeholders with explicit unsupported-backend warning", () => {
  const d = staticDesign(
    '<form><label>Email</label><input name="email"><textarea placeholder="Message"></textarea><select name="service"><option>Design</option></select><button>Send</button></form>',
    "https://example.com",
  );
  assert.equal(
    nodes(d.nodes).filter((n) => n.text?.startsWith("[Form field:")).length,
    3,
  );
  assert.ok(d.warnings.some((w) => w.includes("3 form fields")));
  assert.ok(d.warnings.some((w) => w.includes("no submission backend")));
});
test("rich text accepts no executable markup and rejects unsafe nested links", () => {
  const d = briefDesign("Test", "Test", "business"),
    n = d.nodes[0].children[0];
  n.text = "<script>alert(1)</script>";
  n.runs = [{ text: n.text, bold: true }];
  assert.match(previewHtml(d), /<strong>&lt;script&gt;/);
  n.runs[0].link = "javascript:alert(1)";
  assert.throws(() => validateDesign(d), /rich text/);
});
test("editing plain text invalidates old rich runs instead of silently restoring old content", () => {
  const d = briefDesign("Test", "Test", "business"),
    n = d.nodes[0].children[0];
  n.runs = [{ text: "Old", bold: true }];
  n.text = "New";
  assert.ok(previewHtml(d).includes(">New</h2>"));
});
test("manual JSON exports drawers as inline content, plugin runtime restores fixed overlay", () => {
  const d = briefDesign("Test", "Test", "business");
  d.nodes[0].panel = true;
  d.nodes[0].style = {
    position: "fixed",
    zIndex: 10000,
    top: 0,
    left: 0,
    height: 900,
  };
  const s = toElementor(d).content[0].settings;
  assert.equal(s.position, ""); // Explicit reset keeps manual JSON in normal document flow.
  assert.equal(s.z_index, undefined);
  assert.ok(interactionCss.includes("position:fixed!important"));
  assert.ok(interactionScript.includes("has('elementor-preview')"));
});
test("video maps to native free Elementor video widget with bounded preview embeds", () => {
  const d = briefDesign("Test", "Test", "business");
  d.nodes[0].children = [
    {
      id: "abcdef12",
      kind: "video",
      url: "https://www.youtube.com/embed/abcd1234567",
      style: { width: 100 },
      children: [],
    },
  ];
  const n = toElementor(d).content[0].elements[0];
  assert.equal(n.widgetType, "video");
  assert.equal(n.settings.video_type, "youtube");
  assert.equal(
    n.settings.youtube_url,
    "https://www.youtube.com/watch?v=abcd1234567",
  );
  assert.match(previewHtml(d), /youtube-nocookie.com\/embed\/abcd1234567/);
  assert.equal(videoSource("https://example.com/movie.mp4").type, "hosted");
});
test("private capture accepts new public domains and Shopify pages without prior registration", () => {
  const env = {
    NODE_ENV: "production",
    APP_PASSWORD: "private-workspace",
    CAPTURE_ALLOWED_HOSTS: "obsolete.example",
  };
  for (const url of [
    "https://example.com/new-page",
    "https://new-shop.myshopify.com/products/example",
    "https://new-brand.example/collections/all",
  ])
    assert.doesNotThrow(() => assertCaptureAccess(url, env));
  assert.throws(
    () =>
      assertCaptureAccess("https://example.com", { NODE_ENV: "production" }),
    /private workspace/,
  );
  for (const url of [
    "http://127.0.0.1/",
    "http://localhost/",
    "http://192.168.1.1/",
    "file:///etc/passwd",
    "https://user:pass@example.com",
  ])
    assert.throws(() => assertCaptureAccess(url, env));
});
test("server key requires private access and client budget cannot raise server cap", () => {
  assert.throws(
    () => assertServerAiAccess({ NODE_ENV: "production" }),
    /disabled/,
  );
  assert.doesNotThrow(() =>
    assertServerAiAccess({
      NODE_ENV: "production",
      APP_PASSWORD: "configured",
    }),
  );
  assert.equal(serverBudget(50, { AI_MAX_REQUEST_USD: "0.10" }), 0.1);
  assert.equal(serverBudget(0, { AI_MAX_REQUEST_USD: "1" }), 0);
});
test("mixed auto margins keep numeric vertical values in px", () => {
  const d = briefDesign("Test", "Test", "business");
  d.nodes[0].style = { marginAuto: true, marginBox: [12, 0, 24, 0] };
  const margin = toElementor(d).content[0].settings.margin as any;
  assert.equal(margin.top, "12px");
  assert.equal(margin.bottom, "24px");
  assert.equal(margin.left, "auto");
});
test("importer offers additive native globals and rolls back kit on failed imports", () => {
  assert.ok(importerPhp.includes('name="studio_globals"'));
  assert.ok(importerPhp.includes("globals/colors?id="));
  assert.ok(importerPhp.includes("globals/typography?id="));
  assert.ok(importerPhp.includes("$old_kit !== null"));
});

test("embedded WordPress runtime matches current trusted script and CSS exactly", () => {
  assert.ok(importerPhp.includes(interactionScript));
  assert.ok(importerPhp.includes(interactionCss));
});

test("production server routes fail closed without password while client preview stays public", async () => {
  const previous = {
    mode: process.env.NODE_ENV,
    password: process.env.APP_PASSWORD,
  };
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.APP_PASSWORD;
    assert.equal(
      (
        await proxy(
          new NextRequest("https://studio.example/api/build"),
          {} as NextFetchEvent,
        )
      )?.status,
      503,
    );
    process.env.APP_PASSWORD = "test-password";
    assert.equal(
      (
        await proxy(
          new NextRequest("https://studio.example/api/build"),
          {} as NextFetchEvent,
        )
      )?.status,
      401,
    );
    assert.equal(
      (
        await proxy(
          new NextRequest("https://studio.example/share"),
          {} as NextFetchEvent,
        )
      )?.status,
      200,
    );
    const req = new NextRequest("https://studio.example/api/build", {
      headers: {
        authorization:
          "Basic " + Buffer.from("owner:test-password").toString("base64"),
      },
    });
    assert.equal((await proxy(req, {} as NextFetchEvent))?.status, 200);
  } finally {
    Object.assign(process.env, { NODE_ENV: previous.mode });
    if (previous.password === undefined) delete process.env.APP_PASSWORD;
    else process.env.APP_PASSWORD = previous.password;
  }
});
