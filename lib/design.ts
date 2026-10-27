import { safeFontFamily } from "./font-types";
import { z } from "zod";
import { normalizeUrl } from "./network";
export const styleSchema = z
  .object({
    hidden: z.boolean().optional(),
    layout: z.enum(["flex", "grid"]).optional(),
    display: z.enum(["block", "flow-root", "inline-block", "flex", "inline-flex", "grid", "inline-grid"]).optional(),
    float: z.enum(["none", "left", "right"]).optional(),
    clear: z.enum(["none", "left", "right", "both"]).optional(),
    verticalAlign: z.enum(["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super"]).optional(),
    flexShrink: z.number().min(0).max(10).optional(),
    columns: z
      .array(z.number().positive().max(10000))
      .min(1)
      .max(24)
      .optional(),
    columnSpan: z.number().int().min(1).max(24).optional(),
    rowGap: z.number().min(0).max(500).optional(),
    position: z
      .enum(["static", "relative", "absolute", "fixed", "sticky"])
      .optional(),
    top: z.number().min(-5000).max(10000).optional(),
    left: z.number().min(-5000).max(10000).optional(),
    zIndex: z.number().int().min(-100).max(10000).optional(),
    widthPx: z.number().min(0).max(10000).optional(),
    heightAuto: z.boolean().optional(),
    aspectRatio: z.number().min(0).max(100).optional(),
    objectPosition: z.string().regex(/^-?[0-9.]+(?:%|px) -?[0-9.]+(?:%|px)$/).optional(),
    height: z.number().min(0).max(10000).optional(),
    maxWidth: z.number().positive().max(10000).optional(),
    overflow: z.enum(["visible", "hidden", "auto", "clip"]).optional(),
    borderWidth: z.number().min(0).max(50).optional(),
    borderWidths: z.tuple([z.number().min(0).max(50),z.number().min(0).max(50),z.number().min(0).max(50),z.number().min(0).max(50)]).optional(),
    borderColor: z.string().max(100).optional(),
    borderStyle: z
      .enum(["none", "solid", "dashed", "dotted", "double"])
      .optional(),
    textTransform: z
      .enum(["none", "uppercase", "lowercase", "capitalize"])
      .optional(),
    marginAuto: z.boolean().optional(),
    color: z.string().max(100).optional(),
    background: z.string().max(100).optional(),
    fontFamily: z.string().max(1200).optional(),
    fontSize: z.number().min(0).max(180).optional(),
    fontWeight: z.string().max(20).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    direction: z.enum(["row", "column", "row-reverse", "column-reverse"]).optional(),
    gap: z.number().min(0).max(200).optional(),
    padding: z.number().min(0).max(200).optional(),
    radius: z.number().min(0).max(150).optional(),
    width: z.number().min(1).max(300).optional(),
    minHeight: z.number().min(0).max(2500).optional(),
    backgroundImage: z.string().max(2500).optional(),
    backgroundPosition: z.string().max(100).optional(),
    backgroundWidth: z.number().positive().max(1000).optional(),
    backgroundSize: z.enum(["cover", "contain", "auto"]).optional(),
    paddingBox: z
      .tuple([
        z.number().min(0).max(500),
        z.number().min(0).max(500),
        z.number().min(0).max(500),
        z.number().min(0).max(500),
      ])
      .optional(),
    marginBox: z
      .tuple([
        z.number().min(-500).max(500),
        z.number().min(-500).max(500),
        z.number().min(-500).max(500),
        z.number().min(-500).max(500),
      ])
      .optional(),
    justify: z
      .enum([
        "flex-start",
        "center",
        "flex-end",
        "space-between",
        "space-around",
        "space-evenly",
      ])
      .optional(),
    alignItems: z
      .enum(["flex-start", "center", "flex-end", "stretch"])
      .optional(),
    wrap: z.enum(["wrap", "nowrap"]).optional(),
    lineHeightNormal: z.boolean().optional(),
    lineHeight: z.number().min(0).max(300).optional(),
    letterSpacing: z.number().min(-20).max(50).optional(),
    objectFit: z.enum(["cover", "contain", "fill"]).optional(),
  })
  .strict();
export type Style = z.infer<typeof styleSchema>;
export type DesignNode = {
  id: string;
  kind: "container" | "heading" | "text" | "button" | "image" | "video" | "search" | "contact";
  text?: string;
  runs?: {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontFamily?: string;
    link?: string;
  }[];
  link?: string;
  url?: string;
  alt?: string;
  level?: number;
  interaction?: { action: "toggle" | "close"; target: string };
  region?: "header" | "footer";
  product?: boolean;
  panel?: boolean;
  disclosure?: boolean;
  style: Style;
  tablet?: Style;
  mobile?: Style;
  children: DesignNode[];
};
export const nodeSchema: z.ZodType<DesignNode> = z.lazy(() =>
  z
    .object({
      id: z.string().regex(/^[a-f0-9]{7,8}$/),
      kind: z.enum([
        "container",
        "heading",
        "text",
        "button",
        "image",
        "video",
        "search",
        "contact",
      ]),
      text: z.string().max(12000).optional(),
      runs: z
        .array(
          z
            .object({
              text: z.string().max(12000),
              bold: z.boolean().optional(),
              italic: z.boolean().optional(),
              underline: z.boolean().optional(),
              fontFamily: z.string().max(100).refine(safeFontFamily).optional(),
              link: z.string().max(2500).optional(),
            })
            .strict(),
        )
        .max(500)
        .optional(),
      link: z.string().max(2500).optional(),
      url: z.string().max(2500).optional(),
      alt: z.string().max(500).optional(),
      level: z.number().int().min(1).max(6).optional(),
      interaction: z
        .object({
          action: z.enum(["toggle", "close"]),
          target: z.string().regex(/^[a-f0-9]{7,8}$/),
        })
        .strict()
        .optional(),
      region: z.enum(["header", "footer"]).optional(),
      product: z.boolean().optional(),
      panel: z.boolean().optional(),
      disclosure: z.boolean().optional(),
      style: styleSchema,
      tablet: styleSchema.optional(),
      mobile: styleSchema.optional(),
      children: z.array(nodeSchema).max(3000),
    })
    .strict(),
);
export const designSchema = z
  .object({
    assets: z
      .record(
        z
          .string()
          .regex(/^https:\/\/studio-upload\.invalid\/[a-f0-9]{32}\.webp$/),
        z
          .string()
          .max(350000)
          .regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/),
      )
      .optional(),
    fontFaces: z.array(z.object({
      family: z.string().refine(safeFontFamily),
      url: z.string().max(2500).regex(/^https?:\/\/[^\s"'<>\\(){}]+$/),
      weight: z.string().regex(/^(?:[1-9]\d{0,2}|1000)(?: (?:[1-9]\d{0,2}|1000))?$/),
      style: z.enum(["normal", "italic", "oblique"]),
    }).strict()).max(24).optional(),
    catalogTools: z.boolean().optional(),
    title: z.string().min(1).max(200),
    source: z.string().max(2500),
    nodes: z.array(nodeSchema).min(1).max(3000),
    warnings: z.array(z.string().max(1000)).max(80),
  })
  .strict();
export type Design = z.infer<typeof designSchema>;
export const id = () => Math.random().toString(16).slice(2, 10).padEnd(8, "0");
export const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function safeLink(value: string, base?: string) {
  try {
    const u = new URL(value, base);
    normalizeUrl(u.href);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return value.startsWith("#") ? value : "";
  }
}
export function validateDesign(input: unknown): Design {
  // Reject excessive nesting before Zod's recursive schema touches the input.
  const pending: { node: unknown; depth: number }[] = [];
  const candidate = input as { nodes?: unknown } | null;
  if (Array.isArray(candidate?.nodes)) for (const node of candidate.nodes) pending.push({node, depth: 0});
  let total = 0;
  while (pending.length) {
    const {node, depth} = pending.pop()!;
    if (++total > 3000) throw new Error("This page exceeds the 3,000-element limit.");
    if (depth > 24) throw new Error("This page exceeds the 24-level nesting limit.");
    if (node && typeof node === "object" && Array.isArray((node as {children?:unknown}).children))
      for (const child of (node as {children:unknown[]}).children) pending.push({node:child,depth:depth+1});
  }
  const d = designSchema.parse(input);
  if (
    Object.keys(d.assets || {}).length > 32 ||
    JSON.stringify(d.assets || {}).length > 1800000
  )
    throw new Error(
      "Uploaded images exceed this draft’s limit. Remove an image or use a smaller file.",
    );
  const checkAsset = (url: string) => {
    if (url.startsWith("https://studio-upload.invalid/") && !d.assets?.[url])
      throw new Error("An uploaded image is missing from this draft.");
  };
  let count = 0;
  const ids = new Set<string>();
  function walk(n: DesignNode, depth: number) {
    if (++count > 3000 || depth > 24)
      throw new Error("This page is too complex for the first-version export.");
    if (ids.has(n.id)) throw new Error("Duplicate element IDs.");
    ids.add(n.id);
    if (n.kind !== "container" && n.children.length)
      throw new Error("Only containers can contain widgets.");
    if (n.link && !safeLink(n.link))
      throw new Error("Unsafe destination link.");
    if (
      n.runs &&
      (n.runs.reduce((sum, run) => sum + run.text.length, 0) > 12000 ||
        n.runs.some((run) => run.link && !safeLink(run.link)))
    )
      throw new Error("Invalid rich text or link.");
    if (n.url) checkAsset(n.url);
    for (const st of [n.style, n.tablet, n.mobile])
      if (st?.backgroundImage) checkAsset(st.backgroundImage);
    for (const st of [n.style, n.tablet, n.mobile])
      if (st?.backgroundImage && !safeLink(st.backgroundImage))
        throw new Error("Unsafe background image.");
    if (n.url && !safeLink(n.url))
      throw new Error("Unsafe image or link in the design.");
    for (const child of n.children) walk(child, depth + 1);
  }
  d.nodes.forEach((n) => walk(n, 0));
  const panels = new Set<string>();
  const interactions: DesignNode[] = [];
  const inspect = (n: DesignNode) => {
    if (n.panel) panels.add(n.id);
    if (n.interaction) interactions.push(n);
    n.children.forEach(inspect);
  };
  d.nodes.forEach(inspect);
  if (interactions.some((n) => !panels.has(n.interaction!.target)))
    throw new Error("Interaction target is missing from the design.");
  return d;
}
export function nodeCount(d: Design) {
  let n = 0;
  const walk = (x: DesignNode) => {
    n++;
    x.children.forEach(walk);
  };
  d.nodes.forEach(walk);
  return n;
}
export function briefDesign(
  brief: string,
  title: string,
  type: string,
): Design {
  const lines = brief
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const brand = title || lines[0]?.slice(0, 70) || "Your new website";
  const text = (s: string, kind: DesignNode["kind"] = "text"): DesignNode => ({
    id: id(),
    kind,
    text: s,
    style:
      kind === "heading"
        ? { fontSize: 46, fontWeight: "700", color: "#172323" }
        : { fontSize: 18, color: "#536362" },
    children: [],
  });
  const container = (
    children: DesignNode[],
    background = "#ffffff",
  ): DesignNode => ({
    id: id(),
    kind: "container",
    style: { direction: "column", padding: 48, gap: 22, background },
    mobile: { padding: 24 },
    children,
  });
  return {
    title: brand,
    source: "Client brief",
    warnings: [
      "Rule-based brief draft: supplied text has been arranged into editable sections. No AI interpretation was used.",
      ...(type === "ecommerce"
        ? [
            "Store layout is a draft. WooCommerce products, cart, checkout and payment are not connected.",
          ]
        : []),
    ],
    nodes: [
      container(
        [
          text(brand, "heading"),
          text(lines.slice(1).join(" ") || brief),
          {
            id: id(),
            kind: "button",
            text: "Get in touch",
            url: "#contact",
            style: {
              background: "#147d68",
              color: "#ffffff",
              padding: 16,
              radius: 8,
            },
            children: [],
          },
        ],
        "#edf5f0",
      ),
      container([
        text(
          type === "portfolio" ? "Selected work" : "What we offer",
          "heading",
        ),
        text(
          "Replace this section with your services, work, or product categories in Elementor.",
        ),
      ]),
      container(
        [
          text("Let’s work together", "heading"),
          text("Add your contact details and preferred contact method here."),
        ],
        "#edf5f0",
      ),
    ],
  };
}
