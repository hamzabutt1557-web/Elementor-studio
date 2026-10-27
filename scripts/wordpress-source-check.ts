// Integration check against an isolated local WordPress installation with Elementor and the importer active.
// Put test-only user/password in .qa/wordpress-test/credentials.json; never use production credentials.
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium, request } from "playwright-core";
import serverChromium from "@sparticuz/chromium";
import { exportZip } from "../lib/export";
import { previewHtml } from "../lib/elementor";
import { validateDesign } from "../lib/design";

async function main() {
  const design = validateDesign(
    JSON.parse(
      fs.readFileSync(process.argv[2] || ".qa/design-0416.json", "utf8"),
    ),
  );
  const zip = await exportZip([design], false);
  const creds = JSON.parse(
    fs.readFileSync(".qa/wordpress-test/credentials.json", "utf8"),
  );
  const api = await request.newContext({ baseURL: "http://127.0.0.1:8777" });
  await api.get("/wp-login.php");
  await api.post("/wp-login.php", {
    form: {
      log: creds.user,
      pwd: creds.password,
      "wp-submit": "Log In",
      redirect_to: "http://127.0.0.1:8777/wp-admin/",
      testcookie: "1",
    },
  });
  const form = await (
    await api.get("/wp-admin/tools.php?page=elementor-studio")
  ).text();
  const nonce = form.match(/name="_wpnonce" value="([^"]+)"/)?.[1];
  if (!nonce) throw new Error("No importer nonce");
  const imported = await (
    await api.post("/wp-admin/tools.php?page=elementor-studio", {
      multipart: {
        _wpnonce: nonce,
        estudio_import: "1",
        package: {
          name: "package.zip",
          mimeType: "application/zip",
          buffer: zip,
        },
      },
    })
  ).text();
  fs.writeFileSync(".qa/wordpress-test/import-response.html", imported);
  const id = imported.match(
    /post=(\d+)(?:&#038;|&amp;|&)action=elementor/,
  )?.[1];
  if (!id)
    throw new Error(
      "No imported draft: " + imported.match(/notice-error[\s\S]{0,400}/)?.[0],
    );
  console.log("Draft imported", id);
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_EXECUTABLE_PATH || ".qa/chromium/chromium",
    args: serverChromium.args,
    headless: true,
    proxy: process.env.HTTPS_PROXY
      ? { server: process.env.HTTPS_PROXY, bypass: "127.0.0.1,localhost" }
      : undefined,
  });
  const ctx = await browser.newContext({
    storageState: await api.storageState(),
    ignoreHTTPSErrors: true,
    serviceWorkers: "block",
  });
  const page = await ctx.newPage();
  await ctx.route("**/*", (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === "127.0.0.1") return r.continue();
    if (
      r.request().method() !== "GET" ||
      ["fetch", "xhr", "ping", "websocket", "eventsource"].includes(
        r.request().resourceType(),
      )
    )
      return r.abort();
    if (
      (u.hostname === "bls.uk.com" &&
        /^\/cdn\/(shop|fonts)\//.test(u.pathname)) ||
      (u.hostname === "cdn.shopify.com" &&
        u.pathname.startsWith("/s/files/")) ||
      u.hostname === "fonts.googleapis.com" ||
      u.hostname === "fonts.gstatic.com"
    )
      return r.continue();
    return r.abort();
  });
  await page.addInitScript("window.__name=f=>f");
  const report: any = {
    id,
    scope:
      "Full captured BLS tree, real native WordPress renderer; remote source media; analytics blocked",
    devices: [],
  };
  try {
    for (const [device, width] of Object.entries({
      desktop: 1440,
      tablet: 820,
      mobile: 390,
    })) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(
        "http://127.0.0.1:8777/?page_id=" + id + "&preview=true",
        { waitUntil: "domcontentloaded", timeout: 60000 },
      );
      await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
      await page.evaluate(() =>
        Promise.race([
          document.fonts.ready,
          new Promise((r) => setTimeout(r, 6000)),
        ]),
      );
      await page.evaluate(async () => {
        document.documentElement.style.scrollBehavior = "auto";
        for (let y = 0; y < document.body.scrollHeight; y += 1000) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 35));
        }
        window.scrollTo(0, 0);
        await Promise.race([
          Promise.all(
            Array.from(document.images).map((i) => i.decode().catch(() => {})),
          ),
          new Promise((r) => setTimeout(r, 10000)),
        ]);
      });
      const actual = await page.evaluate(() =>
        Array.from(document.querySelectorAll("[data-id]")).map((e) => {
          const r = e.getBoundingClientRect();
          return {
            id: e.getAttribute("data-id"),
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
          };
        }),
      );
      const images = await page
        .locator(".elementor img")
        .evaluateAll((es) =>
          es.map((e) => ({
            src: (e as HTMLImageElement).src,
            visible:
              e.getBoundingClientRect().width > 0 &&
              e.getBoundingClientRect().height > 0,
            loaded: (e as HTMLImageElement).naturalWidth > 0,
            objectPosition: getComputedStyle(e).objectPosition,
          })),
        );

      await page.screenshot({ path: ".qa/wp-source-" + device + ".png" });
      fs.writeFileSync(
        ".qa/wordpress-test/frontend-" + device + ".html",
        await page.content(),
      );
      await page.setContent(previewHtml(design), {
        waitUntil: "domcontentloaded",
      });
      const expected = await page.evaluate(() =>
        Array.from(document.querySelectorAll("[data-estudio-id]")).map((e) => {
          const r = e.getBoundingClientRect();
          return {
            id: e.getAttribute("data-estudio-id"),
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
          };
        }),
      );
      report.devices.push({
        device,
        images,
        boxes: actual.map((a) => {
          const e = expected.find((e) => e.id === a.id);
          return {
            actual: a,
            expected: e,
            drift: e
              ? Math.max(
                  Math.abs(a.x - e.x),
                  Math.abs(a.y - e.y),
                  Math.abs(a.width - e.width),
                  Math.abs(a.height - e.height),
                )
              : null,
          };
        }),
      });
    }
    fs.writeFileSync(
      ".qa/wordpress-test/geometry.json",
      JSON.stringify(report, null, 2),
    );
    assert.ok(
      report.devices.every((d: any) => d.boxes.length > 0),
      "WordPress must render native elements, not an error page",
    );
    console.log(
      JSON.stringify(
        report.devices.map((d: any) => {
          const diffs = d.boxes
            .filter(
              (b: any) =>
                b.expected &&
                b.actual.width > 1 &&
                b.actual.height > 1 &&
                b.expected.width > 1 &&
                b.expected.height > 1,
            )
            .map((b: any) => b.drift)
            .sort((a: number, b: number) => a - b);
          assert.ok(diffs.length > 0 && diffs[Math.ceil(diffs.length * 0.9) - 1] <= 2, `${d.device}: native layout p90 exceeds 2px`);
          return {
            device: d.device,
            compared: diffs.length,
            p90: diffs[Math.ceil(diffs.length * 0.9) - 1],
            over24: diffs.filter((x: number) => x > 24).length,
            loadedImages: d.images.filter((x: any) => x.loaded && x.visible)
              .length,
            visibleImages: d.images.filter((x: any) => x.visible).length,
          };
        }),
      ),
    );
    fs.writeFileSync(".qa/wp-source-report.json", JSON.stringify(report));
  } finally {
    await browser.close();
    await api.dispose();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
