import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { briefDesign, DesignNode, validateDesign } from '../lib/design';
import { toElementor, previewHtml } from '../lib/elementor';
import { mergeResponsive } from '../lib/responsive';
import { interactionScript } from '../lib/interactions';
import { importerPhp } from '../lib/importer';
import { readFileSync } from 'node:fs';

test('mobile-only navigation survives breakpoint merging and has no desktop duplicate',()=>{
 const node=(id:string,text:string):DesignNode=>({id,kind:'button',text,style:{fontSize:16},children:[]});
 const merged=mergeResponsive([node('aaaaaaa1','Desktop')],[node('aaaaaaa1','Desktop')],[node('bbbbbbb2','Mobile')]);
 assert.equal(merged.length,2);
 assert.equal(merged[0].mobile?.hidden,true);
 assert.equal(merged[1].style.hidden,true);
 assert.equal(merged[1].mobile?.hidden,false);
 const d=briefDesign('Test','Test','business');d.nodes=merged;
 const content=toElementor(d).content;
 assert.equal(content[1].settings.hide_desktop,'hidden-desktop');
 assert.equal(content[1].settings.hide_mobile,'');
});
test('widget margins and padding export to editable Advanced controls',()=>{
 const d=briefDesign('Test','Test','business');const n=d.nodes[0].children[0];n.style.paddingBox=[1,2,3,4];n.style.marginBox=[5,6,7,8];
 const settings=toElementor(d).content[0].elements[0].settings;
 assert.equal((settings._padding as any).left,'4');assert.equal((settings._margin as any).top,'5');assert.equal(settings.padding,undefined);
});
test('grid retains separate gaps and spans in native JSON and preview',()=>{
 const d=briefDesign('Test','Test','business');d.nodes[0].style={layout:'grid',columns:[1,2],gap:24,rowGap:48};d.nodes[0].children[0].style.columnSpan=2;
 const e=toElementor(d).content[0];assert.equal(e.settings.container_type,'grid');
 assert.equal((e.settings.grid_gaps as any).row,'48');assert.equal((e.settings.grid_gaps as any).column,'24');
 assert.equal(e.elements[0].settings._grid_column,'2');
 const html=previewHtml(d);assert.match(html,/grid-template-columns:minmax\(0, 1fr\) minmax\(0, 2fr\)/);assert.match(html,/row-gap:48px/);
});
test('responsive partial styles preserve desktop flex direction',()=>{
 const d=briefDesign('Test','Test','business');d.nodes[0].style.direction='row';d.nodes[0].mobile={padding:10};
 assert.match(previewHtml(d),/@media\(max-width:767px\)\{#e[a-f0-9]+\{[^}]*flex-direction:row/);
});
test('only trusted interaction runtime is executable and dangling targets are rejected',()=>{
 const d=briefDesign('Test','Test','business');d.nodes[0].children[0].text='</script><script>alert(1)</script>';
 const html=previewHtml(d);const hash=createHash('sha256').update(interactionScript).digest('base64');
 assert.ok(html.includes("script-src 'sha256-"+hash+"'"));assert.equal((html.match(/<script>/g)||[]).length,1);
 assert.ok(html.includes('<script>'+interactionScript+'</script>'));
 d.nodes[0].children[0].interaction={action:'toggle',target:'deadbeef'};
 assert.throws(()=>validateDesign(d),/target is missing/);
});
test('packaged importer is the current plugin with grid and interaction support',()=>{
 assert.equal(importerPhp,readFileSync(new URL('../wordpress/elementor-studio-importer.php',import.meta.url),'utf8'));
 assert.ok(importerPhp.includes('grid_columns_grid'));assert.ok(importerPhp.includes('estudio-runtime'));
 assert.ok(importerPhp.includes('function estudio_refresh_page_css($post_id)'));
 assert.ok(importerPhp.includes('estudio_refresh_page_css($id)'));
 assert.ok(importerPhp.includes('Version: 0.4.11'));
});

test('partial breakpoint grid columns export with inherited grid context',()=>{
 const d=briefDesign('Responsive','Grid','business');
 d.nodes[0].style={layout:'grid',columns:[1,1,1]};
 d.nodes[0].tablet={columns:[1,1]};d.nodes[0].mobile={columns:[1]};
 const s=toElementor(d).content[0].settings;
 assert.equal((s.grid_columns_grid_tablet as any).size,'minmax(0, 1fr) minmax(0, 1fr)');
 assert.equal((s.grid_columns_grid_mobile as any).size,'minmax(0, 1fr)');
});

test('floated source layout and asymmetric borders remain editable across breakpoints',()=>{
 const d=briefDesign('Flow','Flow','business');
 d.nodes[0].style={display:'flow-root',borderStyle:'solid',borderWidths:[0,0,2,0],borderColor:'#000000'};
 d.nodes[0].children[0].style={display:'inline-block',float:'left',flexShrink:0,verticalAlign:'middle'};
 d.nodes[0].children[0].mobile={float:'none',clear:'both'};
 const e=toElementor(d).content[0];
 assert.equal(e.settings.studio_display,'flow-root');
 assert.equal((e.settings.border_width as any).bottom,'2');
 assert.equal((e.settings.border_width as any).top,'0');
 assert.equal(e.elements[0].settings.studio_float,'left');
 assert.equal(e.elements[0].settings.studio_float_mobile,'none');
 assert.equal(e.elements[0].settings.studio_clear_mobile,'both');
 assert.match(previewHtml(d),/display:flow-root/);
 assert.match(previewHtml(d),/float:left/);
});
