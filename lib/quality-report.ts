import type { Design, DesignNode } from "./design";
import type { LayoutAudit } from "./layout-audit";
export type QualityIssue = { code: string; severity: "action" | "review"; count: number; message: string; nodeIds: string[] };
export function qualityReport(design: Design, audit?: LayoutAudit) {
  const issues: QualityIssue[] = [];
  const nodes: DesignNode[] = [];
  const walk = (items: DesignNode[]) => { for (const node of items) { nodes.push(node); walk(node.children); } };
  walk(design.nodes);
  const add = (code: string, severity: QualityIssue["severity"], selected: DesignNode[], message: string) => {
    if (selected.length) issues.push({ code, severity, count: selected.length, message, nodeIds: selected.map(n => n.id).slice(0, 100) });
  };
  add("missing-image", "action", nodes.filter(n => n.kind === "image" && !n.url), "Add a source image before delivery.");
  add("image-alt", "review", nodes.filter(n => n.kind === "image" && !n.alt?.trim()), "Review image descriptions; decorative images may intentionally have empty alt text.");
  add("form-placeholder", "action", nodes.filter(n => n.text?.startsWith("[Form field:")), "Replace form placeholders with a connected WordPress form or search widget.");
  add("unassigned-link", "action", nodes.filter(n => n.kind === "button" && !n.interaction && (!n.url || n.url === "#")), "Set a destination or connect the action for these buttons.");
  add("source-link", "review", nodes.filter(n => {
    if (!design.source) return false;
    try { return [n.url, n.link, ...(n.runs?.map(r => r.link) || [])].some(link => link && new URL(link).hostname === new URL(design.source!).hostname) && n.kind !== "image" && n.kind !== "video"; } catch { return false; }
  }), "Review links that still lead to the source website.");
  add("commerce", "action", nodes.filter(n => n.product), "Product cards are captured content. Connect WooCommerce products, stock, cart and checkout separately.");
  const layout = audit?.status === "checked" ? audit.devices : [];
  const shifted = layout.reduce((sum, d) => sum + d.shifted + d.missing, 0);
  if (shifted) issues.push({ code: "layout", severity: "action", count: shifted, message: "Review shifted or missing elements across captured screen sizes. These are device observations, not unique elements.", nodeIds: [...new Set(layout.flatMap(d => d.issues.map(i => i.id)))].slice(0, 100) });
  if (!layout.length) issues.push({ code: "layout-unchecked", severity: "review", count: 1, message: "Source layout comparison is unavailable. Check desktop, tablet and mobile before delivery.", nodeIds: [] });
  return {
    status: issues.some(i => i.severity === "action") ? "needs-work" : "review-required",
    elements: nodes.length,
    issues,
    actionItems: issues.filter(i => i.severity === "action").reduce((sum, i) => sum + i.count, 0),
    note: "Pre-delivery checklist, not a fidelity score. Layout measurements describe the initial capture; edits and WordPress rendering need a fresh visual check.",
  };
}
