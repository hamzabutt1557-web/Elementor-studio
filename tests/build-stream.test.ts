import test from "node:test";
import assert from "node:assert/strict";
import { streamBuild } from "../lib/build-stream";
function stream(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        for (const x of chunks) c.enqueue(encoder.encode(x));
        c.close();
      },
    }),
  );
}
test("build stream handles split JSON events and reports server progress before result", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return stream([
      '{"type":"pro',
      'gress","message":"Capturing mobile"}\n{"type":"result","result":{"ready":true}}\n',
    ]);
  });
  const progress: string[] = [];
  assert.deepEqual(await streamBuild({}, (m) => progress.push(m)), {
    ready: true,
  });
  assert.deepEqual(progress, ["Capturing mobile"]);
  assert.equal(calls, 1);
});
test("build stream preserves failure and does not retry a paid request", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return stream(['{"type":"error","message":"Source capture failed"}\n']);
  });
  await assert.rejects(
    streamBuild({}, () => {}),
    /Source capture failed/,
  );
  assert.equal(calls, 1);
});
test("build stream rejects truncated successful HTTP responses", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    stream(['{"type":"progress","message":"Checking"}\n']),
  );
  await assert.rejects(
    streamBuild({}, () => {}),
    /ended before the draft/,
  );
});
test("caller cancellation aborts the network request without retry", async(t)=>{
 const caller = new AbortController();
 let calls=0;
 t.mock.method(globalThis,"fetch",async(_url: string | URL | Request,init?: RequestInit)=>{
   calls++;
   return await new Promise<Response>((_resolve,reject)=>{
     init?.signal?.addEventListener("abort",()=>reject(new Error("aborted")),{once:true});
   });
 });
 const pending=streamBuild({},()=>{},caller.signal);
 caller.abort();
 await assert.rejects(pending,/Conversion cancelled/);
 assert.equal(calls,1);
});
