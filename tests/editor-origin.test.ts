import { test } from "node:test";
import assert from "node:assert/strict";
import { sameOrigin } from "../lib/api";
test("editor mutations accept the browser host when Next uses an internal hostname", () => {
  assert.doesNotThrow(() =>
    sameOrigin(
      new Request("http://localhost:3107/api/preview", {
        headers: {
          host: "127.0.0.1:3107",
          origin: "http://127.0.0.1:3107",
          "sec-fetch-site": "same-origin",
        },
      }),
    ),
  );
  assert.doesNotThrow(() =>
    sameOrigin(
      new Request("https://internal/api/preview", {
        headers: {
          host: "elementor-studio.vercel.app",
          origin: "https://elementor-studio.vercel.app",
          "sec-fetch-site": "same-origin",
        },
      }),
    ),
  );
});
test("editor mutations reject foreign origins and cross-site requests", () => {
  for (const headers of [
    { host: "studio.example", origin: "https://attacker.example" },
    {
      host: "studio.example",
      origin: "https://studio.example",
      "sec-fetch-site": "cross-site",
    },
    { host: "studio.example", origin: "http://studio.example" },
    { host: "studio.example", "sec-fetch-site": "cross-site" },
  ] as Record<string, string>[])
    assert.throws(
      () =>
        sameOrigin(new Request("https://internal/api/preview", { headers })),
      /started from the app/,
    );
});
