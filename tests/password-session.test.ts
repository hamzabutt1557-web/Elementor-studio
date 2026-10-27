import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest,type NextFetchEvent} from 'next/server';
import {PASSWORD_COOKIE,PASSWORD_SESSION_SECONDS,issuePasswordSession,passwordMatches,passwordSessionAccess} from '../lib/password-session';
import {ownerApiAccess} from '../lib/owner-access';
import {proxy} from '../proxy';
import {POST as login} from '../app/api/auth/password/route';
import {POST as logout} from '../app/api/auth/sign-out/route';
const env={APP_PASSWORD:'fixture-password'};const now=1793060000000;
test('signed password sessions expire, reject tampering and rotate with the password',()=>{
 const token=issuePasswordSession(env,now),cookie=PASSWORD_COOKIE+'='+token;
 assert.equal(passwordSessionAccess(cookie,env,now),true);
 assert.equal(passwordSessionAccess(cookie,env,now+PASSWORD_SESSION_SECONDS*1000),false);
 assert.equal(passwordSessionAccess(cookie,{APP_PASSWORD:'changed'},now),false);
 assert.equal(passwordSessionAccess(cookie,{...env,AUTH_MODE:'email'},now),false);
 assert.equal(passwordSessionAccess(cookie.replace(/.$/,'z'),env,now),false);
 assert.equal(passwordSessionAccess(PASSWORD_COOKIE+'=fixture-password',env,now),false);
 assert.equal(passwordMatches('fixture-password',env),true);assert.equal(passwordMatches('wrong',env),false);
});
test('password form establishes a protected browser session without Basic popup; logout removes it',async()=>{
 const saved={...process.env};try{
  Object.assign(process.env,{APP_PASSWORD:'fixture-password',NODE_ENV:'production'});delete process.env.AUTH_MODE;
  const req=(path:string,body:any,origin='https://studio.example')=>new Request('https://studio.example'+path,{method:'POST',headers:{origin,'Content-Type':'application/json','x-forwarded-for':'192.0.2.71'},body:JSON.stringify(body)});
  assert.equal((await login(req('/api/auth/password',{password:'fixture-password'},'https://evil.example'))).status,403);
  assert.equal((await login(req('/api/auth/password',{password:'wrong'}))).status,401);
  const denied=await proxy(new NextRequest('https://studio.example/'),{} as NextFetchEvent);
  assert.equal(denied.status,307);assert.equal(denied.headers.get('location'),'https://studio.example/sign-in');assert.equal(denied.headers.get('www-authenticate'),null);
  assert.equal((await proxy(new NextRequest('https://studio.example/sign-in'),{} as NextFetchEvent)).status,200);
  const response=await login(req('/api/auth/password',{password:'fixture-password'}));assert.equal(response.status,200);
  const set=response.headers.get('set-cookie')!;assert.match(set,/HttpOnly/i);assert.match(set,/Secure/i);assert.match(set,/SameSite=lax/i);
  const cookie=set.split(';')[0];assert.equal(await ownerApiAccess(new Request('https://studio.example/api/config',{headers:{cookie}})),null);
  assert.equal((await proxy(new NextRequest('https://studio.example/',{headers:{cookie}}),{} as NextFetchEvent)).status,200);
  const out=await logout(req('/api/auth/sign-out',{}));assert.match(out.headers.get('set-cookie')!,/Max-Age=0/);
  process.env.AUTH_MODE='email';assert.equal((await login(req('/api/auth/password',{password:'fixture-password'}))).status,503);
 }finally{for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
test('password attempts are bounded on each worker',async()=>{
 const saved={...process.env};try{
 Object.assign(process.env,{APP_PASSWORD:'fixture-password',NODE_ENV:'production'});delete process.env.AUTH_MODE;
 const req=()=>new Request('https://studio.example/api/auth/password',{method:'POST',headers:{origin:'https://studio.example','content-type':'application/json','x-forwarded-for':'192.0.2.72'},body:JSON.stringify({password:'wrong'})});
 for(let i=0;i<10;i++)assert.equal((await login(req())).status,401);
 assert.equal((await login(req())).status,429);
 }finally{for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
