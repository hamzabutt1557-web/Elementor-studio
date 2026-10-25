import { cssFontStack } from "./font-types";
import { designFonts, fontStylesheet } from "./font-library";
export function videoSource(url: string) {
  const yt = url.match(
    /^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
  );
  if (yt)
    return {
      type: "youtube",
      url: "https://www.youtube.com/watch?v=" + yt[1],
      embed: "https://www.youtube-nocookie.com/embed/" + yt[1],
    };
  const vi = url.match(/^https:\/\/player\.vimeo\.com\/video\/(\d+)/);
  if (vi)
    return {
      type: "vimeo",
      url: "https://vimeo.com/" + vi[1],
      embed: "https://player.vimeo.com/video/" + vi[1],
    };
  return { type: "hosted", url, embed: "" };
}
import { richText } from "./rich-text";
import { assetSource } from "./uploaded-assets";
import { editorScript } from "./editor-runtime";
import { createHash } from "node:crypto";
import { interactionCss, interactionScript } from "./interactions";
import { Design, DesignNode, Style, escape, validateDesign } from "./design";
type Element = {
  id: string;
  elType: string;
  isInner: boolean;
  settings: Record<string, unknown>;
  elements: Element[];
  widgetType?: string;
};
function settings(
  s: Style,
  kind: DesignNode["kind"],
  suffix = "",
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => (out[k + suffix] = v);
  const advanced = (k: string) => (kind === "container" ? k : "_" + k);
  if (s.display !== undefined) set("studio_display", s.display);
  if (s.float !== undefined) set("studio_float", s.float);
  if (s.clear !== undefined) set("studio_clear", s.clear);
  if (s.verticalAlign !== undefined) set("studio_vertical_align", s.verticalAlign);
  if (s.flexShrink !== undefined) set("studio_flex_shrink", { unit: "px", size: s.flexShrink, sizes: [] });
  if (s.hidden !== undefined)
    out["hide" + (suffix || "_desktop")] = s.hidden
      ? "hidden-" + (suffix.slice(1) || "desktop")
      : "";
  if (s.padding !== undefined)
    set(advanced("padding"), {
      unit: "px",
      top: String(s.padding),
      right: String(s.padding),
      bottom: String(s.padding),
      left: String(s.padding),
      isLinked: true,
    });
  const box = (values: number[]) => ({
    unit: "px",
    top: String(values[0]),
    right: String(values[1]),
    bottom: String(values[2]),
    left: String(values[3]),
    isLinked: false,
  });
  if (s.paddingBox) set(advanced("padding"), box(s.paddingBox));
  if (s.marginBox) set(advanced("margin"), box(s.marginBox));
  // Equal opposite margins retain the layout footprint and expose movement
  // through native Elementor Advanced controls (relative offsets have no control).
  if (
    s.position === "relative" &&
    (s.left !== undefined || s.top !== undefined)
  ) {
    const m = s.marginBox || [0, 0, 0, 0];
    set(
      advanced("margin"),
      box([
        m[0] + (s.top || 0),
        m[1] - (s.left || 0),
        m[2] - (s.top || 0),
        m[3] + (s.left || 0),
      ]),
    );
  }
  if (s.width !== undefined) {
    set(kind === "container" ? "width" : "_element_custom_width", {
      unit: "%",
      size: s.width,
      sizes: [],
    });
    if (kind !== "container") set("_element_width", "initial");
  }
  if (s.maxWidth !== undefined && s.width !== undefined) {
    set(kind === "container" ? "width" : "_element_custom_width", {
      unit: "custom",
      size: `min(${s.width}%, ${s.maxWidth}px)`,
      sizes: [],
    });
  }
  if (s.minHeight !== undefined)
    set("min_height", { unit: "px", size: s.minHeight, sizes: [] });
  if (s.backgroundImage !== undefined) {
    set(advanced("background_background"), "classic");
    set(advanced("background_image"), { url: s.backgroundImage, id: "" });
    const customPosition = s.backgroundPosition?.match(
      /^(-?[\d.]+)(%|px)\s+(-?[\d.]+)(%|px)$/,
    );
    set(
      advanced("background_position"),
      customPosition ? "initial" : s.backgroundPosition || "center center",
    );
    if (customPosition) {
      set(advanced("background_xpos"), {
        unit: customPosition[2],
        size: Number(customPosition[1]),
        sizes: [],
      });
      set(advanced("background_ypos"), {
        unit: customPosition[4],
        size: Number(customPosition[3]),
        sizes: [],
      });
    }
    set(
      advanced("background_size"),
      s.backgroundWidth ? "initial" : s.backgroundSize || "cover",
    );
    if (s.backgroundWidth)
      set(advanced("background_bg_width"), {
        unit: "%",
        size: s.backgroundWidth,
        sizes: [],
      });
    set(advanced("background_repeat"), "no-repeat");
  }
  if (s.position && ["absolute", "fixed"].includes(s.position)) {
    set(advanced("position"), s.position);
    if (s.left !== undefined)
      set("_offset_x", { unit: "px", size: s.left, sizes: [] });
    if (s.top !== undefined)
      set("_offset_y", { unit: "px", size: s.top, sizes: [] });
  }
  if (s.position && ["static", "relative"].includes(s.position))
    set(advanced("position"), "");
  if (s.zIndex !== undefined) set(advanced("z_index"), s.zIndex);
  if (s.columnSpan) set(advanced("grid_column"), String(s.columnSpan));
  if (s.overflow && kind === "container")
    set("overflow", s.overflow === "clip" ? "hidden" : s.overflow);
  if (s.height !== undefined && kind === "image")
    set("height", { unit: "px", size: s.height, sizes: [] });
  if (s.textTransform) set("typography_text_transform", s.textTransform);
  if (s.borderWidth !== undefined || s.borderWidths) {
    set(
      advanced("border_border"),
      (s.borderWidths?.some(v=>v>0) || s.borderWidth) ? s.borderStyle || "solid" : "none",
    );
    set(
      advanced("border_width"),
      box(s.borderWidths || Array(4).fill(s.borderWidth || 0)),
    );
    set(advanced("border_color"), s.borderColor || s.color || "#000000");
  }
  if (s.marginAuto) {
    const value =
      (out[advanced("margin") + suffix] as Record<string, unknown>) ||
      box([0, 0, 0, 0]);
    set(advanced("margin"), {
      ...value,
      unit: "custom",
      top: String(value.top || "0") + "px",
      bottom: String(value.bottom || "0") + "px",
      left: "auto",
      right: "auto",
    });
  }
  if (s.lineHeight)
    set("typography_line_height", {
      unit: "px",
      size: s.lineHeight,
      sizes: [],
    });
  if (s.letterSpacing !== undefined)
    set("typography_letter_spacing", {
      unit: "px",
      size: s.letterSpacing,
      sizes: [],
    });
  if (s.objectFit && kind === "image") set("object-fit", s.objectFit);
  if (s.background) {
    set(advanced("background_background"), "classic");
    set(advanced("background_color"), s.background);
  }
  if (s.radius !== undefined)
    set(advanced("border_radius"), {
      unit: "px",
      top: String(s.radius),
      right: String(s.radius),
      bottom: String(s.radius),
      left: String(s.radius),
      isLinked: true,
    });
  if (s.color)
    set(
      kind === "heading"
        ? "title_color"
        : kind === "button"
          ? "button_text_color"
          : "text_color",
      s.color,
    );
  if (s.align) set("align", s.align);
  if (s.fontSize || s.fontFamily || s.fontWeight) {
    set("typography_typography", "custom");
    if (s.fontSize)
      set("typography_font_size", { unit: "px", size: s.fontSize, sizes: [] });
    if (s.fontFamily)
      set(
        "typography_font_family",
        s.fontFamily.split(",")[0].replace(/["']/g, ""),
      );
    if (s.fontWeight) set("typography_font_weight", s.fontWeight);
  }
  if (kind === "container") {
    if (s.layout === "grid" && s.columns) {
      set("container_type", "grid");
      set("grid_columns_grid", {
        unit: "custom",
        size: s.columns.map((v) => `minmax(0, ${v}fr)`).join(" "),
        sizes: [],
      });
      set("grid_rows_grid", { unit: "custom", size: "auto", sizes: [] });
      set("grid_gaps", {
        unit: "px",
        column: String(s.gap || 0),
        row: String(s.rowGap ?? s.gap ?? 0),
        isLinked: false,
      });
    }
    if (s.direction) set("flex_direction", s.direction);
    if (s.justify) set("flex_justify_content", s.justify);
    if (s.alignItems) set("flex_align_items", s.alignItems);
    if (s.wrap) set("flex_wrap", s.wrap);
    if (s.gap !== undefined)
      set("flex_gap", {
        unit: "px",
        size: s.gap,
        column: String(s.gap),
        row: String(s.rowGap ?? s.gap),
        isLinked: true,
      });
  }
  return out;
}
function convert(n: DesignNode, inner = false): Element {
  // Breakpoint records are diffs. Controls such as grid columns, bounded
  // widths and positioning need their inherited values to generate native CSS.
  const editablePanel = (s: Style): Style => n.panel ? {
    ...s, position: "static", zIndex: undefined, top: undefined,
    left: undefined, height: undefined,
  } : s;
  const desktop = editablePanel(n.style);
  const tablet = editablePanel({ ...n.style, ...n.tablet });
  const mobile = editablePanel({ ...n.style, ...n.tablet, ...n.mobile });
  const responsive = (base: Style, next: Style, suffix: string) => {
    const inherited = settings(base, n.kind);
    return Object.fromEntries(Object.entries(settings(next, n.kind, suffix)).filter(([key, value]) => {
      const baseKey = key.startsWith("hide_") ? "hide_desktop" : key.slice(0, -suffix.length);
      return JSON.stringify(value) !== JSON.stringify(inherited[baseKey]);
    }));
  };
  const e: Element = {
    id: n.id,
    elType: n.kind === "container" ? "container" : "widget",
    isInner: false,
    settings: {
      ...settings(desktop, n.kind),
      ...responsive(desktop, tablet, "_tablet"),
      ...responsive(tablet, mobile, "_mobile"),
    },
    elements: [],
  };
  const classes = [
    "estudio-node",
    n.product ? "estudio-product" : "",
    n.disclosure ? "estudio-disclosure" : "",
    n.panel ? `estudio-panel estudio-panel-${n.id}` : "",
    n.interaction
      ? `estudio-${n.interaction.action}-${n.interaction.target}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (classes)
    e.settings[n.kind === "container" ? "css_classes" : "_css_classes"] =
      classes;
  if (n.link) {
    e.settings.link = { url: n.link, is_external: "", nofollow: "" };
    if (n.kind === "container") e.settings.html_tag = "a";
    if (n.kind === "image") e.settings.link_to = "custom";
  }
  if (n.kind === "container") {
    e.settings.content_width = "full";
    e.elements = n.children.map((c) => convert(c, true));
  } else {
    e.widgetType = (
      {
        heading: "heading",
        text: "text-editor",
        button: "button",
        image: "image",
        video: "video",
        search: "estudio-search",
        contact: "estudio-contact",
      } as const
    )[n.kind];
    if (n.kind === "contact") e.settings.studio_contact_button = (n.text || "Send message").slice(0, 200);
    if (n.kind === "search") e.settings.studio_search_placeholder = (n.text || "Search").slice(0, 200);
    if (n.kind === "heading") {
      e.settings.title = richText(n);
      e.settings.header_size = "h" + (n.level || 2);
    }
    if (n.kind === "text") {
      // The captured margin is on the widget. Theme paragraph margins must not
      // add a second margin inside it (and accumulate down long catalogues).
      e.settings.editor = '<p style="margin:0">' + richText(n) + "</p>";
      e.settings.paragraph_spacing = { unit: "px", size: 0, sizes: [] };
    }
    if (n.kind === "button") {
      // Source box decoration is already mapped to the widget wrapper above.
      // Reset Elementor's inner button defaults instead of doubling its padding.
      e.settings.background_color = "rgba(0,0,0,0)";
      e.settings.text_padding = { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true };
      e.settings.border_radius = { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true };
      e.settings.border_border = "none";
      e.settings.text = escape(n.text || "Button");
      e.settings.link = { url: n.url || "", is_external: "", nofollow: "" };
    }
    if (n.kind === "video") {
      const video = videoSource(n.url || "");
      e.settings.video_type = video.type;
      e.settings[video.type === "hosted" ? "hosted_url" : video.type + "_url"] =
        video.type === "hosted" ? { url: video.url, id: "" } : video.url;
      e.settings.controls = "yes";
    }
    if (n.kind === "image") {
      // The wrapper owns the captured width. Fill that wrapper instead of
      // rendering a smaller source image at its intrinsic pixel width.
      e.settings.width = { unit: "%", size: 100, sizes: [] };
      e.settings.image = { url: n.url || "", id: "" };
      e.settings.image_size = "full";
      e.settings.caption_source = "none";
    }
  }
  return e;
}
export function toElementor(input: Design) {
  const d = validateDesign(input);
  return {
    title: d.title,
    type: "page",
    version: "0.4",
    page_settings: [],
    content: d.nodes.map((n) => {
      const e = convert(n);
      if (d.catalogTools) {
        const key = n.kind === "container" ? "css_classes" : "_css_classes";
        e.settings[key] = ((e.settings[key] || "") + " estudio-tools").trim();
      }
      return e;
    }),
    studio_fonts: designFonts(d),
    studio_source_fonts: d.fontFaces || [],
  };
}
export function previewHtml(input: Design, editable = false) {
  const d = validateDesign(input);
  const css = (s: Style, kind: string) => {
    const rules: string[] = [];
    const push = (k: string, v: unknown) => {
      if (v !== undefined && !/[<>{};]/.test(String(v)))
        rules.push(`${k}:${v}`);
    };
    push("color", s.color);
    push("background", s.background);
    if (s.fontFamily) push("font-family", cssFontStack(s.fontFamily));
    if (s.fontSize) push("font-size", s.fontSize + "px");
    push("font-weight", s.fontWeight);
    push("flex-shrink", s.flexShrink);
    push("float", s.float);
    push("clear", s.clear);
    push("vertical-align", s.verticalAlign);
    if (s.width !== undefined) push("width", s.width + "%");
    if (s.height !== undefined) push("height", s.height + "px");
    if (s.maxWidth !== undefined) push("max-width", s.maxWidth + "px");
    push("position", s.position);
    if (s.top !== undefined) push("top", s.top + "px");
    if (s.left !== undefined) push("left", s.left + "px");
    push("z-index", s.zIndex);
    push("overflow", s.overflow);
    push("text-transform", s.textTransform);
    if (s.borderWidth !== undefined) push("border-width", s.borderWidth + "px");
    if (s.borderWidths) push("border-width", s.borderWidths.map(v=>v+"px").join(" "));
    push("border-style", s.borderStyle);
    push("border-color", s.borderColor);
    if (s.columnSpan) push("grid-column", "span " + s.columnSpan);
    if (s.minHeight !== undefined) push("min-height", s.minHeight + "px");
    if (s.lineHeight) push("line-height", s.lineHeight + "px");
    if (s.letterSpacing !== undefined)
      push("letter-spacing", s.letterSpacing + "px");
    if (s.paddingBox)
      push("padding", s.paddingBox.map((v) => v + "px").join(" "));
    if (s.marginBox) push("margin", s.marginBox.map((v) => v + "px").join(" "));
    if (s.marginAuto) {
      push("margin-left", "auto");
      push("margin-right", "auto");
    }
    if (s.objectFit) push("object-fit", s.objectFit);
    if (s.backgroundImage === "") rules.push("background-image:none");
    if (s.backgroundImage) {
      const url = assetSource(s.backgroundImage, d.assets).replace(
        /[<>"'()\\\s]/g,
        (c) => encodeURIComponent(c),
      );
      rules.push('background-image:url("' + url + '")');
      push(
        "background-size",
        s.backgroundWidth
          ? s.backgroundWidth + "% auto"
          : s.backgroundSize || "cover",
      );
      push("background-position", s.backgroundPosition || "center");
      push("background-repeat", "no-repeat");
    }
    push("text-align", s.align);
    if (s.padding !== undefined && !s.paddingBox)
      push("padding", s.padding + "px");
    if (s.radius !== undefined) push("border-radius", s.radius + "px");
    if (kind === "container") {
      push("display", s.layout || "flex");
      if (s.layout === "grid" && s.columns)
        push(
          "grid-template-columns",
          s.columns.map((v) => `minmax(0, ${v}fr)`).join(" "),
        );
      push("flex-direction", s.direction || "column");
      push("justify-content", s.justify);
      push("align-items", s.alignItems);
      push("flex-wrap", s.wrap || "wrap");
      if (s.gap !== undefined) push("column-gap", s.gap + "px");
      if (s.rowGap !== undefined || s.gap !== undefined)
        push("row-gap", (s.rowGap ?? s.gap) + "px");
    }
    if (s.display) push("display", s.display);
    if (s.hidden) rules.push("display:none");
    else if (s.hidden === false && kind !== "container")
      push("display", s.display || "block");
    return rules.join(";");
  };
  let rules = "";
  const render = (n: DesignNode): string => {
    rules += `#e${n.id}{${css(n.style, n.kind)}}@media(max-width:1024px){#e${n.id}{${css({ ...n.style, ...n.tablet }, n.kind)}}}@media(max-width:767px){#e${n.id}{${css({ ...n.style, ...n.tablet, ...n.mobile }, n.kind)}}}`;
    const classes = [
      n.product ? "estudio-product" : "",
      n.disclosure ? "estudio-disclosure" : "",
      n.panel ? `estudio-panel estudio-panel-${n.id}` : "",
      n.interaction
        ? `estudio-${n.interaction.action}-${n.interaction.target}`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    const attrs = `data-estudio-id="${n.id}" id="e${n.id}" class="${classes}"`;
    if (n.kind === "container")
      return n.link
        ? `<a ${attrs} href="${escape(n.link)}">${n.children.map(render).join("")}</a>`
        : `<section ${attrs}>${n.children.map(render).join("")}</section>`;
    if (n.kind === "heading")
      return `<h${n.level || 2} ${attrs}>${richText(n)}</h${n.level || 2}>`;
    if (n.kind === "contact")
      return `<div ${attrs}><div style="display:grid;gap:16px"><label>Name<input aria-label="Name" placeholder="Name" style="display:block;width:100%;padding:12px;border:1px solid #94a3b8;border-radius:6px"></label><label>Email<input type="email" aria-label="Email" placeholder="Email" style="display:block;width:100%;padding:12px;border:1px solid #94a3b8;border-radius:6px"></label><label>Message<textarea aria-label="Message" style="display:block;width:100%;min-height:130px;padding:12px;border:1px solid #94a3b8;border-radius:6px"></textarea></label><button type="button" disabled style="padding:12px;border:0;border-radius:6px;background:#147d68;color:white">${escape(n.text || "Send message")}</button><small>Preview only. Submissions work after publishing in WordPress.</small></div></div>`;
    if (n.kind === "search")
      return `<div ${attrs}><input class="estudio-search-input" type="search" aria-label="Search this site" placeholder="${escape(n.text || "Search")}" title="Search connects to your WordPress site after import"></div>`;
    if (n.kind === "video") {
      const v = videoSource(n.url || "");
      return v.type === "hosted"
        ? `<video ${attrs} controls preload="metadata" src="${escape(v.url)}"></video>`
        : `<iframe ${attrs} title="Video preview" loading="lazy" src="${escape(v.embed)}" allowfullscreen></iframe>`;
    }
    if (n.kind === "image")
      return `${n.link ? '<a href="' + escape(n.link) + '">' : ""}<img ${attrs} src="${escape(assetSource(n.url || "", d.assets))}" alt="${escape(n.alt || "")}" loading="eager">${n.link ? "</a>" : ""}`;
    if (n.kind === "button" && n.interaction)
      return `<button type="button" ${attrs}>${escape(n.text || "Menu")}</button>`;
    if (n.kind === "button")
      return `<a ${attrs} href="${escape(n.url || "#")}">${escape(n.text || "")}</a>`;
    return `<p ${attrs}>${richText(n)}</p>`;
  };
  const body = d.nodes.map(render).join("");
  const fontLink = designFonts(d)
    .map(
      (font) =>
        `<link rel="stylesheet" href="${escape(fontStylesheet(font))}">`,
    )
    .join("");
  const sourceFonts = (d.fontFaces || []).map(f => `@font-face{font-family:${cssFontStack(f.family)};src:url("${f.url}");font-weight:${f.weight};font-style:${f.style};font-display:swap}`).join("");
  const runtime = interactionScript + (editable ? editorScript : "");
  const hash = createHash("sha256").update(runtime).digest("base64");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; media-src https: http:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https: http:; script-src 'sha256-${hash}';">${fontLink}<style>${sourceFonts}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#172323;background:white}body>section{margin:0}h1,h2,h3,h4,h5,h6,p{margin:0;overflow-wrap:break-word}section{min-width:0;flex-wrap:wrap}video,iframe{max-width:100%;width:100%;aspect-ratio:16/9;border:0}img{max-width:100%;height:auto;object-fit:contain}a{color:inherit;text-decoration:none}body a[data-estudio-id]{display:inline-block;width:fit-content;text-decoration:none}section>section{flex-shrink:1}button{font:inherit;cursor:pointer}a,button{min-width:0}${rules}${interactionCss}</style></head><body>${d.catalogTools ? '<span class="estudio-tools" hidden></span>' : ""}${body}<script>${runtime}</script></body></html>`;
}
