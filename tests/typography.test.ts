import test from "node:test";
import assert from "node:assert/strict";
import {
  fontCatalog,
  googleFont,
  fontStylesheet,
  designFonts,
} from "../lib/font-library";
import { formatText, replaceText } from "../lib/text-format";
import { briefDesign, validateDesign } from "../lib/design";
import { previewHtml, toElementor } from "../lib/elementor";
import { brandSchema, rebrand } from "../lib/brand";
import { exportZip } from "../lib/export";
import JSZip from "jszip";

test("full bundled catalog includes Urdu families and fonts beyond the former shortlist", () => {
  assert.ok(fontCatalog.families.length > 1500);
  assert.ok(googleFont("Noto Nastaliq Urdu")?.subsets.includes("arabic"));
  assert.ok(googleFont("Bungee Shade"));
  assert.equal(googleFont("Arial"), undefined);
  assert.equal(
    new Set(fontCatalog.families.map((f) => f.family)).size,
    fontCatalog.families.length,
  );
});
test("every catalog font produces a bounded Google-only URL using its available styles", () => {
  for (const f of fontCatalog.families) {
    const url = new URL(fontStylesheet(f));
    assert.equal(url.origin, "https://fonts.googleapis.com");
    assert.ok(f.weights.length || f.italicWeights.length);
    for (const w of [...f.weights, ...f.italicWeights])
      assert.ok(Number.isInteger(w) && w > 0 && w <= 1000);
  }
  const one = fontStylesheet(googleFont("Abel")!);
  assert.ok(one.includes(":wght@400&"));
  assert.ok(!one.includes(";700"));
});
test("separate words can have independent fonts while keeping bold and text content", () => {
  const text = "Hello Urdu";
  let runs = formatText(text, undefined, 0, 5, "bold");
  runs = formatText(text, runs, 6, 10, "fontFamily", "Noto Nastaliq Urdu");
  assert.equal(runs.map((r) => r.text).join(""), text);
  assert.ok(runs.find((r) => r.text === "Hello")?.bold);
  assert.equal(
    runs.find((r) => r.text === "Urdu")?.fontFamily,
    "Noto Nastaliq Urdu",
  );
  const cleared = formatText(text, runs, 6, 10, "fontFamily", "");
  assert.ok(cleared.every((r) => !r.fontFamily));
});
test("typing inside formatted text preserves the formatting around the edit", () => {
  const runs = [{ text: "Bold", bold: true }, { text: " plain" }];
  const next = replaceText("Bold plain", "Bold! plain", runs);
  assert.equal(next.map((r) => r.text).join(""), "Bold! plain");
  assert.equal(next[0].text, "Bold!");
  assert.equal(next[0].bold, true);
  assert.equal(next.at(-1)?.bold, undefined);
  assert.equal(
    replaceText("old", "new", undefined)
      .map((r) => r.text)
      .join(""),
    "new",
  );
});
test("formatting toggles only the selected range and preserves links", () => {
  const runs = [
    { text: "Hello world", bold: true, link: "https://example.com" },
  ];
  const next = formatText("Hello world", runs, 6, 11, "bold");
  assert.ok(next[0].bold);
  assert.equal(next.at(-1)?.bold, undefined);
  assert.ok(next.every((r) => r.link === "https://example.com"));
});
test("word fonts are escaped, loaded in preview and retained in editable native JSON", () => {
  const d = briefDesign("Test", "Typography", "business"),
    node = d.nodes[0].children[0];
  node.text = "Hello Urdu";
  node.style.fontFamily = "Bungee Shade";
  node.runs = formatText(
    node.text,
    undefined,
    6,
    10,
    "fontFamily",
    "Noto Nastaliq Urdu",
  );
  const html = previewHtml(d);
  assert.ok(html.includes("Noto%20Nastaliq%20Urdu"));
  assert.ok(html.includes("Bungee%20Shade"));
  assert.match(html, /<span style="font-family:/);
  const exported = toElementor(d);
  assert.equal(
    exported.content[0].elements[0].settings.typography_font_family,
    "Bungee Shade",
  );
  assert.ok(JSON.stringify(exported.content).includes("Noto Nastaliq Urdu"));
  assert.equal(exported.studio_fonts.length, 2);
  assert.equal(designFonts(d).length, 2);
});
test("unsafe inline font declarations are rejected before HTML or export", () => {
  const d = briefDesign("Test", "Test", "business"),
    node = d.nodes[0].children[0];
  node.runs = [{ text: node.text!, fontFamily: "Bad; color:red" }];
  assert.throws(() => validateDesign(d));
  assert.equal(
    brandSchema.safeParse({
      name: "",
      oldName: "",
      font: "Inter; body {",
      accent: "#123456",
    }).success,
    false,
  );
});
test("global brand fonts support the full catalog and intentionally reset word font overrides", () => {
  const d = briefDesign("Test", "Test", "business"),
    node = d.nodes[0].children[0];
  node.runs = [{ text: node.text!, fontFamily: "Lora", bold: true }];
  const brand = brandSchema.parse({
    name: "",
    oldName: "",
    font: "Noto Nastaliq Urdu",
    accent: "#123456",
  });
  const changed = rebrand(d, brand);
  assert.equal(
    changed.nodes[0].children[0].style.fontFamily,
    "Noto Nastaliq Urdu",
  );
  assert.equal(changed.nodes[0].children[0].runs?.[0].fontFamily, undefined);
  assert.ok(changed.nodes[0].children[0].runs?.[0].bold);
});
test("ZIP carries selected-font metadata and current free importer font hooks", async () => {
  const d = briefDesign("Test", "Fonts", "business");
  d.nodes[0].children[0].style.fontFamily = "Noto Nastaliq Urdu";
  const zip = await JSZip.loadAsync(await exportZip([d], false));
  const name = Object.keys(zip.files).find(
    (n) => n.startsWith("templates/") && n.endsWith(".json"),
  )!;
  const template = JSON.parse(await zip.file(name)!.async("string"));
  assert.equal(template.studio_fonts[0].family, "Noto Nastaliq Urdu");
  const plugin = await JSZip.loadAsync(
    await zip.file("elementor-studio-importer.zip")!.async("uint8array"),
  );
  const php = await plugin
    .file("elementor-studio-importer/elementor-studio-importer.php")!
    .async("string");
  assert.ok(php.includes("estudio_clean_fonts"));
  assert.ok(php.includes("elementor/fonts/additional_fonts"));
  assert.ok(php.includes("'_estudio_fonts'"));
});
