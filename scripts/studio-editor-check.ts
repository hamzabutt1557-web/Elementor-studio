import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { briefDesign } from "../lib/design";
import { previewHtml } from "../lib/elementor";

(async () => {
  const base = "http://127.0.0.1:3107";
  const browser = await chromium.launch({
    executablePath: ".qa/chromium",
    args: ["--no-sandbox", "--disable-gpu"],
    headless: true,
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    const page = await context.newPage();
    await page.addInitScript("window.__name = f => f");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/sign-in");
    await page
      .getByLabel("App password", { exact: true })
      .fill(process.env.LOGIN_TEST_PASSWORD!);
    await page
      .getByRole("button", { name: "Open workspace", exact: true })
      .click();
    await page.waitForURL(base + "/");
    await page.waitForFunction(
      () =>
        new Promise((resolve) => {
          const r = indexedDB.open("elementor-studio", 1);
          r.onsuccess = () => {
            if (!r.result.objectStoreNames.contains("workspace")) {
              r.result.close();
              resolve(false);
              return;
            }
            const q = r.result
              .transaction("workspace")
              .objectStore("workspace")
              .get("latest");
            q.onsuccess = () => {
              r.result.close();
              resolve(!!q.result);
            };
          };
        }),
    );
    const design = briefDesign(
      "Verdant Studio\nThoughtful spaces. Better living.\nWe design calm, considered gardens for modern life.",
      "Verdant — Garden design",
      "landing",
    );
    const saved = {
      results: [
        {
          design,
          preview: previewHtml(design),
          screenshot: "",
          capture: "",
          usage: {
            input: 0,
            output: 0,
            total: 0,
            requests: 0,
            cost: 0,
            exact: true,
            model: "local",
          },
          checks: { nativeWidgets: 15 },
        },
      ],
      input: "Garden design",
      route: "brief",
    };
    await page.evaluate(
      (value) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open("elementor-studio", 1);
          req.onupgradeneeded = () => req.result.createObjectStore("workspace");
          req.onsuccess = () => {
            const tx = req.result.transaction("workspace", "readwrite");
            tx.objectStore("workspace").put(value, "latest");
            tx.oncomplete = () => {
              req.result.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
      saved,
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Open design editor", exact: true })
      .first()
      .click();
    const editor = page.locator(".studio-editor");
    await editor.waitFor();
    const output = page.frameLocator('iframe[title="Live generated output"]');
    await output.locator("[data-estudio-id]").first().waitFor();
    await page.screenshot({ path: ".qa/studio-desktop.png" });
    const rect = await editor.boundingBox();
    assert.equal(rect?.width, 1440);
    assert.equal(rect?.height, 960);
    assert.equal(await editor.locator(".studio-dock").isVisible(), true);
    const before = await editor.locator(".layer-row").count();
    const apply = async (action: () => Promise<unknown>) => {
      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/preview") && r.request().method() === "POST",
      );
      await action();
      assert.equal((await response).status(), 200);
      await page.waitForFunction(
        () =>
          !document
            .querySelector('.studio-editor button[aria-label="Add text"]')
            ?.hasAttribute("disabled"),
      );
    };
    await apply(() =>
      editor.locator('.studio-toolrail').getByRole("button", { name: "Add text", exact: true }).click(),
    );
    assert.equal(await editor.locator(".layer-row").count(), before + 1);
    await editor
      .getByLabel("Edit selected text", { exact: true })
      .fill("Designed for everyday living");
    await apply(() =>
      editor.getByRole("heading", { name: "Properties", exact: true }).click(),
    );
    await output
      .getByText("Designed for everyday living", { exact: true })
      .waitFor();
    await apply(() =>
      editor.getByRole("button", { name: "Undo", exact: true }).click(),
    );
    await output.getByText("Add your text here", { exact: true }).waitFor();
    await apply(() =>
      editor.getByRole("button", { name: "Redo", exact: true }).click(),
    );
    await output
      .getByText("Designed for everyday living", { exact: true })
      .waitFor();
    // Keyboard shortcuts work from inside the sandboxed canvas too.
    await output
      .getByText("Designed for everyday living", { exact: true })
      .click();
    await apply(() => page.keyboard.press("Control+z"));
    await output.getByText("Add your text here", { exact: true }).waitFor();
    await apply(() => page.keyboard.press("Control+Shift+z"));
    await output
      .getByText("Designed for everyday living", { exact: true })
      .waitFor();
    await apply(() =>
      editor
        .getByRole("button", {
          name: "Duplicate selected element",
          exact: true,
        })
        .click(),
    );
    assert.equal(await editor.locator(".layer-row").count(), before + 2);
    await apply(() =>
      editor
        .getByRole("button", { name: "Delete selected element", exact: true })
        .click(),
    );
    assert.equal(await editor.locator(".layer-row").count(), before + 1);
    await apply(() =>
      editor.getByRole("button", { name: "Add image", exact: true }).click(),
    );
    assert.equal(await editor.locator(".layer-row").count(), before + 2);
    await apply(() =>
      editor.getByRole("button", { name: "Undo", exact: true }).click(),
    );
    await apply(() =>
      editor.getByRole("button", { name: "Add section", exact: true }).click(),
    );
    assert.equal(
      await editor
        .getByRole("button", { name: "Redo", exact: true })
        .isDisabled(),
      true,
    );
    await editor.getByLabel("Device", { exact: true }).selectOption("mobile");
    assert.equal(
      await output.locator("body").evaluate(() => window.innerWidth),
      390,
    );
    await editor.getByLabel("Zoom", { exact: true }).selectOption("100");
    await editor.getByRole("button", { name: "Fit", exact: true }).click();
    // Native Elementor export includes the latest text.
    const downloadPromise = page.waitForEvent("download");
    await editor.getByRole("button", { name: "JSON", exact: true }).click();
    const download = await downloadPromise;
    const path = await download.path();
    const text = (await import("node:fs/promises")).readFile(path!, "utf8");
    assert.ok((await text).includes("Designed for everyday living"));
    await page.waitForFunction(
      () =>
        !document
          .querySelector('.studio-editor button[aria-label="Add text"]')
          ?.hasAttribute("disabled"),
    );
    const zipDownloadPromise = page.waitForEvent("download");
    await editor
      .getByRole("button", { name: "Export ZIP", exact: true })
      .click();
    const zipDownload = await zipDownloadPromise;
    assert.equal(zipDownload.suggestedFilename(), "elementor-design.zip");
    await page.waitForFunction(
      () =>
        !document
          .querySelector('.studio-editor button[aria-label="Add text"]')
          ?.hasAttribute("disabled"),
    );
    // A failed save must leave the design and undo stack intact.
    const countBeforeFailure = await editor.locator(".layer-row").count();
    await page.route(
      "**/api/preview",
      (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Injected save failure" }),
        }),
      { times: 1 },
    );
    await editor.locator('.studio-toolrail').getByRole("button", { name: "Add text", exact: true }).click();
    await editor
      .locator(".live-status")
      .getByText(/Change was not saved/)
      .waitFor();
    assert.equal(
      await editor.locator(".layer-row").count(),
      countBeforeFailure,
    );
    await editor.getByLabel("Device", { exact: true }).selectOption("desktop");
    await page.screenshot({ path: ".qa/studio-edited.png" });
    await editor
      .getByRole("button", { name: "Back to workspace", exact: true })
      .click();
    await page.reload();
    await page
      .getByRole("button", { name: "Open design editor", exact: true })
      .first()
      .click();
    await output
      .getByText("Designed for everyday living", { exact: true })
      .waitFor();
    await editor
      .getByRole("button", { name: "Back to workspace", exact: true })
      .click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Open design editor", exact: true })
      .first()
      .click();
    assert.equal(await editor.locator(".studio-dock").count(), 0);
    await page.screenshot({ path: ".qa/studio-mobile.png" });
    await editor
      .getByRole("button", { name: "Show Layers and Properties", exact: true })
      .click();
    assert.equal(await editor.locator(".studio-dock").isVisible(), true);
    await page.screenshot({ path: ".qa/studio-mobile-panels.png" });
    await editor
      .getByRole("button", { name: "Close inspector", exact: true })
      .click();
    assert.equal(await editor.locator(".studio-dock").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        fullViewport: true,
        addText: true,
        textEdit: true,
        undoRedo: true,
        canvasKeyboard: true,
        duplicateDelete: true,
        addImage: true,
        addSection: true,
        redoBranchCleared: true,
        responsiveViewport: true,
        jsonExport: true,
        persistedAfterReload: true,
        mobileCanvas: true,
        mobileDock: true,
        zipExport: true,
        failedSaveRollback: true,
        pageErrors: errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
