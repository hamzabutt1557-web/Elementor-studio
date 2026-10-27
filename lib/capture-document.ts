// Runs inside the source browser. Keep self-contained: no server imports.
export function captureDocument() {
  const warning = new Set<string>();
  let count = 0;
  let depthLimited = false;
  let nodeLimited = false;
  let clippedCount = 0;
  const geometry: Record<
    string,
    { x: number; y: number; width: number; height: number }
  > = {};
  const recordBox = (id: string, rect: DOMRect) => {
    geometry[id] = {
      x: rect.left + scrollX,
      y: rect.top + scrollY,
      width: rect.width,
      height: rect.height,
    };
  };
  const hashId = (value: string) => {
    let h = 2166136261;
    for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return (h >>> 0).toString(16).padStart(8, "0");
  };
  const menuTargets = new Map<Element, { id: string; target: Element }>();
  const panels: any[] = [];
  const panelTargets = new Set<Element>();
  document
    .querySelectorAll("button,[aria-controls],[data-wau-slideout-target]")
    .forEach((trigger) => {
      const triggerStyle = getComputedStyle(trigger),
        triggerBox = trigger.getBoundingClientRect();
      if (
        triggerStyle.display === "none" ||
        triggerStyle.visibility === "hidden" ||
        triggerStyle.opacity === "0" ||
        !triggerBox.width ||
        !triggerBox.height
      )
        return;
      const key =
        trigger.getAttribute("aria-controls") ||
        trigger.getAttribute("data-wau-slideout-target");
      if (
        !key ||
        !/menu|nav/i.test(key + " " + trigger.getAttribute("aria-label"))
      )
        return;
      const target =
        document.getElementById(key) ||
        Array.from(document.querySelectorAll("[data-wau-slideout]")).find(
          (e) => e.getAttribute("data-wau-slideout") === key,
        );
      if (!target || !target.querySelector("a[href]")) return;
      const id = hashId("navigation:" + key);
      menuTargets.set(trigger, { id, target });
      if (panelTargets.has(target)) return;
      panelTargets.add(target);
      const links = new Map<string, { text: string; url: string }>();
      target.querySelectorAll("a[href]").forEach((a) => {
        const text = (a.textContent || "").replace(/\s+/g, " ").trim();
        const url = (a as HTMLAnchorElement).href;
        if (text && text.length < 150 && !links.has(url) && links.size < 40)
          links.set(url, { text, url });
      });
      panels.push({
        id,
        kind: "container",
        panel: true,
        style: {
          position: "fixed",
          top: 0,
          left: 0,
          width: Math.min(90, (400 / innerWidth) * 100),
          height: 900,
          zIndex: 10000,
          overflow: "auto",
          background: "#ffffff",
          color: "#111111",
          paddingBox: [24, 24, 24, 24],
          gap: 18,
          direction: "column",
        },
        children: [
          {
            id: hashId(id + ":close"),
            kind: "button",
            text: "Close menu ×",
            url: "#",
            interaction: { action: "close", target: id },
            style: { fontSize: 16, color: "#111111", width: 100 },
            children: [],
          },
          ...Array.from(links.values()).map((link, i) => ({
            id: hashId(id + ":" + i),
            kind: "button",
            ...link,
            style: {
              fontSize: 16,
              color: "#111111",
              width: 100,
              paddingBox: [8, 0, 8, 0],
            },
            children: [],
          })),
        ],
      });
    });
  const visibleText = (el: Element) => {
    const readText = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
      if (!(node instanceof Element)) return "";
      if (node.matches("script,style,noscript,svg,template")) return "";
      const st = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      if (
        st.display === "none" ||
        st.visibility === "hidden" ||
        st.opacity === "0" ||
        (box.width <= 1 &&
          box.height <= 1 &&
          (st.overflow === "hidden" ||
            st.clip !== "auto" ||
            st.clipPath !== "none"))
      )
        return "";
      return Array.from(node.childNodes).map(readText).join(" ");
    };
    return readText(el).replace(/\s+/g, " ").trim();
  };
  const inlineRuns = (el: Element) => {
    const runs: any[] = [];
    const walk = (node: Node) => {
      if (runs.length >= 500) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (!parent) return;
        const st = getComputedStyle(parent);
        if (
          st.display === "none" ||
          st.visibility === "hidden" ||
          st.opacity === "0"
        )
          return;
        const a = parent.closest("a[href]") as HTMLAnchorElement | null;
        runs.push({
          text: /^(pre|pre-wrap|break-spaces)$/.test(st.whiteSpace)
            ? node.textContent || ""
            : st.whiteSpace === "pre-line"
              ? (node.textContent || "").replace(/[ \t\r\f]+/g, " ")
              : (node.textContent || "").replace(/[ \t\r\n\f]+/g, " "),
          bold: Number(st.fontWeight) >= 600,
          italic: st.fontStyle === "italic",
          underline: st.textDecorationLine.includes("underline"),
          ...(a && el.contains(a) ? { link: a.href } : {}),
        });
        return;
      }
      if (
        !(node instanceof Element) ||
        node.matches("script,style,noscript,svg,template")
      )
        return;
      const st = getComputedStyle(node);
      if (
        st.display === "none" ||
        st.visibility === "hidden" ||
        st.opacity === "0"
      )
        return;
      if (node.tagName === "BR") {
        runs.push({ text: "\n" });
        return;
      }
      node.childNodes.forEach(walk);
    };
    walk(el);
    if (
      !/^(pre|pre-wrap|break-spaces)$/.test(getComputedStyle(el).whiteSpace)
    ) {
      for (let i = 0; i < runs.length; i++) {
        if (i && / $/.test(runs[i - 1].text))
          runs[i].text = runs[i].text.replace(/^ +/, "");
      }
      if (runs.length) {
        runs[0].text = runs[0].text.replace(/^ +/, "");
        runs[runs.length - 1].text = runs[runs.length - 1].text.replace(
          / +$/,
          "",
        );
      }
    }
    return runs.filter((r) => r.text);
  };
  const read = (el: Element, path: string, depth: number): any[] => {
    if (count >= 3000) { nodeLimited = true; return []; }
    if (depth > 22) {
      depthLimited = true;
      return [];
    }
    const tag = el.tagName.toLowerCase();
    if (panelTargets.has(el)) return [];
    if (["script", "style", "noscript", "link", "meta"].includes(tag))
      return [];
    const s = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    let clipped = false;
    for (
      let parent = el.parentElement;
      parent && parent !== document.body;
      parent = parent.parentElement
    ) {
      const st = getComputedStyle(parent),
        bounds = parent.getBoundingClientRect();
      const horizontal =
        ["hidden", "clip", "auto", "scroll"].includes(st.overflowX) &&
        (rect.right <= bounds.left + 0.5 || rect.left >= bounds.right - 0.5);
      const vertical =
        ["hidden", "clip", "auto", "scroll"].includes(st.overflowY) &&
        (rect.bottom <= bounds.top + 0.5 || rect.top >= bounds.bottom - 0.5);
      if (horizontal || vertical) {
        clipped = true;
        break;
      }
    }
    if (clipped && !el.children.length) {
      clippedCount++;
      return [];
    }
    const pendingImage =
      tag === "img" &&
      Boolean(el.getAttribute("data-srcset") || el.getAttribute("data-src")) &&
      !/--2|hover/i.test(el.className);
    // Invisible in-flow controls still reserve space. Keep a blank editable
    // spacer, without their hidden content or interactions, so later controls
    // do not jump upward (for example a hidden wishlist above Quick View).
    if (s.display !== "none" && !pendingImage &&
        (s.visibility === "hidden" || s.opacity === "0") &&
        !["absolute", "fixed"].includes(s.position) && rect.width > 1 && rect.height > 1) {
      const id = hashId(path);
      const margin = [s.marginTop,s.marginRight,s.marginBottom,s.marginLeft]
        .map(v=>Math.max(-200,Math.min(200,parseFloat(v)||0)));
      count++;
      if (!clipped) recordBox(id,rect);
      return [{id,kind:"container",text:"",children:[],style:{
        display:s.display.startsWith("inline")?"inline-block":"block",
        widthPx:Math.min(10000,rect.width),height:Math.min(10000,rect.height),
        heightAuto:false,minHeight:0,padding:0,marginBox:margin,flexShrink:0,
        float:["left","right"].includes(s.cssFloat)?s.cssFloat:"none",
      }}];
    }
    if (
      s.display === "none" ||
      s.visibility === "hidden" ||
      (s.opacity === "0" && !pendingImage) ||
      (!rect.width &&
        !rect.height &&
        !pendingImage &&
        !Array.from(el.children).some((c) => {
          const r = c.getBoundingClientRect();
          return r.width > 1 && r.height > 1;
        })) ||
      (rect.width <= 1 &&
        rect.height <= 1 &&
        (s.overflow === "hidden" || s.clip !== "auto" || s.clipPath !== "none"))
    )
      return [];
    if (
      ["absolute", "fixed"].includes(s.position) &&
      rect.bottom <= 0 &&
      rect.top < 0
    )
      return [];
    const isSearchField = tag === "input" && ["text", "search", ""].includes((el.getAttribute("type") || "").toLowerCase()) &&
      (el.getAttribute("type")?.toLowerCase() === "search" || !!el.closest('[role="search"]') ||
        /(?:^|\/)search(?:[/?#]|$)/i.test(el.closest("form")?.getAttribute("action") || ""));
    if (
      !isSearchField && ["input", "textarea", "select"].includes(tag) &&
      el.getAttribute("type") !== "hidden"
    ) {
      warning.add(
        "Form fields are editable placeholders only. Connect a WordPress form plugin; submissions and validation are not connected.",
      );
    }
    const artwork = el.getAttribute("data-studio-artwork");
    const mediaUrl =
      tag === "video"
        ? (el as HTMLVideoElement).currentSrc ||
          el.getAttribute("src") ||
          el.querySelector("source")?.getAttribute("src")
        : tag === "iframe"
          ? el.getAttribute("src")
          : "";
    const knownVideo =
      (tag === "video" &&
        mediaUrl &&
        /\.(mp4|webm|ogg)(?:[?#]|$)/i.test(mediaUrl)) ||
      (tag === "iframe" &&
        mediaUrl &&
        /^https:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/)/i.test(
          mediaUrl,
        ));
    if (
      ["iframe", "video", "canvas", "svg"].includes(tag) &&
      !artwork &&
      !knownVideo
    ) {
      warning.add(`${tag} content needs a manual editable replacement.`);
      return [];
    }
    const number = (v: string) =>
      Math.max(0, Math.min(200, parseFloat(v) || 0));
    // Typed OM retains authored auto/percent sizing; getComputedStyle resolves it
    // into pixels and would freeze responsive images at one captured viewport.
    const declared = (property: string) => {
      try { return String((el as any).computedStyleMap().get(property)); }
      catch { return ""; }
    };
    const declaredHeight = declared("height");
    const style: any = {
      widthPx: 0,
      heightAuto: true,
      aspectRatio: 0,
      display: s.display === "inline" ? "inline-block" :
        ["block", "flow-root", "inline-block", "flex", "inline-flex", "grid", "inline-grid"].includes(s.display) ? s.display : "block",
      // Widths below are already the browser's final (possibly shrunken)
      // widths. Applying flex shrink a second time distorts logos and cards.
      flexShrink: 0,
      float: ["left", "right"].includes(s.cssFloat) ? s.cssFloat : "none",
      clear: ["left", "right", "both"].includes(s.clear) ? s.clear : "none",
      verticalAlign: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super"].includes(s.verticalAlign) ? s.verticalAlign : "baseline",
      color: s.color,
      background: s.backgroundColor,
      fontFamily:
        s.fontFamily.length <= 1200 ? s.fontFamily : "Arial, sans-serif",
      fontSize: Math.max(0, Math.min(180, number(s.fontSize))),
      fontWeight: s.fontWeight,
      align: ["left", "center", "right"].includes(s.textAlign)
        ? s.textAlign
        : "left",
      padding: number(s.paddingTop),
      radius: Math.min(150, number(s.borderTopLeftRadius)),
      minHeight: Math.min(2500, parseFloat(s.minHeight) || 0),
      maxWidth: 10000,
      marginAuto: false,
      backgroundImage: "",
      left: 0,
      top: 0,
      overflow: "visible",
    };
    const box = (values: string[], signed = false) =>
      values.map((v) =>
        Math.max(signed ? -500 : 0, Math.min(500, parseFloat(v) || 0)),
      );
    style.paddingBox = box([
      s.paddingTop,
      s.paddingRight,
      s.paddingBottom,
      s.paddingLeft,
    ]);
    style.marginBox = box(
      [s.marginTop, s.marginRight, s.marginBottom, s.marginLeft],
      true,
    );
    style.lineHeightNormal = s.lineHeight === "normal";
    style.lineHeight = Number.isFinite(parseFloat(s.lineHeight))
      ? Math.min(300, Math.max(0, parseFloat(s.lineHeight))) : undefined;
    style.letterSpacing = Math.max(
      -20,
      Math.min(50, parseFloat(s.letterSpacing) || 0),
    );
    if (["cover", "contain", "fill"].includes(s.objectFit))
      style.objectFit = s.objectFit;
    const bg = s.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);
    if (bg) {
      style.backgroundImage = bg[1];
      style.backgroundPosition = s.backgroundPosition;
      style.backgroundSize = ["cover", "contain"].includes(s.backgroundSize)
        ? s.backgroundSize
        : "auto";
      style.minHeight = Math.min(2500, rect.height);
    } else if (s.backgroundImage !== "none")
      warning.add("Layered backgrounds and gradients need review.");
    if (
      [
        "flex-start",
        "center",
        "flex-end",
        "space-between",
        "space-around",
        "space-evenly",
      ].includes(s.justifyContent)
    )
      style.justify = s.justifyContent;
    const alignment = ({start:"flex-start",end:"flex-end"} as Record<string,string>)[s.alignItems] || s.alignItems;
    if (["flex-start", "center", "flex-end", "stretch"].includes(alignment))
      style.alignItems = alignment;
    style.wrap = s.flexWrap === "nowrap" ? "nowrap" : "wrap";
    const parentRect = el.parentElement?.getBoundingClientRect();
    const parentStyle = el.parentElement && getComputedStyle(el.parentElement);
    const contentWidth = parentRect
      ? parentRect.width -
        (parseFloat(parentStyle?.paddingLeft || "0") || 0) -
        (parseFloat(parentStyle?.paddingRight || "0") || 0) -
        (parseFloat(parentStyle?.borderLeftWidth || "0") || 0) -
        (parseFloat(parentStyle?.borderRightWidth || "0") || 0)
      : 0;
    if (contentWidth)
      style.width = Math.max(
        1,
        Math.min(300, (rect.width / contentWidth) * 100),
      );
    if (parentStyle?.display === "grid") style.width = 100;
    if (/^[0-9.]+px$/.test(declared("width")))
      style.widthPx = Math.min(10000, rect.width);
    if (/^[0-9.]+px$/.test(declaredHeight)) {
      style.height = Math.min(10000, rect.height);
      style.heightAuto = false;
    }
    if (s.maxWidth.endsWith("px") && parseFloat(s.maxWidth) > 0)
      style.maxWidth = Math.min(10000, parseFloat(s.maxWidth));
    style.position = ["relative", "absolute", "fixed", "sticky"].includes(
      s.position,
    )
      ? s.position
      : "static";
    if (s.position === "relative") {
      style.left = Math.max(-5000, Math.min(10000, parseFloat(s.left) || 0));
      style.top = Math.max(-5000, Math.min(10000, parseFloat(s.top) || 0));
    }
    if (["absolute", "fixed", "sticky"].includes(s.position)) {
      // Relative to the exported parent, whose box defines the native container.
      const origin =
        s.position === "fixed"
          ? { left: 0, top: 0 }
          : parentRect || { left: 0, top: 0 };
      style.left = Math.max(-5000, Math.min(10000, rect.left - origin.left));
      style.top = Math.max(-5000, Math.min(10000, rect.top - origin.top));
    }
    if (s.zIndex !== "auto")
      style.zIndex = Math.max(-100, Math.min(10000, parseInt(s.zIndex) || 0));
    if (["hidden", "auto", "clip"].includes(s.overflow))
      style.overflow = s.overflow;
    style.borderWidth = Math.min(50, parseFloat(s.borderTopWidth) || 0);
    style.borderWidths = [s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth].map(v=>Math.min(50,parseFloat(v)||0));
    style.borderColor = s.borderTopColor;
    style.borderStyle = [s.borderTopStyle,s.borderRightStyle,s.borderBottomStyle,s.borderLeftStyle].find(v=>["solid", "dashed", "dotted", "double"].includes(v)) || "none";
    if (
      ["none", "uppercase", "lowercase", "capitalize"].includes(s.textTransform)
    )
      style.textTransform = s.textTransform;
    const span = (s.gridColumnEnd + " " + s.gridColumnStart).match(
      /span\s+(\d+)/,
    );
    if (span) style.columnSpan = Math.min(24, Number(span[1]));
    else if (parentStyle?.display === "grid") {
      const tracks = parentStyle.gridTemplateColumns
        .split(/\s+/)
        .filter((v) => /^\d+(?:\.\d+)?px$/.test(v))
        .map(parseFloat);
      const gap = parseFloat(parentStyle.columnGap) || 0;
      // Computed grid lines can be numeric (1 / 13) or negative (1 / -1).
      // Measure the occupied tracks as a fallback for named grid areas.
      const line = (value: string) =>
        /^-?\d+$/.test(value)
          ? Number(value) < 0
            ? tracks.length + 2 + Number(value)
            : Number(value)
          : undefined;
      const start = line(s.gridColumnStart),
        end = line(s.gridColumnEnd);
      if (start !== undefined && end !== undefined && end > start)
        style.columnSpan = Math.min(24, end - start);
      else if (tracks.length) {
        let width = 0,
          best = 1,
          delta = Infinity;
        tracks.forEach((track, index) => {
          width += track + (index ? gap : 0);
          const distance = Math.abs(width - rect.width);
          if (distance < delta) {
            delta = distance;
            best = index + 1;
          }
        });
        style.columnSpan = best;
      }
    }
    if (rect.height === 0 && rect.width > 0) { style.height = 0; style.heightAuto = false; }
    if (tag === "img" && rect.height) {
      style.height = Math.min(10000, rect.height);
      style.heightAuto = false;
      if (declaredHeight === "auto" || declaredHeight.endsWith("%")) {
        style.aspectRatio = Math.min(100, rect.width / rect.height);
        style.heightAuto = true;
      }
      if (/^-?[0-9.]+(?:%|px) -?[0-9.]+(?:%|px)$/.test(s.objectPosition))
        style.objectPosition = s.objectPosition;
    }
    const lm = parseFloat(s.marginLeft) || 0,
      rm = parseFloat(s.marginRight) || 0;
    // Some browser snapshots resolve auto margins to zero despite a centered
    // block box. Preserve the measured centering only in normal block flow.
    const measuredLeft = parentRect
      ? rect.left -
        parentRect.left -
        (parseFloat(parentStyle?.paddingLeft || "0") || 0)
      : 0;
    const measuredRight = contentWidth - rect.width - measuredLeft;
    const centeredBlock =
      parentStyle &&
      !/flex|grid/.test(parentStyle.display) &&
      /^(block|flex|grid)$/.test(s.display) &&
      !["absolute", "fixed", "sticky"].includes(s.position) &&
      !style.left &&
      measuredLeft > 1 &&
      Math.abs(measuredLeft - measuredRight) < 2;
    if (
      (s.marginLeft === "auto" && s.marginRight === "auto") ||
      (lm > 1 && Math.abs(lm - rm) < 2) ||
      centeredBlock
    ) {
      style.marginAuto = true;
      style.marginBox[1] = 0;
      style.marginBox[3] = 0;
    }
    // A parallax/banner image becomes an editable container background.
    // This removes ratio spacers and transformed image wrappers from the export.
    const heroImage = /banner|hero/i.test(String(el.className))
      ? (el.querySelector("img") as HTMLImageElement | null)
      : null;
    const heroCaption =
      heroImage &&
      Array.from(el.children).find(
        (c) => /caption|content|text/i.test(c.className) && visibleText(c),
      );
    const isHero = Boolean(heroImage && heroCaption && rect.height > 200);
    const isMarquee =
      /marquee/i.test(el.className) &&
      !el.parentElement?.closest('[class*="marquee"]');
    const hasBoxedChildren = Array.from(el.children).some(c => {
      const st = getComputedStyle(c);
      if (st.display === "none" || st.visibility === "hidden") return false;
      return st.display !== "inline" ||
        [st.paddingTop, st.paddingRight, st.paddingBottom, st.paddingLeft,
          st.marginTop, st.marginBottom, st.borderTopWidth, st.borderBottomWidth]
          .some(v => Math.abs(parseFloat(v) || 0) > 0.5);
    });
    if (
      /box-ratio|aspect-ratio/i.test(el.className) &&
      el.querySelector("img")
    ) {
      // Preserve ratio padding as a responsive native aspect ratio.
      style.paddingBox = [0, 0, 0, 0];
      style.aspectRatio = Math.min(100, rect.width / rect.height);
      style.minHeight = 0;
      style.heightAuto = true;
      delete style.height;
    }
    let kind = "container";
    let text = "";
    let url = "";
    let alt = "";
    let children: any[] = [];
    let level;
    let disclosure = false;
    const interactionTarget = menuTargets.get(el);
    if (artwork) {
      kind = "image";
      url = artwork;
      alt =
        el.getAttribute("aria-label") ||
        el.querySelector("title")?.textContent ||
        "Captured artwork";
      warning.add(
        "SVG and CSS artwork are preserved as editable image widgets; shapes are rasterized.",
      );
    } else if (knownVideo) {
      kind = "video";
      url = new URL(mediaUrl!, location.href).href;
      warning.add(
        "Video source preserved in a native video widget. Media hosting and playback availability depend on the source.",
      );
    } else if (interactionTarget) {
      kind = "button";
      text = visibleText(el) || el.getAttribute("aria-label") || "Menu";
      url = "#";
    } else if (isSearchField) {
      kind = "search";
      // Do not copy a typed query or source-site form endpoint.
      text = (el.getAttribute("placeholder") || "Search").slice(0, 200);
      warning.add("Search becomes a local WordPress site search after import. Keep the Studio importer active. Source-specific product filters are not copied.");
    } else if (["input", "textarea", "select"].includes(tag)) {
      kind = "text";
      text =
        "[Form field: " +
        (el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          el.getAttribute("name") ||
          tag) +
        "]";
    } else if (tag === "details") {
      disclosure = true;
      const summary = el.querySelector("summary");
      const answer = Array.from(el.children)
        .filter((c) => c !== summary && !c.matches("script,style,noscript"))
        .map((c) => c.textContent || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      children = [
        {
          id: hashId(path + ":question"),
          kind: "button",
          text: summary?.textContent?.trim() || "Details",
          url: "#",
          style: {
            fontSize: style.fontSize,
            color: style.color,
            width: 100,
            paddingBox: [12, 0, 12, 0],
          },
          children: [],
        },
        {
          id: hashId(path + ":answer"),
          kind: "text",
          text: answer.slice(0, 12000),
          style: {
            fontSize: style.fontSize,
            color: style.color,
            width: 100,
            paddingBox: [12, 0, 12, 0],
          },
          children: [],
        },
      ];
      style.direction = "column";
    } else if (isHero && heroImage && heroCaption) {
      style.backgroundImage = heroImage.currentSrc || heroImage.src;
      style.backgroundSize = "cover";
      const imageStyle = getComputedStyle(heroImage);
      const imageRect = heroImage.getBoundingClientRect();
      const imageWidth = heroImage.clientWidth;
      const imageHeight = heroImage.clientHeight;
      if (
        imageWidth &&
        imageHeight &&
        heroImage.naturalWidth &&
        heroImage.naturalHeight
      ) {
        const fit = imageStyle.objectFit === "contain" ? Math.min : Math.max;
        const fittedWidth =
          heroImage.naturalWidth *
          fit(
            imageWidth / heroImage.naturalWidth,
            imageHeight / heroImage.naturalHeight,
          );
        const renderedWidth = fittedWidth * (imageRect.width / imageWidth);
        const renderedHeight =
          (renderedWidth * heroImage.naturalHeight) / heroImage.naturalWidth;
        style.backgroundWidth = Math.min(
          1000,
          (renderedWidth / rect.width) * 100,
        );
        const objectPosition = imageStyle.objectPosition.split(" ");
        const pos = (v: string | undefined) =>
          v?.endsWith("%") ? parseFloat(v) / 100 : 0.5;
        const x =
          imageRect.left -
          rect.left +
          (imageRect.width - renderedWidth) * pos(objectPosition[0]);
        const y =
          imageRect.top -
          rect.top +
          (imageRect.height - renderedHeight) * pos(objectPosition[1]);
        const percentage = (offset: number, space: number) =>
          Math.abs(space) > 1
            ? Math.max(-500, Math.min(500, (offset / space) * 100))
            : 50;
        style.backgroundPosition = `${percentage(x, rect.width - renderedWidth)}% ${percentage(y, rect.height - renderedHeight)}%`;
      } else
        style.backgroundPosition = imageStyle.objectPosition || "center center";
      style.minHeight = Math.min(2500, rect.height);
      style.paddingBox = [0, 0, 0, 0];
      style.direction = "column";
      style.justify = "center";
      style.alignItems = "center";
      children = read(
        heroCaption,
        path + "." + Array.from(el.children).indexOf(heroCaption),
        depth + 1,
      );
      children.forEach((c) => {
        c.style.position = "static";
        delete c.style.top;
        delete c.style.left;
        c.style.marginBox = [0, 0, 0, 0];
        c.style.paddingBox = [0, 0, 0, 0];
        c.style.width = 100;
      });
    } else if (isMarquee) {
      kind = "text";
      const items = Array.from(
        el.querySelectorAll(
          '[class*="text--item"], [class*="scrolling--text"]',
        ),
      )
        .filter((c) => !c.querySelector('[class*="scrolling--text"]'))
        .map(visibleText)
        .filter(Boolean);
      text = [...new Set(items.length ? items : [visibleText(el)])].join(
        "  •  ",
      );
      style.width = 100;
      style.align = "center";
      const textEl = el.querySelector('[class*="scrolling--text"]');
      if (textEl) {
        const ts = getComputedStyle(textEl);
        style.fontSize = Math.max(
          6,
          Math.min(180, parseFloat(ts.fontSize) || 16),
        );
        style.lineHeight = parseFloat(ts.lineHeight) || 24;
      }
      style.paddingBox = [20, 20, 20, 20];
    } else if (/^h[1-6]$/.test(tag)) {
      kind = "heading";
      text = visibleText(el);
      level = Number(tag[1]);
    } else if (tag === "img") {
      kind = "image";
      const img = el as HTMLImageElement;
      const candidates = [
        img.currentSrc,
        img.getAttribute("data-src"),
        (img.getAttribute("data-srcset") || img.getAttribute("srcset") || "")
          .split(",")[0]
          .trim()
          .split(/\s+/)[0],
        img.src,
      ];
      url =
        candidates.find((v) => v && !/^(data:|blob:|javascript:)/i.test(v)) ||
        "";
      alt = (el as HTMLImageElement).alt;
    } else if (
      (tag === "a" || tag === "button") &&
      !el.querySelector("img,picture,svg,div,h1,h2,h3,h4")
    ) {
      kind = "button";
      text = visibleText(el);
      url = (el as HTMLAnchorElement).href || "#";
    } else if (
      (["p", "li", "label"].includes(tag) &&
        !hasBoxedChildren && !el.querySelector("img,svg,div,ul,ol")) ||
      !el.children.length ||
      (!hasBoxedChildren && !el.querySelector("img,video,iframe,svg,input,textarea,select") &&
        Array.from(el.children).every(
          (c) => getComputedStyle(c).display === "inline",
        ))
    ) {
      kind = "text";
      text = visibleText(el);
    } else {
      if (s.display === "block" && rect.height > 0 && Array.from(el.children).some(c=>getComputedStyle(c).cssFloat !== "none"))
        style.display = "flow-root";
      if (style.position === "static") style.position = "relative";
      const childBoxes = Array.from(el.children)
        .filter((c) => {
          const st = getComputedStyle(c);
          const r = c.getBoundingClientRect();
          return (
            st.display !== "none" &&
            st.visibility !== "hidden" &&
            r.width > 1 &&
            r.height > 1 &&
            !["absolute", "fixed"].includes(st.position)
          );
        })
        .map((c) => c.getBoundingClientRect());
      // Preserve the slot reserved by pseudo-elements around absolute media.
      if (!childBoxes.length && rect.height > 1) {
        const before = getComputedStyle(el, "::before");
        const ratioSlot = before.content !== "none" && parseFloat(before.paddingTop) > 0;
        if (ratioSlot || (declaredHeight === "auto" && s.aspectRatio !== "auto")) {
          style.aspectRatio = Math.min(100, rect.width / rect.height);
          style.heightAuto = true;
        } else if (!style.aspectRatio) {
          style.minHeight = Math.max(style.minHeight || 0, Math.min(2500, rect.height));
        }
      }
      const horizontal = childBoxes.some((a, i) =>
        childBoxes
          .slice(i + 1)
          .some(
            (b) => Math.abs(a.top - b.top) < 8 && Math.abs(a.left - b.left) > 8,
          ),
      );
      style.direction = s.display.includes("flex")
        ? s.flexDirection
        : s.display === "grid" || horizontal
          ? "row"
          : "column";
      style.gap = number(s.columnGap);
      style.rowGap = number(s.rowGap);
      if (horizontal && !s.display.includes("flex")) style.wrap = "wrap";
      const tracks = s.gridTemplateColumns
        .split(/\s+/)
        .filter((v) => /^\d+(?:\.\d+)?px$/.test(v))
        .map(parseFloat);
      if (
        s.display === "grid" &&
        tracks.length &&
        tracks.length <= 24 &&
        tracks.every((v) => v > 0)
      ) {
        style.layout = "grid";
        style.columns = tracks;
      } else style.layout = "flex";
      children = Array.from(el.childNodes).flatMap((c, i) => {
        if (c.nodeType === Node.TEXT_NODE && c.textContent?.trim()) {
          if (count >= 3000) { nodeLimited = true; return []; }
          const id = hashId(path + ".text." + i);
          count++;
          const range = document.createRange();
          range.selectNode(c);
          // Anonymous text fragments have no comparable native element box.
          // Preserve their content but exclude them from element geometry metrics.
          return [
            {
              id,
              kind: "text",
              text: /^(pre|pre-wrap|pre-line|break-spaces)$/.test(s.whiteSpace)
                ? c.textContent
                : c.textContent.replace(/[ \t\r\n\f]+/g, " ").trim(),
              style: {
                fontFamily: s.fontFamily,
                fontSize: style.fontSize,
                fontWeight: s.fontWeight,
                color: s.color,
                align: style.align,
                lineHeight: style.lineHeight,
                paddingBox: [0, 0, 0, 0],
                marginBox: [0, 0, 0, 0],
                width: 100,
              },
              children: [],
            },
          ];
        }
        return c instanceof Element ? read(c, path + "." + i, depth + 1) : [];
      });
    }
    // Keep the outer line box. Taking the first child's line-height discarded
    // announcement-bar height and accumulated drift down product catalogues.
    if (["text", "heading", "button"].includes(kind) && el.children.length) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (
          !node.textContent?.trim() ||
          !parent ||
          parent.closest("svg,script,style")
        )
          continue;
        const r = parent.getBoundingClientRect(),
          ts = getComputedStyle(parent);
        if (
          !r.width ||
          !r.height ||
          ts.display === "none" ||
          ts.visibility === "hidden" ||
          ts.opacity === "0"
        )
          continue;
        style.color = ts.color;
        style.fontFamily =
          ts.fontFamily.length <= 1200 ? ts.fontFamily : "Arial, sans-serif";
        style.fontSize = Math.max(
          6,
          Math.min(180, parseFloat(ts.fontSize) || 16),
        );
        style.fontWeight = ts.fontWeight;
        if ((parseFloat(s.fontSize) || 0) < 1)
          { style.lineHeight = Math.min(300, parseFloat(ts.lineHeight) || 0) || undefined;
            style.lineHeightNormal = ts.lineHeight === "normal"; }
        if (["none", "uppercase", "lowercase", "capitalize"].includes(ts.textTransform))
          style.textTransform = ts.textTransform;
        style.letterSpacing = Math.max(
          -20,
          Math.min(50, parseFloat(ts.letterSpacing) || 0),
        );
        break;
      }
    }
    if (kind !== "container" && kind !== "image" && declared("width") === "auto" &&
        (/^inline/.test(s.display) || (parentStyle?.display.includes("flex") && s.flexGrow === "0" && s.flexBasis === "auto")))
      style.widthPx = Math.min(10000, rect.width);
    if (kind === "text" && s.display === "inline") {
      if (
        parentStyle &&
        ["left", "center", "right"].includes(parentStyle.textAlign)
      )
        style.align = parentStyle.textAlign;
    }
    if (clipped && !children.length) {
      clippedCount++;
      return [];
    }
    if (
      kind === "text" &&
      !text &&
      ["div", "section", "hr"].includes(tag) &&
      rect.width >= 8 &&
      (rect.height >= 8 || style.marginBox.some((v:number)=>v!==0))
    ) {
      kind = "container";
      style.minHeight = Math.min(2500, rect.height);
    }
    if (
      (kind === "container" && !children.length && !style.minHeight && style.height === undefined && !style.marginBox.some((v:number)=>v!==0)) ||
      (kind !== "container" && kind !== "image" && kind !== "video" && !text)
    )
      return [];
    let capturedRuns =
      ["heading", "text"].includes(kind) &&
      !["input", "textarea", "select"].includes(tag) &&
      !isMarquee
        ? inlineRuns(el)
        : undefined;
    if (capturedRuns) {
      const value = capturedRuns.map((r) => r.text).join("");
      if (value.length <= 12000) text = value;
      else capturedRuns = undefined;
    }
    count++;
    if (!clipped) recordBox(hashId(path), rect);
    let hash = 2166136261;
    for (const c of path) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    return [
      {
        id: (hash >>> 0).toString(16).padStart(8, "0"),
        kind,
        text: text.slice(0, 12000),
        ...(capturedRuns ? { runs: capturedRuns } : {}),
        ...(tag === "a" && kind === "container"
          ? { link: (el as HTMLAnchorElement).href }
          : {}),
        url,
        alt: alt.slice(0, 500),
        level,
        ...(kind === "container" && (tag === "header" || tag === "footer")
          ? { region: tag }
          : {}),
        ...(kind === "container" &&
        el.querySelector('a[href*="/products/"],a[href*="/product/"]') &&
        el.querySelector("img") &&
        /(?:product[-_](?:card|item|index)|card-wrapper|productitem|product-loop__item)/i.test(
          el.className,
        ) &&
        !el.parentElement?.closest(
          '[class*="product-card"],[class*="product-item"],[class*="product-index"],.card-wrapper,.product-loop__item',
        )
          ? { product: true }
          : {}),
        ...(disclosure ? { disclosure: true } : {}),
        ...(interactionTarget
          ? { interaction: { action: "toggle", target: interactionTarget.id } }
          : {}),
        style,
        children,
      },
    ];
  };
  const nodes = read(document.body, "body", 0);
  nodes.push(...panels);
  if (
    document.querySelector(
      'input[name="sort_by"],select[name="sort_by"],[data-wau-slideout-target="collection-filters"]',
    )
  )
    warning.add(
      "Product cards are captured as editable content. Optional local product tools add search, sorting and quick preview; live catalogue filters, inventory and checkout require a store connection.",
    );
  if (
    document.querySelector(
      'form[action*="/cart"],[data-wau-slideout-target="ajax-cart"]',
    )
  )
    warning.add(
      "Cart and checkout require a connected store; no cart backend is included.",
    );
  if (nodeLimited)
    warning.add(
      "Capture limited to 3,000 elements; long-page content may be incomplete.",
    );
  if (clippedCount)
    warning.add(
      "Off-canvas and slider copies outside clipped areas were omitted. Only the visible slider/scroll state is captured; review interactive sections.",
    );
  if (depthLimited)
    warning.add(
      "Capture depth limit reached; deeply nested content may be incomplete.",
    );
  const imageDiagnostics = Array.from(document.images)
    .slice(0, 3)
    .map((img) => ({
      src: img.currentSrc,
      lazy: img.getAttribute("data-srcset"),
      chain: [img, img.parentElement, img.parentElement?.parentElement]
        .filter(Boolean)
        .map((el) => {
          const st = getComputedStyle(el!);
          const r = el!.getBoundingClientRect();
          return {
            tag: el!.tagName,
            cls: el!.className,
            display: st.display,
            visibility: st.visibility,
            opacity: st.opacity,
            width: r.width,
            height: r.height,
          };
        }),
    }));
  const usedFamilies = new Set<string>();
  const collectFamilies = (items: any[]) => items.forEach(n => {
    (n.style.fontFamily || "").split(",").forEach((f: string) => usedFamilies.add(f.trim().replace(/^["']|["']$/g,"")));
    collectFamilies(n.children);
  });
  collectFamilies(nodes);
  const fontFaces: {family:string;url:string;weight:string;style:"normal"|"italic"|"oblique"}[] = [];
  const visitRules = (rules: CSSRuleList, base: string) => {
    for (const rule of Array.from(rules)) {
      if (fontFaces.length >= 24) break;
      if (rule instanceof CSSFontFaceRule) {
        const family = rule.style.fontFamily.replace(/^["']|["']$/g, "");
        const src = rule.style.getPropertyValue("src").match(/url\(["']?([^"')]+)["']?\)/);
        const weight = rule.style.fontWeight === "normal" ? "400" : rule.style.fontWeight === "bold" ? "700" : rule.style.fontWeight;
        const style = rule.style.fontStyle || "normal";
        if (!usedFamilies.has(family) || !src || !/^[\p{L}\p{N}][\p{L}\p{N} .+_*-]{0,99}$/u.test(family)) continue;
        try {
          const url = new URL(src[1],base).href;
          if (!/^https?:\/\/[^\s"'<>\\(){}]+$/.test(url) || !/^(?:[1-9]\d{0,2}|1000)(?: (?:[1-9]\d{0,2}|1000))?$/.test(weight) || !["normal","italic","oblique"].includes(style)) continue;
          if (!fontFaces.some(f => f.family===family && f.weight===weight && f.style===style)) fontFaces.push({family,url,weight,style:style as "normal"|"italic"|"oblique"});
        } catch {}
      } else if ("cssRules" in rule) {
        try { visitRules((rule as CSSGroupingRule).cssRules,base); } catch {}
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try { visitRules(sheet.cssRules,sheet.href || document.baseURI); } catch {}
  }
  return {
    fontFaces,
    nodes,
    warnings: Array.from(warning),
    title: document.title,
    complete: !nodeLimited && !depthLimited,
    imageDiagnostics,
    geometry,
    viewport: { width: innerWidth, height: innerHeight, scrollY },
  };
}
