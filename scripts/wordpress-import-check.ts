// Integration check against an isolated local WordPress installation with Elementor and the importer active.
// Put test-only user/password in .qa/wordpress-test/credentials.json; never use production credentials.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, request } from 'playwright-core';
import serverChromium from '@sparticuz/chromium';
import { exportZip } from '../lib/export';
import { previewHtml } from '../lib/elementor';
import { validateDesign } from '../lib/design';
import sharp from 'sharp';

async function main(){
 const asset='https://studio-upload.invalid/01234567890123456789012345678901.webp';
 const bytes=await sharp({create:{width:300,height:200,channels:3,background:'#1166cc'}}).webp().toBuffer();
 const base={paddingBox:[0,0,0,0],marginBox:[0,0,0,0],fontFamily:'Arial',fontWeight:'400',fontSize:16,lineHeight:24,color:'#172323',width:100,flexShrink:0} as any;
 const design=validateDesign({title:'Import QA',source:'https://example.com/',assets:{[asset]:'data:image/webp;base64,'+bytes.toString('base64')},warnings:[],nodes:[{id:'aa000001',kind:'container',style:{...base,gap:0,direction:'column'},children:[
 {id:'aa000002',kind:'container',style:{...base,direction:'row',justify:'space-between',alignItems:'center',paddingBox:[20,24,20,24],minHeight:100,height:140,heightAuto:false,background:'#eaf2ff',gap:20},mobile:{heightAuto:true},children:[{id:'aa000003',kind:'image',url:asset,alt:'Local logo',style:{...base,width:10,widthPx:120,height:50,heightAuto:true,aspectRatio:1.5,objectPosition:"50% 20%",objectFit:'contain'},children:[]},{id:'aa000004',kind:'heading',text:'Studio import test',level:1,style:{...base,fontSize:30,lineHeight:36,width:60},children:[]},{id:'aa000005',kind:'button',text:'Contact',url:'https://example.com/contact',style:{...base,width:20,paddingBox:[10,16,10,16],background:'#1155aa',color:'#ffffff'},children:[]}]},
 {id:'aa000009',kind:'search',text:'Find a page',style:{...base,paddingBox:[10,12,10,12],borderWidth:1,borderStyle:'solid',borderColor:'#222222'},children:[]},
 {id:'aa000006',kind:'container',style:{...base,layout:'grid',columns:[1,1,1],gap:24,rowGap:24,paddingBox:[24,24,24,24]},tablet:{columns:[1,1]},mobile:{columns:[1]},children:[1,2,3].map(i=>({id:'ab00000'+i,kind:'container' as const,style:{...base,gap:12,direction:'column'},children:[{id:'ac00000'+i,kind:'image' as const,url:asset,alt:'Product '+i,style:{...base,height:200,heightAuto:true,aspectRatio:1.5,objectPosition:"50% 20%",objectFit:'cover' as const},children:[]},{id:'ad00000'+i,kind:'heading' as const,text:'Product '+i,level:2,style:{...base,fontSize:24,lineHeight:30},children:[]},{id:'ae00000'+i,kind:'text' as const,text:'Editable product description',style:base,children:[]}]}))},
 {id:'aa000007',kind:'container',style:{...base,display:'flow-root',minHeight:120,height:140,heightAuto:false,paddingBox:[24,24,24,24],background:'#172323',color:'#ffffff',gap:0},children:[{id:'aa000008',kind:'text',text:'Footer contact information',style:{...base,color:'#ffffff',display:'inline-block',float:'left',width:50,flexShrink:0,verticalAlign:'top'},mobile:{float:'none',clear:'both',width:100},children:[]}]}
 ]}]});
 const zip=await exportZip([design]);fs.writeFileSync('.qa/wordpress-test/package.zip',zip);fs.writeFileSync('.qa/wordpress-test/design.json',JSON.stringify(design));
 const creds=JSON.parse(fs.readFileSync('.qa/wordpress-test/credentials.json','utf8'));
 const api=await request.newContext({baseURL:'http://127.0.0.1:8777'});
 await api.get('/wp-login.php');await api.post('/wp-login.php',{form:{log:creds.user,pwd:creds.password,'wp-submit':'Log In',redirect_to:'http://127.0.0.1:8777/wp-admin/',testcookie:'1'}});
 const form=await (await api.get('/wp-admin/tools.php?page=elementor-studio')).text();const nonce=form.match(/name="_wpnonce" value="([^"]+)"/)?.[1];if(!nonce)throw new Error('No importer nonce');
 const imported=await (await api.post('/wp-admin/tools.php?page=elementor-studio',{multipart:{_wpnonce:nonce,estudio_import:'1',package:{name:'package.zip',mimeType:'application/zip',buffer:zip}}})).text();
 fs.writeFileSync('.qa/wordpress-test/import-response.html',imported);
 const id=imported.match(/post=(\d+)(?:&#038;|&amp;|&)action=elementor/)?.[1];if(!id)throw new Error('No imported draft: '+imported.match(/notice-error[\s\S]{0,400}/)?.[0]);
 console.log('Draft imported',id);
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || '.qa/chromium/chromium',args:serverChromium.args,headless:true});
 const ctx=await browser.newContext({storageState:await api.storageState()});const page=await ctx.newPage();
 const report:any={id,devices:[]};
 try{for(const [device,width] of Object.entries({desktop:1440,tablet:820,mobile:390})){
 await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8777/?page_id='+id+'&preview=true',{waitUntil:'load'});
 const actual=await page.evaluate(()=>Array.from(document.querySelectorAll('[data-id]')).map(e=>{const r=e.getBoundingClientRect();return{id:e.getAttribute('data-id'),x:r.x,y:r.y,width:r.width,height:r.height}}));
 const images=await page.locator('.elementor img').evaluateAll(es=>es.map(e=>({src:(e as HTMLImageElement).src,loaded:(e as HTMLImageElement).naturalWidth>0,objectPosition:getComputedStyle(e).objectPosition})));
 assert.ok(images.every(i=>i.objectPosition==='50% 20%'),'Captured focal point must override Elementor default');
 await page.screenshot({path:'.qa/wp-'+device+'.png'});fs.writeFileSync('.qa/wordpress-test/frontend-'+device+'.html',await page.content());
 await page.setContent(previewHtml(design),{waitUntil:'domcontentloaded'});const expected=await page.evaluate(()=>Array.from(document.querySelectorAll('[data-estudio-id]')).map(e=>{const r=e.getBoundingClientRect();return{id:e.getAttribute('data-estudio-id'),x:r.x,y:r.y,width:r.width,height:r.height}}));
 report.devices.push({device,images,boxes:actual.map(a=>{const e=expected.find(e=>e.id===a.id);return{actual:a,expected:e,drift:e?Math.max(Math.abs(a.x-e.x),Math.abs(a.y-e.y),Math.abs(a.width-e.width),Math.abs(a.height-e.height)):null}})});
 }
 fs.writeFileSync('.qa/wordpress-test/geometry.json',JSON.stringify(report,null,2));
 for(const device of report.devices){
   assert.equal(device.boxes.length,21,'All native elements must be measured');
   assert.equal(device.images.length,4,'All packaged images must be present');
   assert.ok(device.images.every((i:any)=>i.loaded&&i.src.startsWith('http://127.0.0.1:8777/wp-content/uploads/')),'Images must be served from the WordPress Media Library');
   assert.ok(device.boxes.every((b:any)=>b.expected&&b.drift<=2),'Native layout must match preview within 2px');
 }
 await page.goto('http://127.0.0.1:8777/wp-admin/post.php?post='+id+'&action=elementor',{waitUntil:'domcontentloaded'});await page.waitForTimeout(6000);await page.screenshot({path:'.qa/wp-editor.png',timeout:5000}).catch(()=>{});report.editorTitle=await page.title();
 await page.waitForFunction(()=>!!(window as any).elementor?.elements?.length);
 await page.evaluate(async()=>{
   const w=window as any;
   const heading=w.elementor.elements.at(0).get('elements').at(0).get('elements').at(1);
   if(heading.get('id')!=='aa000004') throw new Error('Unexpected heading');
   heading.get('settings').set('title','Edited in Elementor');
   w.elementor.elements.at(0).get('elements').at(1).get('settings').set('studio_search_placeholder','Search our site');
   w.$e.internal('document/save/set-is-modified',{status:true});
   await w.$e.run('document/save/draft');
 });
 await page.goto('http://127.0.0.1:8777/?page_id='+id+'&preview=true',{waitUntil:'load'});
 report.editorSaveVerified=await page.locator('.elementor-element-aa000004').innerText()==='Edited in Elementor';
 if(!report.editorSaveVerified)throw new Error('Edited heading was not persisted');
 const search=page.locator('.estudio-search-input');
 assert.equal(await search.getAttribute('placeholder'),'Search our site');
 await search.fill('StudioSearchFixtureUnique');
 await Promise.all([page.waitForURL(/s=StudioSearchFixtureUnique/),search.press('Enter')]);
 assert.equal(new URL(page.url()).origin,'http://127.0.0.1:8777');
 assert.ok((await page.locator('body').innerText()).includes('StudioSearchFixtureUnique result'));
 report.localSearchVerified=true;
 await page.goto('http://127.0.0.1:8777/?s=NoMatchStudioFixture729183',{waitUntil:'load'});
 const empty=await page.locator('body').innerText();
 assert.ok(!empty.includes('StudioSearchFixtureUnique result'));
 assert.match(empty,/nothing|no results|could not find|sorry/i);
 report.emptySearchVerified=true;

 fs.writeFileSync('.qa/wordpress-test/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({draft:id,devices:report.devices.map((d:any)=>({device:d.device,elements:d.boxes.length,maxDriftPx:Math.max(...d.boxes.map((b:any)=>b.drift))})),editorSaveVerified:report.editorSaveVerified,localSearchVerified:report.localSearchVerified,emptySearchVerified:report.emptySearchVerified}));
 }finally{await browser.close();await api.dispose()}
}
main().catch(e=>{console.error(e);process.exit(1)});
