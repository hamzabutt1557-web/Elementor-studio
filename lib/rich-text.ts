import { DesignNode, escape } from "./design";
/** Structured runs are escaped; captured markup, event handlers and CSS never execute. */
export function richText(n: DesignNode) {
  if (!n.runs?.length || n.runs.map((r) => r.text).join("") !== n.text)
    return escape(n.text || "").replace(/\n/g, "<br>");
  return n.runs
    .map((run) => {
      let html = escape(run.text).replace(/\n/g, "<br>");
      if (run.fontFamily)
        html =
          '<span style="font-family:&#39;' +
          escape(run.fontFamily) +
          '&#39;">' +
          html +
          "</span>";
      if (run.bold) html = "<strong>" + html + "</strong>";
      if (run.italic) html = "<em>" + html + "</em>";
      if (run.underline) html = "<u>" + html + "</u>";
      if (run.link)
        html = '<a href="' + escape(run.link) + '">' + html + "</a>";
      return html;
    })
    .join("");
}
