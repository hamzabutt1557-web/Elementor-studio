import {chromium} from 'playwright-core';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.cwd()+'/.qa/chromium/chromium',headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage();page.setDefaultTimeout(20000); const id=JSON.parse(readFileSync('.qa/contact-id.json','utf8'));
 await page.goto('http://127.0.0.1:8777/?page_id='+id);
 await page.locator('.estudio-contact').waitFor();
 const data=await page.locator('.estudio-contact').evaluate(f=>Object.fromEntries(new FormData(f)));
 const url='http://127.0.0.1:8777/wp-admin/admin-post.php';
 const valid={...data,studio_name:'Contact QA Person',studio_email:'qa@example.test',studio_message:'Private contact fixture message.'};
 const post=async(fields,status)=>{const r=await page.request.post(url,{form:fields});assert.equal(r.status(),status,await r.text());return r.json();};
 await post({...valid,studio_nonce:'invalid'},403);
 await post({...valid,studio_email:'not-an-email'},422);
 await post({...valid,studio_message:''},422);
 await post({...valid,studio_website:'spam.example'},400);
 await post({...valid,studio_widget:'11111111'},403);
 const malformed={...valid,'studio_name[]':'bad'};delete malformed.studio_name;await post(malformed,422);
 await page.locator('[name=studio_name]').fill(valid.studio_name);
 await page.locator('[name=studio_email]').fill(valid.studio_email);
 await page.locator('[name=studio_message]').fill(valid.studio_message);
 await page.getByRole('button',{name:'Send test message'}).click();
 await page.waitForFunction(()=>document.querySelector('.estudio-contact [role=status]')?.textContent.includes('has been saved'));
 assert.equal(await page.locator('[name=studio_message]').inputValue(),'');
 for(let i=0;i<4;i++)assert.equal((await post({...valid,studio_message:'Quota fixture '+i},200)).success,true);
 await post(valid,429);
 for (const width of [1440,820,390]) {await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 console.log('PASS: live form render, successful browser submission, field reset, nonce, email, required fields, honeypot, unknown widget, malformed input, throttle, three viewport widths');
} finally {await browser.close();}
