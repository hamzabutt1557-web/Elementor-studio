import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
(async()=>{
 const base=process.env.LOGIN_TEST_URL||'http://127.0.0.1:3107';
 const password=process.env.LOGIN_TEST_PASSWORD;if(!password)throw new Error('Set a local test password');
 if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('Local test server required');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'.qa/chromium',args:['--no-sandbox','--disable-gpu'],headless:true});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
 await page.goto(base);assert.equal(new URL(page.url()).pathname,'/sign-in');
 assert.equal((await context.request.get(base+'/api/config')).status(),401);
 await page.getByLabel('App password',{exact:true}).fill('incorrect-local-test-password');
 await page.getByRole('button',{name:'Open workspace',exact:true}).click();await page.locator('.auth-error').waitFor();
 assert.match(await page.locator('.auth-error').innerText(),/Incorrect app password/);
 await page.getByLabel('App password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Open workspace',exact:true}).click();await page.waitForURL(base+'/');
 const response=await context.request.get(base+'/api/config');assert.equal(response.status(),200);assert.equal((await response.json()).version,'0.4.17');
 const cookie=(await context.cookies()).find(c=>c.name==='studio_password_session');assert.ok(cookie?.httpOnly&&cookie?.secure);
 await page.reload();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL(base+'/sign-in');
 assert.equal((await context.request.get(base+'/api/config')).status(),401);
 await page.goto(base);assert.equal(new URL(page.url()).pathname,'/sign-in');
 await page.screenshot({path:'.qa/password-login-mobile.png'});
 console.log(JSON.stringify({mobileLoginPage:true,wrongPasswordError:true,login:true,protectedApi:true,secureHttpOnlyCookie:true,reload:true,logout:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
