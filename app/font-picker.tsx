"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { requestJson } from "@/lib/client-api";
import {
  systemFonts,
  firstFontFamily,
  safeFontFamily,
  type FontFamily,
} from "@/lib/font-types";
type Catalog = { families: FontFamily[]; updatedAt: string };
let cached: Promise<Catalog> | undefined;
function loadFonts() {
  return (cached ||= requestJson<Catalog>("/api/fonts").catch((e) => {
    cached = undefined;
    throw e;
  }));
}
export default function FontPicker({
  value,
  onChange,
  resetValue = "",
  label = "Font family",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  resetValue?: string;
  label?: string;
  disabled?: boolean;
}) {
  const id = useId(),
    [open, setOpen] = useState(false),
    [catalog, setCatalog] = useState<Catalog>(),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [limit, setLimit] = useState(50),
    [error, setError] = useState(""),
    [custom, setCustom] = useState("");
  useEffect(() => {
    if (!open || catalog) return;
    let active = true;
    setError("");
    loadFonts()
      .then((d) => {
        if (active) setCatalog(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [open, catalog]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog?.families || []).filter(
      (f) =>
        (!q || f.family.toLowerCase().includes(q)) &&
        (category === "All" || category === "Arabic / Urdu"
          ? category === "All" || f.subsets.includes("arabic")
          : f.category === category),
    );
  }, [catalog, query, category]);
  const selected = catalog?.families.find(
    (f) => f.family === firstFontFamily(value),
  );
  return (
    <div className="font-picker">
      <label htmlFor={id + "-open"}>{label}</label>
      <button
        id={id + "-open"}
        type="button"
        className="font-picker-toggle"
        aria-expanded={open}
        aria-controls={id + "-panel"}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {!value || value === resetValue
          ? "Original / inherited"
          : firstFontFamily(value)}{" "}
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div id={id + "-panel"} className="font-picker-panel">
          <input
            aria-label={label + " search"}
            type="search"
            placeholder="Search Google Fonts…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(50);
            }}
            disabled={disabled}
          />
          <select
            aria-label={label + " category"}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setLimit(50);
            }}
            disabled={disabled}
          >
            {[
              "All",
              "Sans Serif",
              "Serif",
              "Display",
              "Handwriting",
              "Monospace",
              "Arabic / Urdu",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            size={6}
            aria-label={label + " results"}
            value={value}
            disabled={disabled}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(false);
            }}
          >
            <option value={resetValue}>Original / inherited</option>
            <optgroup label="System fonts">
              {systemFonts
                .filter(
                  (f) =>
                    category === "All" &&
                    f.toLowerCase().includes(query.trim().toLowerCase()),
                )
                .map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
            </optgroup>
            {value &&
              value !== resetValue &&
              !systemFonts.includes(value) &&
              !filtered.slice(0, limit).some((f) => f.family === value) && (
                <option value={value}>
                  {firstFontFamily(value)} (current)
                </option>
              )}
            <optgroup label="Google Fonts">
              {filtered.slice(0, limit).map((f) => (
                <option key={f.family} value={f.family}>
                  {f.family}
                </option>
              ))}
            </optgroup>
          </select>
          <small role="status">
            {catalog
              ? `${filtered.length} matching · ${catalog.families.length} Google Font families`
              : "Loading font library…"}
          </small>
          {filtered.length > limit && (
            <button
              type="button"
              className="quiet"
              onClick={() => setLimit((n) => n + 100)}
            >
              Show more fonts
            </button>
          )}
          {selected && (
            <small>
              Available weights:{" "}
              {[...new Set([...selected.weights, ...selected.italicWeights])]
                .sort((a, b) => a - b)
                .join(", ")}
            </small>
          )}
          {error && <p role="alert">{error} Close and reopen to retry.</p>}
          <details>
            <summary>Custom / installed font</summary>
            <input
              aria-label="Custom font family name"
              placeholder="Enter an installed font name"
              value={custom}
              maxLength={100}
              onChange={(e) => setCustom(e.target.value)}
            />
            <button
              type="button"
              className="secondary"
              disabled={disabled || !safeFontFamily(custom.trim())}
              onClick={() => {
                onChange(custom.trim());
                setOpen(false);
              }}
            >
              Use font name
            </button>
            <small>
              Uses a font already installed or loaded on the viewing device and
              WordPress site. Font files are not uploaded here.
            </small>
          </details>
        </div>
      )}
    </div>
  );
}
