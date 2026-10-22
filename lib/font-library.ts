import data from "../data/google-fonts.json";
import { firstFontFamily, type FontFamily } from "./font-types";
import type { Design, DesignNode } from "./design";
export const fontCatalog = data as {
  source: string;
  updatedAt: string;
  families: FontFamily[];
};
const families = new Map(
  fontCatalog.families.map((f) => [f.family.toLowerCase(), f]),
);
export function googleFont(value: string) {
  return families.get(firstFontFamily(value).toLowerCase());
}
export function fontStylesheet(font: FontFamily) {
  const normal = font.weights.map((w) => `0,${w}`),
    italic = font.italicWeights.map((w) => `1,${w}`);
  const spec = italic.length
    ? ":ital,wght@" + [...normal, ...italic].join(";")
    : ":wght@" + font.weights.join(";");
  return (
    "https://fonts.googleapis.com/css2?family=" +
    encodeURIComponent(font.family) +
    spec +
    "&display=swap"
  );
}
export function designFonts(d: Design): FontFamily[] {
  const used = new Map<string, FontFamily>();
  const add = (value?: string) => {
    if (value) {
      const f = googleFont(value);
      if (f) used.set(f.family, f);
    }
  };
  const visit = (nodes: DesignNode[]) =>
    nodes.forEach((n) => {
      for (const s of [n.style, n.tablet, n.mobile]) add(s?.fontFamily);
      for (const run of n.runs || []) add(run.fontFamily);
      visit(n.children);
    });
  visit(d.nodes);
  if (used.size > 100)
    throw new Error(
      "Use at most 100 Google Font families on one page before preview or export.",
    );
  return [...used.values()];
}
