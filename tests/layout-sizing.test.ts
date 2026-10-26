import test from 'node:test';import assert from 'node:assert/strict';
import {briefDesign,validateDesign,DesignNode} from '../lib/design';import {toElementor,previewHtml} from '../lib/elementor';import {mergeResponsive} from '../lib/responsive';
test('responsive media keeps aspect ratio, focal point and auto height in Elementor',()=>{
 const d=briefDesign('Store','Store','business');d.nodes=[{id:'abcdef01',kind:'image',url:'https://example.com/product.png',style:{width:100,height:500,heightAuto:true,aspectRatio:2/3,objectPosition:'50% 20%'},children:[]}];
 const s=toElementor(d).content[0].settings;assert.deepEqual(s.height,{unit:'custom',size:'auto',sizes:[]});assert.equal(s.studio_aspect_ratio,String(2/3));assert.equal(s.studio_object_position,'50% 20%');assert.ok(previewHtml(d).includes('height:auto;aspect-ratio:0.666'));
});
test('container height and zero-size line boxes survive export with mobile reset',()=>{
 const d=briefDesign('Store','Store','business');d.nodes=[{id:'abcdef01',kind:'container',style:{height:140,heightAuto:false,fontSize:0,lineHeight:0,widthPx:120},mobile:{heightAuto:true,widthPx:0,width:100},children:[]}];
 const s=toElementor(d).content[0].settings;assert.equal(s.flex_wrap,'wrap');assert.equal(s.studio_height,'140px');assert.equal(s.studio_height_mobile,'auto');assert.deepEqual(s.typography_font_size,{unit:'px',size:0,sizes:[]});assert.deepEqual(s.typography_line_height,{unit:'px',size:0,sizes:[]});assert.deepEqual(s.width,{unit:'px',size:120,sizes:[]});assert.deepEqual(s.width_mobile,{unit:'%',size:100,sizes:[]});
});
test('node changing from desktop text into a mobile container keeps valid editable variants',()=>{
 const leaf:DesignNode={id:'abcdef01',kind:'text',text:'Desktop',style:{},children:[]};
 const group:DesignNode={id:'abcdef01',kind:'container',style:{},children:[{id:'abcdef02',kind:'text',text:'Mobile',style:{},children:[]}]};
 const nodes=mergeResponsive([leaf],[group],[group]);const d=briefDesign('Store','Store','business');d.nodes=nodes;assert.doesNotThrow(()=>validateDesign(d));assert.equal(nodes.length,2);assert.equal(nodes[0].tablet?.hidden,true);assert.equal(nodes[1].style.hidden,true);assert.equal(nodes[1].mobile?.hidden,undefined);assert.equal(nodes[1].tablet?.hidden,false);assert.ok(toElementor(d).content[1].elements.length);
});
