import type { Page } from "playwright-core";
/** Element screenshots may expand the viewport; source CSS may smooth-scroll. */
export async function restoreCaptureViewport(page: Page, width: number) {
  await page.setViewportSize({ width: width + 1, height: 900 });
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty(
      "scroll-behavior",
      "auto",
      "important",
    );
    document.body.style.setProperty("scroll-behavior", "auto", "important");
    window.scrollTo({ left: 0, top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(600);
  return page.evaluate(() => ({ width: innerWidth, scrollY }));
}
