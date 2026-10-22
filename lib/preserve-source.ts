import type { Design, DesignNode } from "./design";
/** AI may adjust layout styles, but cannot silently replace the captured page. */
export function preserveSource(original: Design, proposed: Design): Design {
  const content = (n: DesignNode): unknown => {
    const { style, tablet, mobile, children, ...rest } = n;
    const media = [style, tablet, mobile].map((s) => s?.backgroundImage || "");
    return { ...rest, media, children: children.map(content) };
  };
  if (
    JSON.stringify(original.nodes.map(content)) !==
      JSON.stringify(proposed.nodes.map(content)) ||
    original.catalogTools !== proposed.catalogTools ||
    original.source !== proposed.source ||
    original.title !== proposed.title ||
    JSON.stringify(original.fontFaces) !== JSON.stringify(proposed.fontFaces) ||
    JSON.stringify(original.assets) !== JSON.stringify(proposed.assets)
  )
    throw new Error(
      "AI changed captured content or structure. The original draft was preserved.",
    );
  return {
    ...proposed,
    source: original.source,
    title: original.title,
    assets: original.assets,
    fontFaces: original.fontFaces,
  };
}
