import { restoreCaptureViewport } from "./capture-viewport";
import { previewHtml } from "./elementor";
import {
  compareLayout,
  previewGeometry,
  type LayoutBox,
  type LayoutAudit,
} from "./layout-audit";
import { captureDocument } from "./capture-document";
import { viewportWidths } from "./viewports";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { assertCaptureAccess } from "./resource-policy";
import * as cheerio from "cheerio";
import { Design, DesignNode, id, safeLink, validateDesign } from "./design";
import { normalizeUrl, safeFetch } from "./network";
import { mergeResponsive } from "./responsive";
import { robotsAllows } from "./robots";
export async function fetchPage(url: string) {
  const u = normalizeUrl(url);
  assertCaptureAccess(u.href);
  let robots = "";
  try {
    robots = (
      await safeFetch(new URL("/robots.txt", u).href, 100_000)
    ).body.toString();
  } catch (e) {
    if (!/HTTP 404|HTTP 410/.test(String(e)))
      throw new Error(
        "Could not verify this site’s robots policy. Use an authorized brief instead.",
      );
  }
  if (!robotsAllows(robots, u))
    throw new Error(
      "This page is excluded by the site’s robots policy. Use an authorized brief or another page.",
    );
  const page = await safeFetch(u.href);
  if (!page.type.includes("text/html"))
    throw new Error("This URL is not an HTML page.");
  assertCaptureAccess(page.url);
  const html = page.body.toString();
  if (
    /cf-chl-|challenge-platform|verify you are human|checking your browser/i.test(
      html,
    )
  )
    throw new Error(
      "This page has an access challenge. We cannot capture it. Use an authorized brief instead.",
    );
  return { ...page, html };
}
export async function discover(url: string) {
  const page = await fetchPage(url);
  const $ = cheerio.load(page.html);
  const host = new URL(page.url).host;
  const pages = new Map([[page.url, $("title").text().trim() || "Home"]]);
  $("a[href]").each((_, el) => {
    const href = safeLink($(el).attr("href") || "", page.url);
    if (href) {
      const u = new URL(href);
      u.hash = "";
      if (
        u.host === host &&
        !/\.(pdf|png|jpg|zip|svg|mp4)$/i.test(u.pathname) &&
        !u.search &&
        pages.size < 12
      )
        pages.set(u.href, $(el).text().trim().slice(0, 80) || u.pathname);
    }
  });
  return {
    pages: [...pages].map(([url, title]) => ({ url, title })),
    note: "Up to 12 same-site pages discovered from public links. Sitemap crawling is planned.",
  };
}
export function staticDesign(html: string, url: string): Design {
  const $ = cheerio.load(html);
  const unsupported = $("svg,iframe,video,canvas")
    .toArray()
    .map((e) => e.tagName);
  const fields = $("input:not([type=hidden]),textarea,select").length;
  $("script,style,noscript,svg,iframe,video,canvas").remove();
  const warnings = [
    "Links and image references remain pointed at the source website; replace them after import.",
    "HTML-only fallback: computed CSS, screenshots and responsive behavior were not captured. Review layout before use.",
  ];
  if (fields)
    warnings.push(
      `${fields} form fields preserved as editable placeholders. Connect a WordPress form plugin before use; no submission backend is included.`,
    );
  if (unsupported.length)
    warnings.push(
      `Unsupported HTML-only content: ${[...new Set(unsupported)].join(", ")}. Add editable replacements.`,
    );
  const runsFor = (el: any) => {
    const runs: any[] = [];
    const walk = (node: any, format: any = {}) => {
      if (node.type === "text") {
        runs.push({ ...format, text: node.data });
        return;
      }
      const tag = node.tagName;
      if (["script", "style", "noscript"].includes(tag)) return;
      if (tag === "br") {
        runs.push({ ...format, text: "\n" });
        return;
      }
      const next = {
        ...format,
        ...(["b", "strong"].includes(tag) ? { bold: true } : {}),
        ...(["i", "em"].includes(tag) ? { italic: true } : {}),
        ...(tag === "u" ? { underline: true } : {}),
      };
      if (tag === "a") {
        const link = safeLink($(node).attr("href") || "", url);
        if (link) next.link = link;
      }
      for (const child of node.children || []) walk(child, next);
    };
    walk(el);
    return runs.slice(0, 500);
  };
  let count = 0;
  const read = (el: any, depth: number): DesignNode[] => {
    if (count >= 3000 || depth > 22) return [];
    const name = (el.tagName || "").toLowerCase();
    if (!name) return [];
    const $e = $(el);
    const value = $e.text().replace(/\s+/g, " ").trim().slice(0, 12000);
    const n: DesignNode = {
      id: id(),
      kind: "container",
      style: { direction: "column", gap: 16, padding: 12 },
      children: [],
    };
    if (/^h[1-6]$/.test(name)) {
      n.kind = "heading";
      n.level = Number(name[1]);
      n.text = value;
      n.style = { fontSize: n.level === 1 ? 44 : 28, fontWeight: "700" };
    } else if (name === "img") {
      n.kind = "image";
      n.url = safeLink($e.attr("src") || $e.attr("data-src") || "", url);
      n.alt = $e.attr("alt") || "";
      n.style = {};
      if (!n.url) return [];
    } else if (["input", "textarea", "select"].includes(name)) {
      if ($e.attr("type") === "hidden") return [];
      n.kind = "text";
      n.text = `[Form field: ${$e.attr("aria-label") || $e.attr("placeholder") || $e.attr("name") || name}]`;
      n.style = {
        padding: 12,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "#cccccc",
      };
    } else if (
      (name === "a" && !$e.find("img,div,h1,h2,h3,picture").length) ||
      name === "button"
    ) {
      n.kind = "button";
      n.text = value;
      n.url = safeLink($e.attr("href") || "#", url) || "#";
      n.style = { color: "#147d68", padding: 8 };
      if (!value) return [];
    } else if (["p", "li", "label"].includes(name) || !$e.children().length) {
      if (!value) return [];
      n.kind = "text";
      n.text = value;
      n.style = { fontSize: 16 };
    } else {
      n.children = $e
        .children()
        .toArray()
        .flatMap((c) => read(c, depth + 1));
      if (!n.children.length) return [];
    }
    if (
      ["text", "heading"].includes(n.kind) &&
      !["input", "textarea", "select"].includes(name)
    ) {
      n.runs = runsFor(el);
      n.text = n.runs
        .map((run) => run.text)
        .join("")
        .slice(0, 12000);
    }
    if (name === "a" && n.kind === "container")
      n.link = safeLink($e.attr("href") || "", url) || undefined;
    count++;
    return [n];
  };
  const nodes = $("body")
    .children()
    .toArray()
    .flatMap((e) => read(e, 0));
  if (count >= 3000)
    warnings.push(
      "HTML draft limited to 3,000 elements; some page content may be missing.",
    );
  if (/woocommerce|add_to_cart|product-price/.test(html))
    warnings.push(
      "Store content is static. WooCommerce products and checkout are not connected.",
    );
  if (!nodes.length)
    throw new Error(
      "No usable page content was found. Try creating from a brief.",
    );
  return validateDesign({
    title: $("title").text().trim().slice(0, 200) || "Captured page",
    source: url,
    nodes,
    warnings,
  });
}
export async function crawl(
  url: string,
  progress: (message: string) => void = () => {},
) {
  progress("Checking source website…");
  const source = await fetchPage(url);
  const startedAt = Date.now();
  let browser;
  try {
    const { chromium: pw } = await import("playwright-core");
    const { default: chromium } = await import("@sparticuz/chromium");
    browser = await pw.launch({
      executablePath:
        process.env.CHROMIUM_EXECUTABLE_PATH ||
        (await chromium.executablePath()),
      args: chromium.args,
      headless: true,
    });
    const context = await browser.newContext({
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    let requestCount = 0;
    let totalRequests = 0;
    let bytes = 0;
    const assetCache = new Map<string, Awaited<ReturnType<typeof safeFetch>>>();
    await context.route("**/*", async (route) => {
      try {
        if (++totalRequests > 800) return await route.abort();
        const req = route.request();
        if (req.method() !== "GET") return await route.abort();
        let asset = assetCache.get(req.url());
        if (!asset) {
          if (++requestCount > 240 || bytes > 24_000_000)
            return await route.abort();
          asset = await safeFetch(req.url(), 4_000_000);
          bytes += asset.body.length;
          assetCache.set(req.url(), asset);
        }
        await route.fulfill({
          status: asset.status,
          contentType: asset.type,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: asset.body,
        });
      } catch {
        await route.abort();
      }
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    const page = await context.newPage();
    const snapshots: Record<string, DesignNode[]> = {};
    const sourceGeometry: Record<string, Record<string, LayoutBox>> = {};
    let title = "Captured page";
    let screenshot = "";
    const fontFaces: NonNullable<Design["fontFaces"]> = [];
    const warnings: string[] = [];
    const assets: Record<string, string> = {};
    let assetBytes = 0;
    for (const [device, width] of [
      ["desktop", viewportWidths.desktop],
      ["tablet", viewportWidths.tablet],
      ["mobile", viewportWidths.mobile],
    ] as const) {
      progress(`Capturing ${device} layout…`);
      await page.setViewportSize({ width, height: 900 });
      if (device === "desktop")
        await page.goto(source.url, {
          waitUntil: "domcontentloaded",
          timeout: 25000,
        });
      if (device === "desktop") {
        // Theme scripts often install transparent headers and image cropping on load.
        // Measuring before that event captures a different page than the screenshot.
        await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {});
      }
      await page.evaluate(() => {
        document.documentElement.style.setProperty(
          "scroll-behavior",
          "auto",
          "important",
        );
        document.body.style.setProperty("scroll-behavior", "auto", "important");
        // Materialize common lazy-image attributes before measuring layout.
        document.querySelectorAll("img").forEach((img) => {
          const srcset = img.getAttribute("data-srcset");
          const src =
            img.getAttribute("data-src") || img.getAttribute("data-original");
          if (srcset && !img.getAttribute("srcset"))
            img.setAttribute("srcset", srcset);
          if (src && (!img.getAttribute("src") || img.src.startsWith("data:")))
            img.src = src;
          img.loading = "eager";
          img.addEventListener(
            "load",
            () => {
              if (
                img.classList.contains("lazyload") ||
                img.classList.contains("lazyloading")
              ) {
                img.classList.remove("lazyload", "lazyloading");
                img.classList.add("lazyloaded");
              }
            },
            { once: true },
          );
        });
      });
      await page.waitForTimeout(900);
      for (let y = 0; y < 7200; y += 800) {
        await page.evaluate((y) => window.scrollTo(0, y), y);
        await page.waitForTimeout(80);
        if (
          await page.evaluate(
            () => window.scrollY + innerHeight >= document.body.scrollHeight,
          )
        )
          break;
      }
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      await page.waitForTimeout(700);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1200);
      await page.evaluate(async () => {
        await Promise.race([
          Promise.all(
            Array.from(document.images)
              .filter((i) => i.getBoundingClientRect().top < 1800)
              .map((i) => i.decode().catch(() => {})),
          ),
          new Promise((resolve) => setTimeout(resolve, 3500)),
        ]);
      });
      await page.evaluate(async () => {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      });
      // Snapshot inline vector artwork into bounded native image widgets; source SVG never executes in exports.
      for (const svg of (await page.locator("svg").all()).slice(0, 20)) {
        if (
          !(await svg.isVisible()) ||
          (await svg.getAttribute("data-studio-artwork"))
        )
          continue;
        try {
          const png = await svg.screenshot({ timeout: 1500 });
          const bytes = await sharp(png)
            .resize({
              width: 800,
              height: 800,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 85 })
            .toBuffer();
          const url =
            "https://studio-upload.invalid/" +
            createHash("sha256").update(bytes).digest("hex").slice(0, 32) +
            ".webp";
          if (
            !assets[url] &&
            (Object.keys(assets).length >= 20 ||
              assetBytes + bytes.length > 800000 ||
              bytes.length > 250000)
          )
            continue;
          if (!assets[url]) {
            assets[url] = "data:image/webp;base64," + bytes.toString("base64");
            assetBytes += bytes.length;
          }
          await svg.evaluate(
            (el, url) => el.setAttribute("data-studio-artwork", url),
            url,
          );
        } catch {
          warnings.push(
            "Some inline artwork could not be captured. Replace it with an uploaded image.",
          );
        }
      }
      // Element screenshots scroll the page. Restore the top before measuring,
      // otherwise sticky headers and the reference screenshot capture a lower-page state.
      await restoreCaptureViewport(page, width);
      const data = await page.evaluate(captureDocument);
      for (const face of data.fontFaces) if (fontFaces.length < 24 && !fontFaces.some(f => JSON.stringify(f) === JSON.stringify(face))) fontFaces.push(face);
      if (!data.complete) throw new Error("This page exceeds capture limits. Choose a shorter page; an incomplete draft was not returned.");
      if (data.viewport.width !== width)
        warnings.push(
          `Source CSS viewport was ${data.viewport.width}px instead of requested ${width}px; review responsive layout.`,
        );
      if (Math.abs(data.viewport.scrollY) > 1)
        warnings.push(
          "Source kept a scroll offset after reset; review fixed and sticky elements.",
        );
      const clean = (nodes: any[]): DesignNode[] =>
        nodes
          .map((n) => {
            if (n.style.backgroundImage)
              n.style.backgroundImage =
                safeLink(n.style.backgroundImage, source.url) || undefined;
            if (n.link) n.link = safeLink(n.link, source.url) || undefined;
            if (n.runs) {
              n.runs = n.runs.map((run: any) => ({
                ...run,
                link: run.link
                  ? safeLink(run.link, source.url) || undefined
                  : undefined,
              }));
              const text = n.runs.map((run: any) => run.text).join("");
              if (text.length <= 12000) n.text = text;
              else delete n.runs;
            }
            if (n.url) n.url = safeLink(n.url, source.url) || undefined;
            else delete n.url;
            if (n.kind === "image" && !n.url) n.url = undefined;
            // Preserve zero spacing/radius: native theme/widget defaults may be non-zero.
            return { ...n, children: clean(n.children) };
          })
          .filter((n) => n.kind !== "image" || n.url);
      console.info(
        "capture.images",
        device,
        JSON.stringify(data.imageDiagnostics),
      );
      snapshots[device] = clean(data.nodes);
      sourceGeometry[device] = data.geometry;
      title = data.title.slice(0, 200) || title;
      warnings.push(...data.warnings);
      if (device === "desktop") {
        // Keep reference capture bounded to the initial viewport. Full-page
        // rasterization of long catalogs can exhaust a serverless renderer.
        try {
          const reference = await page.screenshot({ type: "jpeg", quality: 55, timeout: 15000 });
          screenshot = "data:image/jpeg;base64," + reference.toString("base64");
        } catch {
          warnings.push("Reference screenshot unavailable. Editable elements were retained; use Open original to compare.");
        }
      }
    }
    snapshots.desktop = mergeResponsive(
      snapshots.desktop,
      snapshots.tablet,
      snapshots.mobile,
    );
    const trimDefaults = (nodes: DesignNode[]) =>
      nodes.forEach((n) => {
        if (
          n.style.background === "rgba(0, 0, 0, 0)" ||
          n.style.background === "transparent"
        )
          delete n.style.background;
        trimDefaults(n.children);
      });
    trimDefaults(snapshots.desktop);
    if (snapshots.desktop.length === 0)
      throw new Error("Rendered page has no supported elements.");
    warnings.push(
      "Draft preview is rendered from the design tree, not WordPress. Visual similarity and live import have not been measured.",
      "Links remain pointed at the source website. Review and replace destination links after import.",
    );
    if (/woocommerce|add_to_cart|product-price/.test(source.html))
      warnings.push(
        "Store patterns detected. Product content is static; WooCommerce connections and checkout need separate setup.",
      );
    progress("Building editable elements…");
    const design = validateDesign({
      title,
      fontFaces,
      assets,
      source: source.url,
      nodes: snapshots.desktop,
      warnings: [...new Set(warnings)].slice(0, 80),
    });
    progress("Comparing captured layout with output…");
    const layoutAudit: LayoutAudit = {
      status: "unavailable",
      basis: "initial-capture",
      devices: [],
      note: "Initial capture geometry check only; not pixel similarity or WordPress verification. Edits and AI changes require a new check.",
    };
    try {
      if (Date.now() - startedAt > 80000)
        throw new Error("Capture used its layout-check time budget.");
      const output = await context.newPage();
      try {
        const html = previewHtml(design);
        for (const [device, width] of Object.entries(viewportWidths)) {
          if (Date.now() - startedAt > 100000)
            throw new Error("Layout-check time budget reached.");
          await output.setViewportSize({ width, height: 900 });
          await output.setContent(html, {
            waitUntil: "domcontentloaded",
            timeout: 6000,
          });
          // External font stylesheets must load before document.fonts.ready is sampled.
          await output
            .waitForLoadState("load", { timeout: 6000 })
            .catch(() => {});
          await output.evaluate(async () => {
            await Promise.race([
              Promise.all([
                document.fonts.ready,
                ...Array.from(document.images).map((i) =>
                  i.decode().catch(() => {}),
                ),
              ]),
              new Promise((r) => setTimeout(r, 1500)),
            ]);
            await new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            );
          });
          layoutAudit.devices.push(
            compareLayout(
              device,
              width,
              sourceGeometry[device],
              await output.evaluate(previewGeometry),
            ),
          );
        }
        layoutAudit.status = "checked";
      } finally {
        await output.close();
      }
    } catch {
      layoutAudit.note =
        "Layout check could not finish within capture limits. Compare the original manually; no similarity score is claimed.";
    }
    const labels = new Map<string, string>();
    const labelNodes = (nodes: DesignNode[]) =>
      nodes.forEach((n) => {
        labels.set(
          n.id,
          n.kind + ": " + (n.text || n.alt || "section").slice(0, 72),
        );
        labelNodes(n.children);
      });
    labelNodes(design.nodes);
    for (const device of layoutAudit.devices)
      device.issues = device.issues.map((issue) => ({
        ...issue,
        label: labels.get(issue.id) || "Captured element",
      }));
    for (const device of layoutAudit.devices) {
      if (device.shifted || device.missing)
        design.warnings.push(
          `Initial ${device.device} layout check: ${device.shifted} elements shifted over 24px, ${device.missing} missing or hidden; 90th-percentile geometry drift ${device.p90DriftPx}px. Review the captured layout before delivery.`,
        );
    }
    if (layoutAudit.status !== "checked")
      design.warnings.push(
        "Initial layout geometry check did not complete. Compare each device manually before delivery.",
      );
    design.warnings = design.warnings.slice(0, 80);
    return { design, screenshot, capture: "browser" as const, layoutAudit };
  } catch (e) {
    console.warn(
      "crawler.browser_fallback",
      e instanceof Error ? e.message : "Unknown browser failure",
    );
    throw new Error(
      "Visual capture could not be completed. No low-fidelity text replacement was generated. " +
        (e instanceof Error ? e.message : "Try again with a public page."),
    );
  } finally {
    await browser?.close();
  }
}
