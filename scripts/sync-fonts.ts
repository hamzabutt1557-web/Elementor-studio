import { writeFileSync } from "node:fs";
import { safeFontFamily, type FontFamily } from "../lib/font-types";
async function main() {
  const source = "https://fonts.google.com/metadata/fonts";
  const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
  if (!response.ok)
    throw new Error(
      "Google font metadata unavailable. Existing catalog retained.",
    );
  const raw = await response.text();
  if (raw.length > 10000000) throw new Error("Font catalog is too large.");
  const data = JSON.parse(raw.slice(raw.indexOf("{")));
  const input = data.familyMetadataList || data.familyMetadata;
  if (!Array.isArray(input) || input.length < 1000)
    throw new Error("Unexpected font metadata. Existing catalog retained.");
  const families: FontFamily[] = input.map((f) => ({
    family: f.family,
    category: f.category || "Other",
    subsets: f.subsets || [],
    weights: Object.keys(f.fonts || {})
      .filter((k) => /^\d+$/.test(k))
      .map(Number)
      .sort((a, b) => a - b),
    italicWeights: Object.keys(f.fonts || {})
      .filter((k) => /^\d+i$/.test(k))
      .map((k) => Number(k.slice(0, -1)))
      .sort((a, b) => a - b),
  }));
  if (
    families.some(
      (f) =>
        !safeFontFamily(f.family) ||
        (!f.weights.length && !f.italicWeights.length),
    )
  )
    throw new Error(
      "Unsupported font metadata: " +
        families
          .filter(
            (f) =>
              !safeFontFamily(f.family) ||
              (!f.weights.length && !f.italicWeights.length),
          )
          .map((f) => f.family + ":" + f.weights.join(","))
          .slice(0, 10)
          .join(" | ") +
        ". Existing catalog retained.",
    );
  families.sort((a, b) => a.family.localeCompare(b.family));
  writeFileSync(
    "data/google-fonts.json",
    JSON.stringify({
      source,
      updatedAt: new Date().toISOString().slice(0, 10),
      families,
    }) + "\n",
  );
  console.log(`${families.length} Google font families updated.`);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
