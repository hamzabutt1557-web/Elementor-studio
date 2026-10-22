import type { DesignNode } from "./design";
export type TextRun = NonNullable<DesignNode["runs"]>[number];
export type TextMark = "bold" | "italic" | "underline" | "fontFamily";
export function textRuns(text: string, runs?: TextRun[]): TextRun[] {
  return runs?.map((r) => r.text).join("") === text
    ? runs.map((r) => ({ ...r }))
    : [{ text }];
}
function sliceRuns(runs: TextRun[], start: number, end: number) {
  let at = 0;
  return runs.flatMap((run) => {
    const next = at + run.text.length;
    const text = run.text.slice(
      Math.max(0, start - at),
      Math.max(0, Math.min(run.text.length, end - at)),
    );
    at = next;
    return text ? [{ ...run, text }] : [];
  });
}
function merge(runs: TextRun[]) {
  const out: TextRun[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const previous = out.at(-1);
    const props = ({ text, ...rest }: TextRun) => JSON.stringify(rest);
    if (previous && props(previous) === props(r)) previous.text += r.text;
    else out.push({ ...r });
  }
  return out;
}
export function formatText(
  text: string,
  runs: TextRun[] | undefined,
  start: number,
  end: number,
  mark: TextMark,
  value?: string,
) {
  const base = textRuns(text, runs);
  start = Math.max(0, Math.min(text.length, start));
  end = Math.max(start, Math.min(text.length, end));
  if (start === end) {
    start = 0;
    end = text.length;
  }
  const selected = sliceRuns(base, start, end);
  const enabled =
    mark === "fontFamily" ? value : !selected.every((r) => r[mark]);
  const changed = selected.map((r) => {
    const next = { ...r };
    if (enabled) Object.assign(next, { [mark]: enabled });
    else delete next[mark];
    return next;
  });
  return merge([
    ...sliceRuns(base, 0, start),
    ...changed,
    ...sliceRuns(base, end, text.length),
  ]);
}
/** Preserve unchanged formatting; inserted characters inherit the adjoining run. */
export function replaceText(
  oldText: string,
  newText: string,
  runs?: TextRun[],
) {
  const base = textRuns(oldText, runs);
  let start = 0;
  while (
    start < oldText.length &&
    start < newText.length &&
    oldText[start] === newText[start]
  )
    start++;
  let oldEnd = oldText.length,
    newEnd = newText.length;
  while (
    oldEnd > start &&
    newEnd > start &&
    oldText[oldEnd - 1] === newText[newEnd - 1]
  ) {
    oldEnd--;
    newEnd--;
  }
  let position = 0;
  const inherit = base.find((r) => {
    position += r.text.length;
    return position >= start;
  }) ||
    base[0] || { text: "" };
  return merge([
    ...sliceRuns(base, 0, start),
    { ...inherit, text: newText.slice(start, newEnd) },
    ...sliceRuns(base, oldEnd, oldText.length),
  ]);
}
