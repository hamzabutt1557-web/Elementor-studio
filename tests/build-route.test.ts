import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/build/route";
import { buildCapacity } from "../lib/build-capacity";
function request(accept="application/x-ndjson") {
 return new Request("http://localhost/api/build",{method:"POST",headers:{"Content-Type":"application/json",accept,authorization:"Basic "+Buffer.from("qa:test-only").toString("base64")},body:JSON.stringify({route:"brief",input:"A simple design agency",mode:"none",includeTemplate:false})});
}
test("authenticated brief streams a result and releases its conversion slot",async(t)=>{
 const previous = { APP_PASSWORD: process.env.APP_PASSWORD, AUTH_MODE: process.env.AUTH_MODE };
 process.env.APP_PASSWORD = "test-only"; process.env.AUTH_MODE = "basic";
 t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
 const response=await POST(request());
 const events=(await response.text()).trim().split("\n").map(line=>JSON.parse(line));
 assert.ok(events.some(e=>e.type==="progress"));
 assert.equal(events.at(-1).type,"result");
 assert.ok(events.at(-1).result.design.nodes.length>0);
 assert.equal(events.at(-1).result.template,undefined);
 assert.equal(buildCapacity.snapshot.active,0);
});
test("disconnect while queued removes work without starting a conversion",async(t)=>{
 const previous = { APP_PASSWORD: process.env.APP_PASSWORD, AUTH_MODE: process.env.AUTH_MODE };
 process.env.APP_PASSWORD = "test-only"; process.env.AUTH_MODE = "basic";
 t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
 const signal=new AbortController().signal;
 const release1=await buildCapacity.acquire(signal),release2=await buildCapacity.acquire(signal);
 try{
   const response=await POST(request());
   assert.equal(buildCapacity.snapshot.waiting,1);
   await response.body!.cancel();
   await new Promise(r=>setTimeout(r,0));
   assert.equal(buildCapacity.snapshot.waiting,0);
   assert.equal(buildCapacity.snapshot.active,2);
 }finally{release1();release2();}
});
