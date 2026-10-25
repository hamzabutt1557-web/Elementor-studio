"use client";
import {
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  MousePointer2,
  ListOrdered,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { requestJson } from "@/lib/client-api";
import { replaceText } from "@/lib/text-format";
import { viewportWidth } from "@/lib/viewports";
import FontPicker from "./font-picker";
import TextEditor from "./text-editor";
import { isUpload } from "@/lib/uploaded-assets";
import { createShareLink } from "@/lib/share-link";
import {
  editTree,
  moveNode,
  addSection,
  addWidget,
  type TreeAction,
} from "@/lib/editor-tree";
import type { Design, DesignNode, Style } from "@/lib/design";

type Props = {
  design: Design;
  preview: string;
  screenshot: string;
  initialCompare?: boolean;
  onClose: () => void;
  onSave: (design: Design, preview: string) => void;
};
function flatten(nodes: DesignNode[]): DesignNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}
function update(
  nodes: DesignNode[],
  id: string,
  patch: Partial<DesignNode>,
): DesignNode[] {
  return nodes.map((n) =>
    n.id === id
      ? { ...n, ...patch }
      : { ...n, children: update(n.children, id, patch) },
  );
}
export default function LiveWorkspace({
  design,
  preview,
  screenshot,
  initialCompare = false,
  onClose,
  onSave,
}: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [share, setShare] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const inspector = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState(design);
  const [html, setHtml] = useState(preview);
  const [selected, setSelected] = useState("");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );
  const [zoom, setZoom] = useState(50);
  const [fit, setFit] = useState(true);
  const outputPane = useRef<HTMLDivElement>(null);
  const [sourceRevision, setSourceRevision] = useState(0);
  const [original, setOriginal] = useState(
    screenshot ? "capture" : "live",
  );
  const [showOriginal, setShowOriginal] = useState(initialCompare);
  const [measuring, setMeasuring] = useState(false);
  const [measure, setMeasure] = useState<{
    width: number;
    height: number;
    x: number;
    y: number;
    padding: number[];
    margin: number[];
    parent: { top: number; right: number; bottom: number; left: number } | null;
    reference: {
      id: string;
      horizontal: number;
      vertical: number;
      deltaX: number;
      deltaY: number;
    } | null;
  }>();
  const [freeMove, setFreeMove] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [snap, setSnap] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(true);
  const [inlineEditing, setInlineEditing] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [layerQuery, setLayerQuery] = useState("");
  const [collapsedLayers, setCollapsedLayers] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Design[]>([]);
  const revision = useRef(0);
  const nodes = useMemo(() => flatten(draft.nodes), [draft]);
  const node = nodes.find((n) => n.id === selected);
  const width = viewportWidth(device);
  const source = /^https?:\/\//.test(design.source) ? design.source : "";
  useEffect(() => {
    if (!fit || !outputPane.current) return;
    const el = outputPane.current;
    const measure = () =>
      setZoom(
        Math.max(
          5,
          Math.min(100, Math.floor(((el.clientWidth - 24) / width) * 100)),
        ),
      );
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [fit, width, showOriginal, inspectorOpen, measuring]);
  useEffect(() => {
    inspector.current?.scrollTo({ top: 0 });
  }, [selected]);
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null;
    const el = dialog.current;
    el?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      revision.current++;
      document.body.style.overflow = old;
      el?.close();
      focus?.focus();
    };
  }, []);
  async function render(next: Design, remember = true) {
    const version = ++revision.current;
    const previous = draft;
    setDraft(next);
    setPending(true);
    setError("");

    try {
      const data = await requestJson<{ preview: string }>("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design: next, editable: true }),
      });
      if (version === revision.current) {
        if (remember) setHistory((prev) => [...prev.slice(-19), previous]);
        else setHistory((prev) => prev.slice(0, -1));
        setHtml(data.preview);
        setInlineEditing(false);
        onSave(next, data.preview);
      }
    } catch (e) {
      if (version === revision.current) {
        setDraft(previous);
        setError(
          (e as Error).message.includes("valid editable draft")
            ? "That value is outside the allowed range. Your last saved design is safe."
            : "Change was not saved. " + (e as Error).message,
        );
      }
    } finally {
      if (version === revision.current) setPending(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ preview: string }>("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design, editable: true }),
      signal: controller.signal,
    })
      .then((data) => {
        if (
          !controller.signal.aborted &&
          data.preview &&
          revision.current === 0
        )
          setHtml(data.preview);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Preview could not be loaded.",
          );
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const send = () =>
      frame.current?.contentWindow?.postMessage(
        {
          type: "estudio-edit-mode",
          enabled: editing,
          busy: pending || uploading,
          freeMove,
          ids: selectedIds.includes(selected)
            ? selectedIds
            : selected
              ? [selected]
              : [],
          snap,
          zoom: zoom / 100,
          measuring,
          id: selected,
        },
        "*",
      );
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "estudio-preview-ready") send();
      const textNode = nodes.find(
        (n) =>
          n.id === event.data?.id &&
          (n.kind === "heading" || n.kind === "text"),
      );
      if (textNode && event.data?.type === "estudio-text-start") {
        setSelected(textNode.id);
        setSelectedIds([textNode.id]);
        setInlineEditing(true);
      }
      if (event.data?.type === "estudio-text-cancel") setInlineEditing(false);
      if (textNode && event.data?.type === "estudio-text-save") {
        setInlineEditing(false);
        if (
          !pending &&
          typeof event.data.text === "string" &&
          event.data.text.length <= 12000 &&
          event.data.text !== textNode.text
        ) {
          const text = event.data.text;
          void render({
            ...draft,
            nodes: update(draft.nodes, textNode.id, {
              text,
              runs: replaceText(textNode.text || "", text, textNode.runs),
            }),
          });
        }
      }
      if (
        editing &&
        !pending &&
        !uploading &&
        nodes.some((n) => n.id === event.data?.id)
      ) {
        try {
          if (
            event.data.type === "estudio-drop" &&
            ["before", "after", "inside"].includes(event.data.placement)
          )
            void render(
              moveNode(
                draft,
                event.data.id,
                event.data.target,
                event.data.placement,
              ),
            );
          if (
            event.data.type === "estudio-transforms" &&
            Array.isArray(event.data.changes)
          ) {
            const key = device === "desktop" ? "style" : device;
            let nextNodes = draft.nodes;
            for (const change of event.data.changes.slice(0, 1200)) {
              const item = nodes.find((n) => n.id === change.id);
              if (!item) continue;
              const allowed = [
                "width",
                "height",
                "minHeight",
                "maxWidth",
                "position",
                "left",
                "top",
              ];
              const changes = Object.fromEntries(
                Object.entries(change.style || {}).filter(([k]) =>
                  allowed.includes(k),
                ),
              );
              const inherited = {
                ...item.style,
                ...(device !== "desktop" ? item.tablet : {}),
                ...(device === "mobile" ? item.mobile : {}),
              };
              nextNodes = update(nextNodes, item.id, {
                [key]: {
                  ...item[key],
                  ...(changes.position === "relative" && inherited.marginBox
                    ? { marginBox: inherited.marginBox }
                    : {}),
                  ...changes,
                },
              });
            }
            void render({ ...draft, nodes: nextNodes });
          }
        } catch (e) {
          setError((e as Error).message);
        }
      }
      if ((editing || measuring) && event.data?.type === "estudio-select") {
        const ids = (
          Array.isArray(event.data.ids) ? event.data.ids : [event.data.id]
        ).filter((id: unknown) => nodes.some((n) => n.id === id));
        setSelectedIds(ids);
        setSelected(
          ids.includes(event.data.id) ? event.data.id : ids.at(-1) || "",
        );
      }
      if (
        measuring &&
        event.data?.type === "estudio-measure" &&
        nodes.some((n) => n.id === event.data.id)
      ) {
        setMeasure(event.data.metrics);
      }
    };
    window.addEventListener("message", receive);
    send();
    return () => window.removeEventListener("message", receive);
  }, [
    editing,
    measuring,
    selected,
    selectedIds,
    snap,
    zoom,
    nodes,
    html,
    pending,
    uploading,
    freeMove,
    device,
    draft,
  ]);
  function treeAction(action: TreeAction) {
    if (!node) return;
    try {
      void render(editTree(draft, node.id, action));
      if (action === "delete") setSelected("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function sharePage() {
    try {
      const url = await createShareLink(draft);
      setShare(url);
      try {
        await navigator.clipboard.writeText(url);
      } catch {}
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function patch(value: Partial<DesignNode>) {
    if (node)
      void render({ ...draft, nodes: update(draft.nodes, node.id, value) });
  }
  function style(key: keyof Style, value: string) {
    if (!node) return;
    const target = device === "desktop" ? "style" : device;
    const next = { ...node[target] };
    if (value === "") delete next[key];
    else
      Object.assign(next, {
        [key]: [
          "color",
          "background",
          "fontFamily",
          "fontWeight",
          "align",
          "direction",
          "justify",
          "alignItems",
          "objectFit",
          "backgroundImage",
          "backgroundSize",
        ].includes(key)
          ? value
          : Number(value),
      });
    if (key === "backgroundSize") delete next.backgroundWidth;
    if (key === "padding") {
      if (value === "") delete next.paddingBox;
      else
        next.paddingBox = [
          Number(value),
          Number(value),
          Number(value),
          Number(value),
        ];
    }
    if (JSON.stringify(next) === JSON.stringify(node[target] || {})) return;
    patch({ [target]: next });
  }
  const computedStyle = node
    ? {
        ...node.style,
        ...(device !== "desktop" ? node.tablet : {}),
        ...(device === "mobile" ? node.mobile : {}),
      }
    : {};
  function boxSide(
    key: "paddingBox" | "marginBox",
    index: number,
    value: string,
  ) {
    if (!node || value === "") return;
    const target = device === "desktop" ? "style" : device;
    const box = [...(computedStyle[key] || [0, 0, 0, 0])] as [
      number,
      number,
      number,
      number,
    ];
    box[index] = Number(value);
    patch({ [target]: { ...node[target], [key]: box } });
  }
  async function uploadImage(file?: File) {
    if (!file || !node || pending || uploading) return;
    if (
      file.size > 2000000 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Choose a JPG, PNG or WebP image under 2 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read image."));
        reader.readAsDataURL(file);
      });
      const result = await requestJson<{ url: string; data: string }>(
        "/api/image",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        },
      );
      const key = device === "desktop" ? "style" : device;
      const value: Partial<DesignNode> =
        node.kind === "image"
          ? { url: result.url, alt: file.name.replace(/\.[^.]+$/, "") }
          : {
              [key]: {
                ...node[key],
                backgroundImage: result.url,
                backgroundSize: "cover",
              },
            };
      const next = {
        ...draft,
        assets: { ...draft.assets, [result.url]: result.data },
        nodes: update(draft.nodes, node.id, value),
      };
      const used = new Set<string>();
      flatten(next.nodes).forEach((n) => {
        if (n.url) used.add(n.url);
        [n.style, n.tablet, n.mobile].forEach((st) => {
          if (st?.backgroundImage) used.add(st.backgroundImage);
        });
      });
      next.assets = Object.fromEntries(
        Object.entries(next.assets).filter(([url]) => used.has(url)),
      );
      await render(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  function selectParent() {
    const parent = nodes.find((n) => n.children.some((c) => c.id === selected));
    if (parent) setSelected(parent.id);
  }
  function renderLayerNodes(items: DesignNode[], depth = 0): ReactNode[] {
    const query = layerQuery.trim().toLowerCase();
    return items.flatMap((item) => {
      const matches = !query || `${item.kind} ${item.text || ""} ${item.alt || ""}`.toLowerCase().includes(query);
      const childMatches = (children: DesignNode[]): boolean => children.some((child) =>
        `${child.kind} ${child.text || ""} ${child.alt || ""}`.toLowerCase().includes(query) || childMatches(child.children),
      );
      if (query && !matches && !childMatches(item.children)) return [];
      const expanded = query.length > 0 || !collapsedLayers.includes(item.id);
      const effectiveStyle = {
        ...item.style,
        ...(device !== "desktop" ? item.tablet : {}),
        ...(device === "mobile" ? item.mobile : {}),
      };
      const hidden = effectiveStyle.hidden === true;
      const select = () => {
        setSelected(item.id);
        setSelectedIds([item.id]);
      };
      const row = (
        <div className={"layer-row" + (selected === item.id ? " selected" : "")} key={item.id} style={{ paddingInlineStart: 6 + depth * 14 }}>
          {item.children.length > 0 ? (
            <button className="layer-chevron" type="button" aria-label={(expanded ? "Collapse " : "Expand ") + item.kind} onClick={() => setCollapsedLayers((old) => expanded ? [...new Set([...old, item.id])] : old.filter((id) => id !== item.id))}>
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span className="layer-spacer" />}
          <button className="layer-name" type="button" onClick={select} title={item.text || item.alt || item.kind}>
            <span className="layer-kind">{item.kind === "container" ? "▱" : item.kind === "image" ? "▧" : item.kind === "button" ? "▰" : "T"}</span>
            <span>{item.kind === "container" ? item.region === "header" ? "Header section" : item.region === "footer" ? "Footer section" : "Section" : (item.text || item.alt || item.kind).replace(/\s+/g, " ").slice(0, 34)}</span>
          </button>
          <button className="layer-visibility" type="button" aria-label={(hidden ? "Show " : "Hide ") + (item.text || item.kind)} title={hidden ? "Show layer" : "Hide layer"} onClick={() => {
            const target = device === "desktop" ? "style" : device;
            const nextStyle = { ...(item[target] || {}), hidden: !hidden };
            void render({ ...draft, nodes: update(draft.nodes, item.id, { [target]: nextStyle }) });
          }}>{hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
        </div>
      );
      return expanded ? [row, ...renderLayerNodes(item.children, depth + 1)] : [row];
    });
  }
  return (
    <dialog
      ref={dialog}
      className={"live-workspace" + (showOriginal ? " split-comparison" : "")}
      onCancel={(e) => {
        if (pending || uploading) e.preventDefault();
        else onClose();
      }}
      aria-labelledby="live-title"
    >
      <header className="live-toolbar">
        <strong id="live-title">
          <span className="studio-live-dot" />{" "}
          {showOriginal ? "Compare preview" : "Live canvas"}
        </strong>
        {(source || screenshot) && (
          <button
            aria-pressed={showOriginal}
            onClick={() => setShowOriginal((v) => !v)}
          >
            Compare original
          </button>
        )}
        <button disabled={pending || uploading} onClick={sharePage}>
          Share preview
        </button>
        <button
          aria-pressed={measuring}
          onClick={() => setMeasuring((v) => !v)}
        >
          Measurements
        </button>
        <label>
          Device{" "}
          <select
            value={device}
            onChange={(e) =>
              setDevice(e.target.value as "desktop" | "tablet" | "mobile")
            }
          >
            <option value="desktop">Desktop</option>
            <option value="tablet">Tablet</option>
            <option value="mobile">Mobile</option>
          </select>
        </label>
        <label>
          Zoom{" "}
          <select
            value={zoom}
            onChange={(e) => {
              setFit(false);
              setZoom(Number(e.target.value));
            }}
          >
            {[...new Set([zoom, 10, 25, 50, 75, 100, 125])]
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  {n}%
                </option>
              ))}
          </select>
        </label>
        <button aria-pressed={fit} onClick={() => setFit(true)}>
          Fit both panes
        </button>
        <button
          onClick={() => {
            setEditing(true);
            setInspectorOpen(true);
            setInlineEditing(false);
            const target =
              node && ["heading", "text"].includes(node.kind)
                ? node
                : nodes.find((n) => n.kind === "heading" || n.kind === "text");
            if (target) {
              setSelected(target.id);
              setSelectedIds([target.id]);
            }
            requestAnimationFrame(() =>
              inspector.current?.scrollTo({ top: 0 }),
            );
          }}
          disabled={
            !nodes.some((n) => n.kind === "heading" || n.kind === "text")
          }
        >
          Text editor
        </button>
        <button
          onClick={() => setInspectorOpen((v) => !v)}
          aria-pressed={inspectorOpen}
        >
          {inspectorOpen ? "Hide inspector" : "Design inspector"}
        </button>
        <button
          disabled={!history.length || pending || uploading}
          onClick={() => {
            const previous = history[history.length - 1];
            void render(previous, false);
          }}
        >
          Undo
        </button>
        <button
          onClick={() => {
            const el = dialog.current;
            if (document.fullscreenElement)
              void document
                .exitFullscreen()
                .catch(() => setError("Fullscreen is unavailable."));
            else
              void el
                ?.requestFullscreen?.()
                .catch(() => setError("Fullscreen is unavailable."));
          }}
        >
          Fullscreen
        </button>
        <button
          disabled={pending || uploading}
          onClick={onClose}
          aria-label="Close live preview"
        >
          Close ×
        </button>
      </header>
      {editing && (
        <div className="canvas-command-bar" aria-label="Canvas tools">
          <div
            className="canvas-mode-switch"
            role="group"
            aria-label="Drag mode"
          >
            <button
              disabled={pending || uploading}
              aria-pressed={freeMove}
              onClick={() => setFreeMove(true)}
            >
              <MousePointer2 size={16} />
              Select & move
            </button>
            <button
              disabled={pending || uploading}
              aria-pressed={!freeMove}
              onClick={() => setFreeMove(false)}
            >
              <ListOrdered size={16} />
              Reorder
            </button>
          </div>
          <div
            className="canvas-align-buttons"
            role="group"
            aria-label="Align elements"
          >
            {(
              [
                ["left", "Left", AlignHorizontalJustifyStart],
                ["center", "Center", AlignHorizontalJustifyCenter],
                ["right", "Right", AlignHorizontalJustifyEnd],
                ["top", "Top", AlignVerticalJustifyStart],
                ["middle", "Middle", AlignVerticalJustifyCenter],
                ["bottom", "Bottom", AlignVerticalJustifyEnd],
              ] as const
            ).map(([action, label, Icon]) => (
              <button
                key={action}
                title={"Align " + label.toLowerCase()}
                aria-label={"Align " + label.toLowerCase()}
                disabled={!selected || pending || uploading}
                onClick={() =>
                  frame.current?.contentWindow?.postMessage(
                    { type: "estudio-align", action },
                    "*",
                  )
                }
              >
                <Icon size={17} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <label className="canvas-snap">
            <input
              type="checkbox"
              checked={snap}
              onChange={(e) => setSnap(e.target.checked)}
            />
            Snap 8px
          </label>
          <span className="canvas-selection-note">
            {selectedIds.includes(selected) && selectedIds.length > 1
              ? selectedIds.length + " selected · align together"
              : selected
                ? "1 selected · align to section"
                : "Click to select · Shift + click for multiple"}
          </span>
        </div>
      )}
      {inlineEditing && (
        <div className="inline-edit-notice" role="status">
          Editing text · click outside to save · Ctrl / ⌘ + Enter to apply · Esc
          to cancel
        </div>
      )}
      <div className="live-status" role="status">
        {error ||
          (uploading
            ? "Preparing image…"
            : pending
              ? "Updating preview…"
              : history.length
                ? "Changes saved to this draft. JSON and ZIP include your edits."
                : "Double-click text to edit · drag to move · use handles to resize.")}
      </div>
      {share && (
        <div className="share-result">
          <label>
            Client preview link
            <input readOnly value={share} onFocus={(e) => e.target.select()} />
          </label>
          <a href={share} target="_blank" rel="noreferrer">
            Open shared preview ↗
          </a>
          <span>
            Snapshot of this version. Create a new link after editing. Anyone
            with this link can view it.
          </span>
        </div>
      )}
      <div
        className={
          "live-body" +
          (inlineEditing ? " inline-editing" : "") +
          (inspectorOpen || measuring ? " with-editor" : "") +
          (!showOriginal || (!source && !screenshot) ? " solo-preview" : "")
        }
      >
        {showOriginal && (source || screenshot) && (
          <>
            <section className="live-pane">
              <div className="live-pane-bar">
                <b>Original</b>
                {original === "live" && (
                  <button onClick={() => setSourceRevision((v) => v + 1)}>
                    Refresh original
                  </button>
                )}
                <select
                  aria-label="Original preview mode"
                  value={original}
                  onChange={(e) => setOriginal(e.target.value)}
                >
                  <option value="capture">Captured original</option>
                  {source && <option value="live">Live website</option>}
                </select>
                {source && (
                  <a href={source} target="_blank" rel="noreferrer">
                    Open original ↗
                  </a>
                )}
              </div>
              {original === "live" && (
                <p className="live-note">
                  Some websites block embedding. If blank or refused, use Open
                  original or Captured reference. Login and shopping are
                  disabled here.
                </p>
              )}
              {original === "capture" && (
                <p className="live-note">
                  Captured desktop reference · 1440px · may show only the top viewport.
                </p>
              )}
              <div className="live-scroll">
                <div
                  style={{
                    width: (width * zoom) / 100,
                    height: (1000 * zoom) / 100,
                  }}
                >
                  {original === "live" ? (
                    <iframe
                      key={sourceRevision}
                      title="Original live website"
                      src={source}
                      sandbox="allow-scripts"
                      referrerPolicy="no-referrer"
                      style={{
                        width,
                        height: 1000,
                        transform: `scale(${zoom / 100})`,
                        transformOrigin: "top left",
                      }}
                    />
                  ) : screenshot ? (
                    <img
                      src={screenshot}
                      alt="Captured desktop reference — not a live website"
                      style={{ width: (1440 * zoom) / 100, maxWidth: "none" }}
                    />
                  ) : (
                    <p>
                      No screenshot exists for a brief. Review the generated
                      page.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
        <section className="live-pane">
          <div className="live-pane-bar">
            <b>Our output</b>
            <span>
              Interactive · {device} · {width}px
            </span>
          </div>
          {showOriginal && (
            <p className="live-note">
              Editable output · changes update here after saving. Both live
              panes use the same viewport and zoom.
            </p>
          )}
          <div className="live-scroll" ref={outputPane}>
            <div
              style={{
                width: (width * zoom) / 100,
                height: (1000 * zoom) / 100,
              }}
            >
              <iframe
                ref={frame}
                title="Live generated output"
                srcDoc={html}
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
                style={{
                  width,
                  height: 1000,
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          </div>
        </section>
        {(inspectorOpen || measuring) && (
          <aside
            ref={inspector}
            className="live-editor"
            aria-label="Element editor"
          >
            <div className="inspector-heading">
              <span className="inspector-dot" />
              <h3>{measuring ? "Measure & edit" : "Design inspector"}</h3>
              <button
                type="button"
                aria-label="Close inspector"
                onClick={() => {
                  setInspectorOpen(false);
                  setMeasuring(false);
                }}
              >
                ×
              </button>
            </div>
            <p className="editor-shortcut">
              Double-click text to type directly. Click outside to save. Esc
              cancels.
            </p>
            <section className="layers-panel" aria-label="Page layers">
              <div className="layers-title"><b>Layers</b><span>{nodes.length} elements</span></div>
              <input aria-label="Search layers" className="layer-search" value={layerQuery} onChange={(e) => setLayerQuery(e.target.value)} placeholder="Find a section or element" />
              <div className="layer-list">{renderLayerNodes(draft.nodes)}</div>
              <small>Choose an item to edit. Use the eye to hide it at the current screen size.</small>
            </section>
            <label>
              Select text to edit
              <select
                aria-label="Select text to edit"
                value={
                  node && ["heading", "text"].includes(node.kind)
                    ? selected
                    : ""
                }
                onChange={(e) => {
                  setSelected(e.target.value);
                  setSelectedIds(e.target.value ? [e.target.value] : []);
                }}
              >
                <option value="">
                  Click text in the preview or choose here
                </option>
                {nodes
                  .filter((n) => n.kind === "heading" || n.kind === "text")
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.kind}: {(n.text || n.id).slice(0, 65)}
                    </option>
                  ))}
              </select>
            </label>
            {node && (node.kind === "heading" || node.kind === "text") ? (
              <fieldset
                disabled={pending || uploading}
                className="element-fields text-fields"
              >
                <TextEditor key={node.id} node={node} onSave={patch} />
                <FontPicker
                  value={computedStyle.fontFamily || ""}
                  onChange={(value) => style("fontFamily", value)}
                />
              </fieldset>
            ) : (
              <p className="editor-hint">
                Choose a heading or paragraph above to change its text and font.
              </p>
            )}
            {measuring && (
              <div className="measure-panel">
                <p>
                  Click an element. Shift + click another to measure the gap.
                  Values are CSS pixels before preview zoom.
                </p>
                {measure && (
                  <>
                    <b>
                      {measure.width} × {measure.height} px
                    </b>
                    <p>
                      Page position: X {measure.x} / Y {measure.y}
                    </p>
                    <p>
                      Padding T / R / B / L<br />
                      {measure.padding.join(" / ")} px
                    </p>
                    <p>
                      Margin T / R / B / L<br />
                      {measure.margin.join(" / ")} px
                    </p>
                    {measure.parent && (
                      <p>
                        Distance from parent edges T / R / B / L<br />
                        {[
                          measure.parent.top,
                          measure.parent.right,
                          measure.parent.bottom,
                          measure.parent.left,
                        ].join(" / ")}{" "}
                        px
                      </p>
                    )}
                    {measure.reference && (
                      <p>
                        Gap to second element: X {measure.reference.horizontal}{" "}
                        / Y {measure.reference.vertical} px
                        <br />
                        Position difference: X {measure.reference.deltaX} / Y{" "}
                        {measure.reference.deltaY} px
                        <br />A zero gap means their boxes overlap on that axis.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            <p>
              Drag an element directly to move it. Shift + click selects
              multiple elements. Use the corner handles to resize. Arrow keys
              nudge 1px; Shift + arrow nudges 10px. Reorder moves elements
              between sections. Review each device before export.
            </p>
            <button
              disabled={pending || uploading}
              onClick={() => void render(addSection(draft))}
            >
              Add page section
            </button>
            {node && (
              <div className="tree-controls">
                <button onClick={selectParent}>Select parent section</button>
                <button
                  disabled={pending || uploading}
                  onClick={() => treeAction("up")}
                >
                  Move up
                </button>
                <button
                  disabled={pending || uploading}
                  onClick={() => treeAction("down")}
                >
                  Move down
                </button>
                <button
                  disabled={pending || uploading}
                  onClick={() => treeAction("duplicate")}
                >
                  Duplicate
                </button>
                <button
                  disabled={pending || uploading}
                  onClick={() => treeAction("delete")}
                >
                  Delete
                </button>
                {node.kind === "container" && (
                  <>
                    <button
                      disabled={pending || uploading}
                      onClick={() => void render(addSection(draft, node.id))}
                    >
                      Add inside section
                    </button>
                    {(["heading", "text", "button", "image", "search"] as const).map(
                      (kind) => (
                        <button
                          key={kind}
                          disabled={pending || uploading}
                          onClick={() => {
                            const next = addWidget(draft, node.id, kind);
                            const added = flatten(next.nodes).find(
                              (n) => !nodes.some((old) => old.id === n.id),
                            );
                            if (added) setSelected(added.id);
                            void render(next);
                          }}
                        >
                          Add {kind}
                        </button>
                      ),
                    )}
                  </>
                )}
              </div>
            )}
            <label>
              Element
              <select
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setSelectedIds(e.target.value ? [e.target.value] : []);
                }}
              >
                <option value="">Choose an element</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.kind}: {(n.text || n.alt || n.id).slice(0, 65)}
                  </option>
                ))}
              </select>
            </label>
            {node && (
              <fieldset
                disabled={pending || uploading}
                className="element-fields"
                key={node.id + device + JSON.stringify(node)}
              >
                <p>
                  Layout changes apply to {device}. Content applies to all
                  devices.
                </p>
                {(
                  [
                    "fontFamily",
                    "fontWeight",
                    "align",
                    "objectFit",
                    "direction",
                    "justify",
                    "alignItems",
                    "backgroundSize",
                  ] as const
                )
                  .filter((key) =>
                    node.kind === "container"
                      ? [
                          "direction",
                          "justify",
                          "alignItems",
                          "backgroundSize",
                        ].includes(key)
                      : node.kind === "image"
                        ? key === "objectFit"
                        : ["fontWeight", "align"].includes(key),
                  )
                  .map((key) => (
                    <label key={key}>
                      {(
                        {
                          fontFamily: "Font",
                          fontWeight: "Text weight",
                          align: "Text alignment",
                          objectFit: "Image fit",
                          direction: "Section layout",
                          justify: "Item arrangement",
                          alignItems: "Item alignment",
                          backgroundSize: "Background image fit",
                          fontSize: "Text size (px)",
                          padding: "Inner spacing (px)",
                          gap: "Space between items (px)",
                          radius: "Rounded corners (px)",
                          width: "Width (%)",
                          height: "Image height (px)",
                          minHeight: "Minimum height (px)",
                          lineHeight: "Line spacing (px)",
                          letterSpacing: "Letter spacing (px)",
                          color: "Text colour / hex",
                          background: "Background colour / hex",
                        } as Record<string, string>
                      )[key] || key}
                      <select
                        value={String(computedStyle[key] || "")}
                        onChange={(e) => style(key, e.target.value)}
                      >
                        <option value="">Original / inherited</option>
                        {(key === "fontFamily"
                          ? ["Arial", "Georgia", "Verdana", "Trebuchet MS"]
                          : key === "fontWeight"
                            ? [
                                "100",
                                "200",
                                "300",
                                "400",
                                "500",
                                "600",
                                "700",
                                "800",
                                "900",
                              ]
                            : key === "align"
                              ? ["left", "center", "right"]
                              : key === "objectFit"
                                ? ["cover", "contain", "fill"]
                                : key === "direction"
                                  ? [
                                      "row",
                                      "column",
                                      "row-reverse",
                                      "column-reverse",
                                    ]
                                  : key === "justify"
                                    ? [
                                        "flex-start",
                                        "center",
                                        "flex-end",
                                        "space-between",
                                      ]
                                    : key === "alignItems"
                                      ? [
                                          "flex-start",
                                          "center",
                                          "flex-end",
                                          "stretch",
                                        ]
                                      : ["cover", "contain", "auto"]
                        ).map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                {node.kind === "search" && <label>Search placeholder
                  <input defaultValue={node.text || "Search"} maxLength={200} onBlur={(e) => patch({ text: e.target.value })} />
                  <small>Search runs on your WordPress site after import. Keep the Studio importer active.</small>
                </label>}
                {(node.kind === "heading" ||
                  node.kind === "text" ||
                  node.kind === "button" || node.kind === "search") && (
                  <FontPicker
                    value={computedStyle.fontFamily || ""}
                    onChange={(value) => style("fontFamily", value)}
                  />
                )}
                {(node.kind === "image" || node.kind === "container") && (
                  <label>
                    {node.kind === "image"
                      ? "Upload image"
                      : "Upload background image"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        void uploadImage(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <small>
                      JPG, PNG or WebP · up to 2 MB. Saved with this draft. Use
                      Export ZIP to transfer uploads to WordPress. Large images
                      may exceed Share preview limits.
                    </small>
                  </label>
                )}
                {node.kind === "container" && (
                  <label>
                    Section background image URL
                    <input
                      type="url"
                      placeholder={
                        isUpload(computedStyle.backgroundImage || "")
                          ? "Uploaded background saved"
                          : "https://…"
                      }
                      defaultValue={
                        isUpload(computedStyle.backgroundImage || "")
                          ? ""
                          : computedStyle.backgroundImage || ""
                      }
                      onBlur={(e) => {
                        if (
                          isUpload(computedStyle.backgroundImage || "") &&
                          !e.target.value
                        )
                          return;
                        if (e.target.value !== computedStyle.backgroundImage)
                          style("backgroundImage", e.target.value);
                      }}
                    />
                  </label>
                )}
                {(["paddingBox", "marginBox"] as const).map((key) => (
                  <fieldset key={key} className="box-editor">
                    <legend>
                      {key === "paddingBox" ? "Padding (px)" : "Margin (px)"}
                    </legend>
                    {["Top", "Right", "Bottom", "Left"].map((side, index) => (
                      <label key={side}>
                        {side}
                        <input
                          aria-label={
                            (key === "paddingBox" ? "Padding " : "Margin ") +
                            side
                          }
                          type="number"
                          min={key === "paddingBox" ? 0 : -500}
                          max="500"
                          defaultValue={computedStyle[key]?.[index] || 0}
                          onBlur={(e) => boxSide(key, index, e.target.value)}
                        />
                      </label>
                    ))}
                  </fieldset>
                ))}

                {node.kind === "button" && (
                  <label>
                    Button text
                    <textarea
                      defaultValue={node.text || ""}
                      onBlur={(e) => {
                        if (e.target.value !== node.text)
                          patch({ text: e.target.value, runs: undefined });
                      }}
                    />
                  </label>
                )}
                {(node.kind === "image" ||
                  node.kind === "button" ||
                  node.kind === "video") && (
                  <label>
                    {node.kind === "image"
                      ? "Image URL"
                      : node.kind === "video"
                        ? "Video URL (MP4 or embed URL)"
                        : "Link URL"}
                    <input
                      type="url"
                      placeholder={
                        node.kind === "image" && isUpload(node.url || "")
                          ? "Uploaded image saved · paste URL to replace"
                          : "https://…"
                      }
                      defaultValue={
                        isUpload(node.url || "") ? "" : node.url || ""
                      }
                      onBlur={(e) => {
                        if (isUpload(node.url || "") && !e.target.value) return;
                        if (e.target.value !== node.url)
                          patch({ url: e.target.value });
                      }}
                    />
                  </label>
                )}
                {(
                  [
                    "fontSize",
                    "padding",
                    "gap",
                    "radius",
                    "width",
                    "height",
                    "minHeight",
                    "lineHeight",
                    "letterSpacing",
                    "color",
                    "background",
                  ] as const
                )
                  .filter((key) => key !== "height" || node.kind === "image")
                  .map((key) => (
                    <label key={key}>
                      {(
                        {
                          fontFamily: "Font",
                          fontWeight: "Text weight",
                          align: "Text alignment",
                          objectFit: "Image fit",
                          direction: "Section layout",
                          justify: "Item arrangement",
                          alignItems: "Item alignment",
                          backgroundSize: "Background image fit",
                          fontSize: "Text size (px)",
                          padding: "Inner spacing (px)",
                          gap: "Space between items (px)",
                          radius: "Rounded corners (px)",
                          width: "Width (%)",
                          height: "Image height (px)",
                          minHeight: "Minimum height (px)",
                          lineHeight: "Line spacing (px)",
                          letterSpacing: "Letter spacing (px)",
                          color: "Text colour / hex",
                          background: "Background colour / hex",
                        } as Record<string, string>
                      )[key] || key}
                      <input
                        type={
                          ["color", "background"].includes(key)
                            ? "text"
                            : "number"
                        }
                        min={
                          key === "width"
                            ? 1
                            : [
                                  "padding",
                                  "gap",
                                  "radius",
                                  "height",
                                  "minHeight",
                                  "lineHeight",
                                ].includes(key)
                              ? 0
                              : key === "fontSize"
                                ? 6
                                : key === "letterSpacing"
                                  ? -20
                                  : undefined
                        }
                        max={
                          key === "width"
                            ? 100
                            : key === "fontSize"
                              ? 180
                              : key === "radius"
                                ? 150
                                : key === "padding" || key === "gap"
                                  ? 200
                                  : key === "letterSpacing"
                                    ? 50
                                    : undefined
                        }
                        defaultValue={
                          (device === "desktop"
                            ? node.style
                            : {
                                ...node.style,
                                ...node.tablet,
                                ...(device === "mobile" ? node.mobile : {}),
                              })[key] ?? ""
                        }
                        onBlur={(e) => style(key, e.target.value)}
                      />
                    </label>
                  ))}
              </fieldset>
            )}
            <p>
              Change a field, then leave it to apply. Up to 20 changes can be
              undone.
            </p>
          </aside>
        )}
      </div>
      <details className="live-review">
        <summary>Capture review · {design.warnings.length} notes</summary>
        <ul>
          {design.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
        <p>
          Visual similarity is not automatically scored. Compare spacing,
          images, navigation and footer in both panes.
        </p>
      </details>
    </dialog>
  );
}
