export type CanvasBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type Alignment =
  "left" | "center" | "right" | "top" | "middle" | "bottom";
// Self-contained: the same function runs in tests and the sandboxed preview.
export function alignmentDeltas(
  boxes: CanvasBox[],
  action: Alignment,
  parentBox?: CanvasBox,
) {
  if (!boxes.length) return [];
  const reference =
    boxes.length === 1 && parentBox
      ? parentBox
      : {
          x: Math.min(...boxes.map((b) => b.x)),
          y: Math.min(...boxes.map((b) => b.y)),
          width:
            Math.max(...boxes.map((b) => b.x + b.width)) -
            Math.min(...boxes.map((b) => b.x)),
          height:
            Math.max(...boxes.map((b) => b.y + b.height)) -
            Math.min(...boxes.map((b) => b.y)),
        };
  return boxes.map((b) => ({
    id: b.id,
    dx:
      action === "left"
        ? reference.x - b.x
        : action === "center"
          ? reference.x + (reference.width - b.width) / 2 - b.x
          : action === "right"
            ? reference.x + reference.width - b.width - b.x
            : 0,
    dy:
      action === "top"
        ? reference.y - b.y
        : action === "middle"
          ? reference.y + (reference.height - b.height) / 2 - b.y
          : action === "bottom"
            ? reference.y + reference.height - b.height - b.y
            : 0,
  }));
}
