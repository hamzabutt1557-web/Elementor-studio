export type FontFamily = {
  family: string;
  category: string;
  subsets: string[];
  weights: number[];
  italicWeights: number[];
};
export const systemFonts = [
  "Arial",
  "Arial Black",
  "Georgia",
  "Verdana",
  "Trebuchet MS",
  "Times New Roman",
  "Tahoma",
  "Courier New",
  "Helvetica",
  "system-ui",
];
export function firstFontFamily(value: string) {
  return value
    .split(",")[0]
    .trim()
    .replace(/^["']|["']$/g, "");
}
export function safeFontFamily(value: string) {
  return /^[\p{L}\p{N}][\p{L}\p{N} .+_*-]{0,99}$/u.test(value);
}
/** Canonicalize each family so a cut or malformed quoted stack cannot swallow later CSS rules. */
export function cssFontStack(value: string) {
  const generic = new Set([
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-serif",
    "ui-sans-serif",
    "ui-monospace",
    "ui-rounded",
    "emoji",
    "math",
    "fangsong",
    "-apple-system",
    "BlinkMacSystemFont",
  ]);
  const families = value
    .split(",")
    .map(firstFontFamily)
    .filter((f) => generic.has(f) || safeFontFamily(f));
  return families.length
    ? families.map((f) => (generic.has(f) ? f : `"${f}"`)).join(", ")
    : "Arial, sans-serif";
}
