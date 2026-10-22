export type LayoutBox = { x: number; y: number; width: number; height: number };
export type LayoutAudit = {
  status: "checked" | "unavailable";
  basis: "initial-capture";
  devices: DeviceAudit[];
  note: string;
};
export type DeviceAudit = {
  device: string;
  width: number;
  compared: number;
  missing: number;
  shifted: number;
  medianDriftPx: number;
  p90DriftPx: number;
  issues: { id: string; driftPx: number; label?: string }[];
};
export function compareLayout(
  device: string,
  width: number,
  source: Record<string, LayoutBox>,
  rendered: Record<string, LayoutBox>,
): DeviceAudit {
  const errors: { id: string; driftPx: number }[] = [];
  let missing = 0;
  for (const [id, before] of Object.entries(source)) {
    if (before.width <= 1 || before.height <= 1) continue;
    const after = rendered[id];
    if (!after || after.width <= 1 || after.height <= 1) {
      missing++;
      continue;
    }
    const driftPx = Math.round(
      Math.max(
        Math.abs(before.x - after.x),
        Math.abs(before.y - after.y),
        Math.abs(before.width - after.width),
        Math.abs(before.height - after.height),
      ),
    );
    errors.push({ id, driftPx });
  }
  const sorted = errors.map((x) => x.driftPx).sort((a, b) => a - b);
  const percentile = (p: number) =>
    sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] || 0;
  return {
    device,
    width,
    compared: errors.length,
    missing,
    shifted: errors.filter((x) => x.driftPx > 24).length,
    medianDriftPx: percentile(0.5),
    p90DriftPx: percentile(0.9),
    issues: errors
      .filter((x) => x.driftPx > 24)
      .sort((a, b) => b.driftPx - a.driftPx)
      .slice(0, 5),
  };
}
/** Browser-only measurement; no imports, no source-site code executed. */
export function previewGeometry(): Record<string, LayoutBox> {
  return Object.fromEntries(
    Array.from(document.querySelectorAll<HTMLElement>("[data-estudio-id]"))
      .filter((el) => getComputedStyle(el).display !== "none")
      .map((el) => {
        const r = el.getBoundingClientRect();
        return [
          el.dataset.estudioId!,
          {
            x: r.left + scrollX,
            y: r.top + scrollY,
            width: r.width,
            height: r.height,
          },
        ];
      }),
  );
}
