import test from "node:test";
import assert from "node:assert/strict";
import { editTree, addSection } from "../lib/editor-tree";
import { briefDesign, validateDesign } from "../lib/design";
import { previewHtml, toElementor } from "../lib/elementor";
test("section edits preserve valid native design and do not mutate original", () => {
  const d = briefDesign("Example", "Example", "business");
  const first = d.nodes[0].id;
  const copy = editTree(d, first, "duplicate");
  assert.equal(copy.nodes.length, 4);
  validateDesign(copy);
  assert.notEqual(copy.nodes[0].children[0].id, copy.nodes[1].children[0].id);
  assert.equal(d.nodes.length, 3);
  const moved = editTree(copy, first, "down");
  assert.equal(moved.nodes[1].id, first);
  const removed = editTree(moved, first, "delete");
  validateDesign(removed);
  assert.equal(removed.nodes.length, 3);
  const added = addSection(removed, removed.nodes[0].id);
  validateDesign(added);
  assert.equal(added.nodes[0].children.at(-1)?.kind, "container");
  assert.ok(JSON.stringify(toElementor(added)).includes("New section"));
});
test("click selection bridge is only included in editable previews", () => {
  const d = briefDesign("Example", "Example", "business");
  assert.ok(previewHtml(d, true).includes("estudio-select"));
  assert.ok(!previewHtml(d).includes("estudio-select"));
  assert.ok(!JSON.stringify(toElementor(d)).includes("estudio-select"));
});

import { moveNode } from "../lib/editor-tree";
import { POST as uploadImage } from "../app/api/image/route";
import { exportZip } from "../lib/export";
import sharp from "sharp";
import JSZip from "jszip";
test("drag moves across sections, rejects cycles and keeps source immutable", () => {
  const d = briefDesign("Example", "Example", "business");
  const child = d.nodes[0].children[0];
  const moved = moveNode(d, child.id, d.nodes[1].id, "inside");
  validateDesign(moved);
  assert.equal(moved.nodes[1].children.at(-1)?.id, child.id);
  assert.equal(d.nodes[0].children[0].id, child.id);
  assert.throws(() => moveNode(d, d.nodes[0].id, child.id, "inside"));
  assert.throws(() =>
    moveNode(d, child.id, d.nodes[1].children[0].id, "inside"),
  );
  const reordered = moveNode(d, d.nodes[0].id, d.nodes[2].id, "after");
  assert.equal(reordered.nodes[2].id, d.nodes[0].id);
});
test("uploaded image renders offline and is packaged even when remote media is disabled", async () => {
  const bytes = await sharp({
    create: { width: 30, height: 20, channels: 3, background: "#3366ff" },
  })
    .png()
    .toBuffer();
  const response = await uploadImage(
    new Request("https://studio.test/api/image", {
      method: "POST",
      body: JSON.stringify({
        data: "data:image/png;base64," + bytes.toString("base64"),
      }),
    }),
  );
  assert.equal(response.status, 200);
  const asset = await response.json();
  const d = briefDesign("Example", "Example", "business");
  d.assets = { [asset.url]: asset.data };
  d.nodes[0].style.backgroundImage = asset.url;
  d.nodes[0].children.push({
    id: "abcdef12",
    kind: "image",
    url: asset.url,
    style: { width: 50 },
    children: [],
  });
  validateDesign(d);
  const html = previewHtml(d, true);
  assert.ok(html.includes('src="data:image/webp;base64,'));
  assert.ok(html.includes('background-image:url("data:image/webp;base64,'));
  const zip = await JSZip.loadAsync(await exportZip([d], false));
  const manifest = JSON.parse(
    await zip.file("studio-manifest.json")!.async("string"),
  );
  assert.equal(manifest.media.length, 1);
  assert.equal(manifest.media[0].url, asset.url);
  assert.ok(zip.file(manifest.media[0].path));
  const missing = structuredClone(d);
  delete missing.assets;
  assert.throws(() => validateDesign(missing), /missing/);
  const bad = await uploadImage(
    new Request("https://studio.test/api/image", {
      method: "POST",
      body: JSON.stringify({ data: "data:image/svg+xml;base64,AAAA" }),
    }),
  );
  assert.equal(bad.status, 400);
});

test("free movement exports through native Elementor spacing controls", () => {
  const d = briefDesign("Example", "Example", "business");
  d.nodes[0].children[0].style = {
    position: "relative",
    left: 60,
    top: 30,
    marginBox: [2, 4, 6, 8],
  };
  const native = toElementor(d).content[0].elements[0].settings;
  assert.deepEqual(native._margin, {
    unit: "px",
    top: "32",
    right: "-56",
    bottom: "-24",
    left: "68",
    isLinked: false,
  });
});

import { alignmentDeltas, type CanvasBox } from "../lib/canvas-geometry";
import { editorScript } from "../lib/editor-runtime";
test("canvas alignment handles all six edges and centers against parent content", () => {
  const item: CanvasBox = { id: "a", x: 30, y: 40, width: 50, height: 20 };
  const parent: CanvasBox = { id: "p", x: 10, y: 10, width: 200, height: 100 };
  for (const [action, dx, dy] of [
    ["left", -20, 0],
    ["center", 55, 0],
    ["right", 130, 0],
    ["top", 0, -30],
    ["middle", 0, 10],
    ["bottom", 0, 50],
  ] as const) {
    assert.deepEqual(alignmentDeltas([item], action, parent), [
      { id: "a", dx, dy },
    ]);
  }
  assert.deepEqual(item, { id: "a", x: 30, y: 40, width: 50, height: 20 });
});
test("multiple selection aligns to selection bounds rather than an unrelated parent", () => {
  const boxes = [
    { id: "a", x: 20, y: 30, width: 40, height: 30 },
    { id: "b", x: 90, y: 100, width: 80, height: 50 },
  ];
  assert.deepEqual(alignmentDeltas(boxes, "left"), [
    { id: "a", dx: 0, dy: 0 },
    { id: "b", dx: -70, dy: 0 },
  ]);
  assert.deepEqual(alignmentDeltas(boxes, "bottom"), [
    { id: "a", dx: 0, dy: 90 },
    { id: "b", dx: 0, dy: 0 },
  ]);
  assert.deepEqual(alignmentDeltas([], "center"), []);
  assert.doesNotThrow(() => new Function(editorScript));
  assert.ok(!editorScript.includes("__name"));
});
