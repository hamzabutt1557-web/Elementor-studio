/** Real browser regression: capture three breakpoints, compare at three uncaptured widths. */
import {chromium} from 'playwright-core';
import serverChromium from '@sparticuz/chromium';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {captureDocument} from '../lib/capture-document';
import {mergeResponsive} from '../lib/responsive';
import {previewHtml} from '../lib/elementor';
import {type LayoutBox,compareLayout,previewGeometry} from '../lib/layout-audit';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||await serverChromium.executablePath(),args:['--no-sandbox','--disable-gpu'],headless:true});
 try{
 const page=await browser.newPage();const png=await sharp({create:{width:300,height:450,channels:3,background:'#147d68'}}).png().toBuffer();
 await page.route('https://fixture.example/**',r=>r.fulfill({body:png,contentType:'image/png'}));
 const html=`<!doctype html><style>*{box-sizing:border-box}body{margin:0;font:16px/24px Arial}header{height:140px;display:flex;align-items:center;padding:20px;gap:24px}header img{width:60px;height:auto}main{padding:24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}article{border:2px solid #ddd;padding:10px}article img{display:block;width:100%;height:auto;object-fit:cover;object-position:50% 20%}h2{font-size:20px;line-height:24px;margin:12px 0}.sizes{font-size:0;line-height:normal}.sizes span{display:inline-block;font-size:12px;line-height:18px;margin-right:4px;padding:4px;border:1px solid #aaa}footer{height:120px;background:#eee;padding:20px}@media(max-width:1024px){main{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:767px){main{grid-template-columns:1fr}header{height:100px}}</style><header><img src="https://fixture.example/logo.png"><strong>Store logo</strong></header><main>${[1,2,3].map(i=>`<article><img src="https://fixture.example/${i}.png"><h2>Product ${i}</h2><div style="visibility:hidden;width:30px;height:30px;margin-bottom:15px">Hidden</div><div style="margin-bottom:18px"></div><div class="sizes"><span>S</span><span>M</span><span>L</span></div></article>`).join('')}</main><footer>Footer stays after the products</footer>`;
 const capture=()=>page.evaluate<ReturnType<typeof captureDocument>>(`(()=>{const __name=f=>f;return (${captureDocument.toString()})();})()`);
 const snapshots:any[]=[];
 for(const width of [1440,820,390]){await page.setViewportSize({width,height:900});await page.setContent(html);snapshots.push(await capture());}
 const design={title:'Responsive sizing',source:'https://fixture.example/',nodes:mergeResponsive(snapshots[0].nodes,snapshots[1].nodes,snapshots[2].nodes),warnings:[]};
 const results=[];
 for(const width of [1100,900,600]){
  await page.setViewportSize({width,height:900});await page.setContent(html);const source=await capture();
  await page.setContent(previewHtml(design));const actual=await page.evaluate<Record<string,LayoutBox>>(`(()=>{const __name=f=>f;return (${previewGeometry.toString()})();})()`);
  const report=compareLayout(String(width),width,source.geometry,actual);results.push(report);
  for(const [id,b] of Object.entries(source.geometry) as any) {const a=actual[id];if(a) assert.ok(Math.max(...(['x','y','width','height'] as const).map(k=>Math.abs(a[k]-b[k])))<=2,JSON.stringify({id,b,a}));}
  assert.equal(report.missing,0);assert.ok(report.p90DriftPx<=2,JSON.stringify(report));
 }
 console.log(JSON.stringify({scope:'Source-to-preview geometry at uncaptured viewport widths; not WordPress acceptance',results},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
