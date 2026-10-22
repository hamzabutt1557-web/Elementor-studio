import test from "node:test";
import assert from "node:assert/strict";
import { briefDesign } from "../lib/design";
import { preserveSource } from "../lib/preserve-source";
import { compareLayout } from "../lib/layout-audit";
import { mergeResponsive } from "../lib/responsive";
import { previewHtml, toElementor } from "../lib/elementor";
test("AI style refinement cannot delete, reorder or rewrite captured content and links", () => {
  const design = briefDesign("Brand\nOriginal words", "Brand", "business");
  const style = structuredClone(design);
  style.nodes[0].style.padding = 24;
  assert.equal(preserveSource(design, style).nodes[0].style.padding, 24);
  for (const change of [
    (d: typeof design) => {
      d.nodes.pop();
    },
    (d: typeof design) => {
      d.nodes.reverse();
    },
    (d: typeof design) => {
      d.nodes[0].children[0].text = "invented";
    },
    (d: typeof design) => {
      d.source = "https://other.example/";
    },
    (d: typeof design) => {
      d.catalogTools = true;
    },
    (d: typeof design) => {
      d.nodes[0].style.backgroundImage = "https://other.example/new.png";
    },
  ]) {
    const proposed = structuredClone(design);
    change(proposed);
    assert.throws(
      () => preserveSource(design, proposed),
      /original draft was preserved/,
    );
  }
});
test("geometry audit reports actual drift and missing elements, never a similarity percentage", () => {
  const box = { x: 0, y: 0, width: 100, height: 50 };
  const result = compareLayout(
    "mobile",
    390,
    { a: box, b: box, c: box },
    { a: box, b: { ...box, y: 40 } },
  );
  assert.equal(result.compared, 2);
  assert.equal(result.missing, 1);
  assert.equal(result.shifted, 1);
  assert.equal(result.p90DriftPx, 40);
  assert.equal("similarity" in result, false);
});
test("responsive capture resets background image, border and position in preview and native controls", () => {
  const design = briefDesign("Brand", "Brand", "business");
  const d = structuredClone(design.nodes[0]);
  d.style = {
    backgroundImage: "https://images.example/hero.png",
    borderWidth: 3,
    position: "absolute",
    left: 20,
    minHeight: 300,
    width: 80,
    maxWidth: 960,
  };
  const m = structuredClone(d);
  m.style = {
    backgroundImage: "",
    borderWidth: 0,
    position: "static",
    left: 0,
    minHeight: 0,
    width: 100,
    maxWidth: 10000,
  };
  design.nodes = mergeResponsive([d], [m], [m]);
  const e = toElementor(design).content[0];
  assert.equal((e.settings.width as any).size, "min(80%, 960px)");
  assert.equal((e.settings.background_image_tablet as any).url, "");
  assert.equal(e.settings.border_border_tablet, "none");
  assert.equal(e.settings.position_tablet, "");
  const html = previewHtml(design);
  assert.match(html, /background-image:none/);
  assert.ok(!html.includes('background-image:url("")'));
});
test("local product UI is opt-in in preview and native JSON", () => {
  const d = briefDesign("Shop", "Shop", "business");
  assert.ok(!previewHtml(d).includes('<span class="estudio-tools"'));
  d.catalogTools = true;
  assert.ok(previewHtml(d).includes('<span class="estudio-tools" hidden>'));
  assert.ok(
    String(toElementor(d).content[0].settings.css_classes).includes(
      "estudio-tools",
    ),
  );
});

test("malformed or truncated font quotes cannot consume the rest of the stylesheet", async () => {
  const { cssFontStack } = await import("../lib/font-types");
  const d = briefDesign("Brand", "Brand", "business");
  d.nodes[0].style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", "Segoe UI Symbol';
  const css = cssFontStack(d.nodes[0].style.fontFamily);
  assert.ok(css.endsWith('"Segoe UI Symbol"'));
  assert.equal((css.match(/"/g) || []).length % 2, 0);
  assert.ok(!cssFontStack("Bad;}body{display:none").includes("display"));
  const html = previewHtml(d);
  assert.ok(html.includes("font-family:" + css));
});
