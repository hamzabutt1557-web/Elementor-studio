import test from "node:test";
import assert from "node:assert/strict";
import { connection } from "../lib/api-provider";
import { refine } from "../lib/provider";
import { briefDesign } from "../lib/design";
test("request API configuration uses fixed provider endpoints and rejects injected settings", () => {
  assert.equal(
    connection({
      provider: "gemini",
      key: "test-key-12345",
      model: "gemini-3.8-flash",
      inputRate: 0,
      outputRate: 0,
    }).base,
    "https://generativelanguage.googleapis.com/v1beta/openai/",
  );
  assert.throws(() =>
    connection({
      provider: "custom",
      key: "test-key-12345",
      model: "x",
      inputRate: 0,
      outputRate: 0,
    }),
  );
  assert.throws(() =>
    connection({
      provider: "gemini",
      key: "test-key-12345",
      model: "x",
      inputRate: 0,
      outputRate: 0,
      base: "http://127.0.0.1",
    }),
  );
});
test("session key reaches the selected provider but never enters returned draft", async () => {
  const original = global.fetch;
  const d = briefDesign("Example", "Example", "business");
  let sent = "";
  global.fetch = async (url, init) => {
    assert.equal(
      String(url),
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
    sent = (init?.headers as Record<string, string>).Authorization;
    return Response.json({
      choices: [{ message: { content: JSON.stringify(d) } }],
      usage: { prompt_tokens: 20, completion_tokens: 30 },
    });
  };
  try {
    const result = await refine(d, 1, {
      provider: "gemini",
      key: "test-key-12345",
      model: "gemini-3.8-flash",
      inputRate: 0,
      outputRate: 0,
    });
    assert.equal(sent, "Bearer test-key-12345");
    assert.equal(result.usage.requests, 1);
    assert.ok(!JSON.stringify(result).includes("test-key-12345"));
  } finally {
    global.fetch = original;
  }
});

test("provider model discovery uses a fixed endpoint and returns only bounded valid IDs",async()=>{
 const original=global.fetch;
 const {POST}=await import('../app/api/provider-test/route');
 global.fetch=async(url,init)=>{
  assert.equal(String(url),'https://generativelanguage.googleapis.com/v1beta/openai/models');
  assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer test-key-12345');
  return Response.json({data:[{id:'provider-model-b'},{id:'provider-model-a'},{id:'provider-model-a'},{id:'<script>'},{id:null}]});
 };
 try{
  const response=await POST(new Request('https://studio.example/api/provider-test',{method:'POST',headers:{origin:'https://studio.example','content-type':'application/json'},body:JSON.stringify({list:true,connection:{provider:'gemini',key:'test-key-12345',model:'',inputRate:0,outputRate:0}})}));
  assert.equal(response.status,200);assert.deepEqual((await response.json()).models,['provider-model-a','provider-model-b']);assert.equal(response.headers.get('Cache-Control'),'no-store');
 }finally{global.fetch=original;}
});
test("model discovery cannot inject custom endpoints or silently verify an unavailable model",async()=>{
 const original=global.fetch;
 const {POST}=await import('../app/api/provider-test/route');let requests=0;
 global.fetch=async()=>{requests++;return Response.json({data:[{id:'model-real'}]});};
 const request=(connection:unknown,list=false)=>new Request('https://studio.example/api/provider-test',{method:'POST',headers:{origin:'https://studio.example','content-type':'application/json'},body:JSON.stringify({list,connection})});
 const config={provider:'openai',key:'test-key-12345',model:'model-missing',inputRate:0,outputRate:0};
 try{
  const injected=await POST(request({...config,base:'http://127.0.0.1'},true));assert.equal(injected.status,400);assert.equal(requests,0);
  const unavailable=await POST(request(config));assert.equal(unavailable.status,400);assert.match((await unavailable.json()).error,/not listed/);
 }finally{global.fetch=original;}
});
