import test from "node:test";
import assert from "node:assert/strict";
import { briefDesign, validateDesign } from "../lib/design";
import { rebrand } from "../lib/brand";
import { toElementor, previewHtml } from "../lib/elementor";
test("rebranding changes editable text/font/buttons without mutating original", () => {
  const d=briefDesign("Old Brand\nOriginal description", "Old Brand", "business");
  const changed=rebrand(d,{name:"New Brand",oldName:"Old Brand",font:"Georgia",accent:"#ab1234"});
  assert.equal(d.title,"Old Brand");
  assert.equal(changed.title,"New Brand");
  const json=JSON.stringify(toElementor(changed));
  assert.ok(json.includes("New Brand")); assert.ok(json.includes("Georgia")); assert.ok(json.includes("#ab1234"));
  assert.ok(!json.includes("Old Brand"));
});
test("native container export preserves background image, asymmetric padding and width", () => {
  const d=briefDesign("Brand", "Brand", "business");
  d.nodes[0].style={direction:"row",width:80,paddingBox:[10,20,30,40],backgroundImage:"https://example.com/hero.jpg",backgroundSize:"cover",minHeight:500,wrap:"wrap"};
  const t=toElementor(d).content[0].settings;
  assert.deepEqual(t.background_image,{url:"https://example.com/hero.jpg",id:""});
  assert.equal((t.padding as any).left,"40");
  assert.equal((t.width as any).size,80);
  assert.ok(previewHtml(d).includes("background-image:url"));
  d.nodes[0].style.backgroundImage="javascript:alert(1)";
  assert.throws(()=>validateDesign(d));
});

test('global palette applies roles and preserves unspecified colours',()=>{
 const d=briefDesign('Example','Example','business');d.nodes[0].region='header';d.nodes[2].region='footer';
 const result=rebrand(d,{name:'',oldName:'',font:'Original',accent:'#123456',colours:{primary:'#112233',secondary:'#445566',header:'#abcdef',footer:'#fedcba',button:'#778899',buttonText:'#ffffff'}});
 assert.equal(result.nodes[0].style.background,'#abcdef');assert.equal(result.nodes[2].style.background,'#fedcba');assert.equal(result.nodes[0].children[0].style.color,'#112233');assert.equal(result.nodes[0].children[1].style.color,'#445566');assert.equal(result.nodes[0].children[2].style.background,'#778899');assert.equal(d.nodes[0].style.background,'#edf5f0');
});
