import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, type NextFetchEvent } from "next/server";
import {
  isOwner,
  basicAccess,
  emailLoginReady,
  privateAccessConfigured,
} from "../lib/access-policy";
import { ownerApiAccess } from "../lib/owner-access";
import { proxy } from "../proxy";
const env = {
  AUTH_MODE: "email",
  OWNER_EMAIL: "owner@example.com",
  SUPABASE_URL: "https://test-project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-public",
};
const user = (email = "owner@example.com", status = "verified") => ({
  email,
  email_confirmed_at:
    status === "verified" ? "2026-10-15T00:00:00Z" : undefined,
  is_anonymous: false,
});
test("only the approved verified email grants owner access", () => {
  assert.equal(isOwner(user(), env), true);
  assert.equal(isOwner(user("OWNER@example.com"), env), true);
  assert.equal(isOwner(user("other@example.com"), env), false);
  assert.equal(isOwner(user("owner@example.com", "unverified"), env), false);
  assert.equal(isOwner(null, env), false);
  assert.equal(isOwner({ ...user(), is_anonymous: true }, env), false);
  assert.equal(isOwner(user(), {}), false);
});
test("email mode fails closed with incomplete provider or owner setup, even with an old password", () => {
  assert.equal(emailLoginReady(env), true);
  for (const key of [
    "OWNER_EMAIL",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
  ]) {
    const incomplete = { ...env, [key]: "", APP_PASSWORD: "old-password" };
    assert.equal(emailLoginReady(incomplete), false);
    assert.equal(privateAccessConfigured(incomplete), false);
  }
  assert.equal(emailLoginReady({ ...env, OWNER_EMAIL: "not-an-email" }), false);
});
test("legacy password comparison requires proper Basic credentials", () => {
  const basic = (text: string) =>
    "Basic " + Buffer.from(text).toString("base64");
  assert.equal(
    basicAccess(basic("owner:secret"), { APP_PASSWORD: "secret" }),
    true,
  );
  for (const header of [
    null,
    "Bearer secret",
    basic("secret"),
    basic("owner:wrong"),
  ])
    assert.equal(basicAccess(header, { APP_PASSWORD: "secret" }), false);
});
test("API identity guard rejects requests independently of the proxy and never trusts a supplied email", async () => {
  const original = { ...process.env };
  try {
    Object.assign(process.env, {
      NODE_ENV: "production",
      APP_PASSWORD: "test-password",
    });
    delete process.env.AUTH_MODE;
    const denied = await ownerApiAccess(
      new Request("https://studio.example/api/build", {
        headers: { "x-owner-email": "owner@example.com" },
      }),
    );
    assert.equal(denied?.status, 401);
    assert.equal(
      await ownerApiAccess(
        new Request("https://studio.example/api/build", {
          headers: {
            authorization:
              "Basic " + Buffer.from("owner:test-password").toString("base64"),
          },
        }),
      ),
      null,
    );
    process.env.AUTH_MODE = "email";
    delete process.env.SUPABASE_URL;
    const req = new NextRequest("https://studio.example/api/build", {
      headers: {
        authorization:
          "Basic " + Buffer.from("owner:test-password").toString("base64"),
      },
    });
    assert.equal((await ownerApiAccess(req))?.status, 503);
    assert.equal((await proxy(req, {} as NextFetchEvent))?.status, 503);
    assert.equal(
      (
        await proxy(
          new NextRequest("https://studio.example/share"),
          {} as NextFetchEvent,
        )
      )?.status,
      200,
    );
  } finally {
    for (const k of Object.keys(process.env))
      if (!(k in original)) delete process.env[k];
    Object.assign(process.env, original);
  }
});

import { ownerLogin, type LoginAuth } from "../lib/login-flow";
function fakeAuth() {
  const calls: string[] = [];
  const state = {
    sendError: null as { status: number } | null,
    verifyError: null as { status: number } | null,
    user: user(),
  };
  const auth: LoginAuth = {
    signInWithOtp: async () => {
      calls.push("send");
      return { error: state.sendError };
    },
    verifyOtp: async () => {
      calls.push("verify");
      return { data: { user: state.user }, error: state.verifyError };
    },
    signOut: async () => {
      calls.push("signOut");
    },
  };
  return { auth, calls, state };
}
test("OTP flow sends only to the owner and grants access only after verified ownership", async () => {
  const f = fakeAuth();
  assert.equal(
    (await ownerLogin("send", { email: "other@example.com" }, f.auth, env))
      .status,
    403,
  );
  assert.equal(f.calls.length, 0);
  assert.equal(
    (await ownerLogin("send", { email: "OWNER@example.com" }, f.auth, env))
      .status,
    200,
  );
  assert.deepEqual(f.calls, ["send"]);
  assert.equal(
    (
      await ownerLogin(
        "verify",
        { email: "owner@example.com", token: "123456" },
        f.auth,
        env,
      )
    ).status,
    200,
  );
  f.state.user = user("owner@example.com", "unverified");
  assert.equal(
    (
      await ownerLogin(
        "verify",
        { email: "owner@example.com", token: "123456" },
        f.auth,
        env,
      )
    ).status,
    403,
  );
  assert.equal(f.calls.at(-1), "signOut");
});
test("OTP flow rejects malformed, expired and throttled attempts without granting access", async () => {
  const f = fakeAuth();
  const input = { email: "owner@example.com", token: "123456" };
  assert.equal(
    (await ownerLogin("verify", { ...input, token: "not-a-code" }, f.auth, env))
      .status,
    400,
  );
  assert.equal(f.calls.length, 0);
  f.state.verifyError = { status: 403 };
  assert.equal((await ownerLogin("verify", input, f.auth, env)).status, 400);
  f.state.verifyError = { status: 429 };
  assert.equal((await ownerLogin("verify", input, f.auth, env)).status, 429);
  f.state.sendError = { status: 429 };
  assert.equal((await ownerLogin("send", input, f.auth, env)).status, 429);
});

import { authOriginMatches } from "../lib/api";
test("login mutations require same-origin browser requests and reject missing or cross-site origins", () => {
  const req = (origin?: string, site?: string) =>
    new Request("http://localhost:3108/api/auth/send", {
      headers: {
        host: "127.0.0.1:3108",
        ...(origin ? { origin } : {}),
        ...(site ? { "sec-fetch-site": site } : {}),
      },
    });
  assert.equal(authOriginMatches(req("http://127.0.0.1:3108")), true);
  assert.equal(authOriginMatches(req("https://evil.example")), false);
  assert.equal(authOriginMatches(req()), false);
  assert.equal(
    authOriginMatches(req("http://127.0.0.1:3108", "cross-site")),
    false,
  );
});
