import test from "node:test";
import assert from "node:assert/strict";
import { briefDesign } from "../lib/design";
import { toElementor, previewHtml } from "../lib/elementor";
import { addWidget } from "../lib/editor-tree";
import { qualityReport } from "../lib/quality-report";
test("search is a native plugin widget with escaped preview and editable placeholder",()=>{
 const d=briefDesign("Test","Test","business");
 d.nodes=[{id:"abcdef12",kind:"search",text:'Find <script>alert(1)</script>',style:{fontSize:16},children:[]}];
 const e=toElementor(d).content[0];
 assert.equal(e.widgetType,"estudio-search");
 assert.equal(e.settings.studio_search_placeholder,d.nodes[0].text);
 assert.ok(previewHtml(d).includes('placeholder="Find &lt;script&gt;'));
 assert.ok(!previewHtml(d).includes('action="https://'));
 assert.equal(qualityReport(d).issues.find(i=>i.code==="search-runtime")?.severity,"review");
});
test("editor can add a new search widget without a source site endpoint",()=>{
 const d=briefDesign("Test","Test","business");
 const updated=addWidget(d,d.nodes[0].id,"search");
 const n=updated.nodes[0].children.at(-1)!;
 assert.equal(n.kind,"search");assert.equal(n.url,undefined);
 assert.equal(d.nodes[0].children.some(n=>n.kind==="search"),false);
});
