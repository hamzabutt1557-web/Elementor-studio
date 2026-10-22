import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiRequestError,
  responseError,
  requestResponse,
  requestJson,
} from "../lib/client-api";
import { viewportWidth } from "../lib/viewports";

test("expired login with a plain HTML response gives a sign-in instruction instead of a JSON parse error", async () => {
  const e = await responseError(
    new Response("<html>Login</html>", { status: 401 }),
  );
  assert.equal(e.status, 401);
  assert.match(e.message, /sign in again/);
  assert.doesNotMatch(e.message, /html|JSON/);
});
test("capture validation errors keep the useful server explanation", async () => {
  const e = await responseError(
    Response.json(
      { error: "The source website blocks capture." },
      { status: 400 },
    ),
  );
  assert.match(e.message, /source website blocks capture/);
});
test("rate limits and gateway timeouts explain recovery without suggesting an automatic retry", async () => {
  assert.match(
    (await responseError(new Response("", { status: 429 }))).message,
    /No automatic retry/,
  );
  assert.match(
    (await responseError(new Response("", { status: 504 }))).message,
    /Check the current build/,
  );
});
test("failed paid build requests are never automatically repeated", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(
    requestResponse("/api/build", { method: "POST" }, 1000, fetcher),
    /Connection lost/,
  );
  assert.equal(calls, 1);
});
test("slow requests abort once and return a readable timeout", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (_input, init) =>
    new Promise((_resolve, reject) => {
      calls++;
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  await assert.rejects(
    requestResponse("/api/build", { method: "POST" }, 10, fetcher),
    /took too long/,
  );
  assert.equal(calls, 1);
});
test("closing a preview preserves caller cancellation rather than displaying a false network failure", async () => {
  const c = new AbortController();
  const fetcher: typeof fetch = async (_input, init) =>
    new Promise((_resolve, reject) =>
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      ),
    );
  const pending = requestResponse(
    "/api/preview",
    { signal: c.signal },
    1000,
    fetcher,
  );
  c.abort();
  await assert.rejects(
    pending,
    (e: unknown) => e instanceof DOMException && e.name === "AbortError",
  );
});
test("successful but malformed server responses have a recoverable message", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html>Gateway</html>");
  try {
    await assert.rejects(
      requestJson("/api/config"),
      (e: unknown) =>
        e instanceof ApiRequestError &&
        e.message.includes("incomplete response"),
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("tablet preview uses a real tablet sample rather than desktop lg boundary", () => {
  assert.ok(viewportWidth("tablet") >= 768 && viewportWidth("tablet") < 1024);
  assert.ok(viewportWidth("mobile") < 768);
  assert.ok(viewportWidth("desktop") > 1024);
});
