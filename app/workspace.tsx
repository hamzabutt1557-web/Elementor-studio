"use client";
import { qualityReport } from "@/lib/quality-report";
import type { LayoutAudit } from "@/lib/layout-audit";
import { useEffect, useState, useRef } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Layers,
  Plus,
  Globe,
  FileText,
  Zap,
  Check,
  Download,
  Monitor,
  Tablet,
  Smartphone,
  ChevronDown,
  Settings2,
  FolderOpen,
  Clock,
  ShieldCheck,
  AlertCircle,
  LoaderCircle,
  X,
  ExternalLink,
  Code2,
  Image as ImageIcon,
  LayoutGrid,
  PanelLeftClose,
  KeyRound,
  Eye,
  EyeOff,
  SlidersHorizontal,
  CircleCheck,
} from "lucide-react";
import AccountMenu from "./account-menu";
import { requestJson, requestResponse } from "@/lib/client-api";
import { viewportWidth } from "@/lib/viewports";
import FontPicker from "./font-picker";
import SidePanel from "./side-panel";
import LiveWorkspace from "./live-workspace";
import ConversionPreview from "./conversion-preview";
import { streamBuild } from "@/lib/build-stream";
import { loadDraft, saveDraft } from "@/lib/draft-store";
import type { Design } from "@/lib/design";
type PageChoice = { url: string; title: string };
type Result = {
  layoutAudit?: LayoutAudit;
  design: Design;
  preview: string;
  screenshot: string;
  capture: string;
  template?: unknown;
  usage: {
    input: number;
    output: number;
    total: number;
    requests: number;
    cost: number | null;
    exact: boolean;
    model: string;
  };
  checks: { nativeWidgets: number };
};
type Config = {
  provider: {
    configured: boolean;
    priced: boolean;
    model: string;
    inputRate: number | null;
    outputRate: number | null;
  };
  version: string;
  limit: number;
  access: { mode: "password" | "email"; emailConnection: "ready" | "pending" };
};
const demoBrief =
  "Verdant Studio\nThoughtful spaces. Better living.\nWe are a landscape design studio creating calm, considered gardens for homes and businesses. Our services include garden design, outdoor living spaces, and ongoing landscape care. Every project starts with a conversation.";
function download(
  content: Blob | string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(
    typeof content === "string" ? new Blob([content], { type }) : content,
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
async function post(path: string, body: unknown) {
  return requestJson(
    "/api/" + path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    path === "build" ? 150000 : 45000,
  );
}
function DraftViewport({ html, device }: { html: string; device: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  const viewport = viewportWidth(device);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setAvailable(entry.contentRect.width),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const scale = available ? Math.min(1, available / viewport) : 1;
  return (
    <div
      ref={host}
      style={{ width: "100%", height: 900 * scale, overflow: "hidden" }}
    >
      <iframe
        title="Generated editable design preview"
        srcDoc={html}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        style={{
          width: viewport,
          height: 900,
          maxWidth: "none",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}
export default function Workspace({
  showSignOut = false,
}: {
  showSignOut?: boolean;
}) {
  const [drawer, setDrawer] = useState<"project" | "brand" | null>(null);
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("estudio-theme");
      if (saved === "dark") setTheme("dark");
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem("estudio-theme", theme);
    } catch {}
  }, [theme]);
  const [route, setRoute] = useState<"url" | "brief">("url");
  const [input, setInput] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("auto");
  const [mode, setMode] = useState("none");
  const [apiProvider, setApiProvider] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [apiModel, setApiModel] = useState("");
  const [apiInputRate, setApiInputRate] = useState("");
  const [apiOutputRate, setApiOutputRate] = useState("");
  const [apiTest, setApiTest] = useState("");
  const [apiTesting, setApiTesting] = useState(false);
  const [apiModels, setApiModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [apiState, setApiState] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [showKey, setShowKey] = useState(false);
  const apiRequest = useRef(0);
  function resetConnection() {
    apiRequest.current++;
    setApiTest("");
    setApiState("idle");
    setApiTesting(false);
    setModelsLoading(false);
  }
  async function loadModels() {
    const request = ++apiRequest.current;
    setModelsLoading(true);
    setApiTest("");
    setApiState("idle");
    try {
      const data = await post("provider-test", {
        list: true,
        connection: {
          provider: apiProvider,
          key: apiKey.trim(),
          model: "model-discovery",
          inputRate: 0,
          outputRate: 0,
        },
      });
      if (request !== apiRequest.current) return;
      setApiModels(data.models);
      setApiTest(
        data.models.length
          ? "Models loaded. Choose one, then test the connection."
          : "No models returned. Enter a model ID from your provider.",
      );
    } catch (e) {
      if (request === apiRequest.current) {
        setApiTest((e as Error).message);
        setApiState("error");
      }
    } finally {
      if (request === apiRequest.current) setModelsLoading(false);
    }
  }

  const [globalColours, setGlobalColours] = useState<Record<string, string>>(
    {},
  );
  const [budget, setBudget] = useState("0.10");
  const [config, setConfig] = useState<Config>();
  const [choices, setChoices] = useState<PageChoice[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const buildController = useRef<AbortController | null>(null);
  useEffect(() => () => buildController.current?.abort(), []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [device, setDevice] = useState("desktop");
  const [live, setLive] = useState(false);
  const [compare, setCompare] = useState(false);
  const [conversionPreview, setConversionPreview] = useState(false);
  const [conversionSource, setConversionSource] = useState("");
  const [tab, setTab] = useState("build");
  const [zipBusy, setZipBusy] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [media, setMedia] = useState(true);
  const [brandName, setBrandName] = useState("");
  const [oldBrand, setOldBrand] = useState("");
  const [brandFont, setBrandFont] = useState("Original");
  const [brandAccent, setBrandAccent] = useState("#147d68");
  const [brandBusy, setBrandBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    loadDraft<{ results: Result[]; input: string; route: "url" | "brief" }>()
      .then((saved) => {
        if (saved?.results?.length) {
          setResults(saved.results);
          setInput(saved.input || "");
          setRoute(saved.route || "url");
          setStatus(
            "Saved drafts restored on this browser. Rebuild to apply newer converter changes.",
          );
        }
      })
      .catch(() =>
        setStatus(
          "Browser storage is unavailable. Export your work before closing.",
        ),
      )
      .finally(() => setRestored(true));
  }, []);
  useEffect(() => {
    if (!restored || busy) return;
    saveDraft({ results, input, route }).catch(() =>
      setError(
        "This browser could not save your drafts. Export them before closing.",
      ),
    );
  }, [results, input, route, restored, busy]);
  useEffect(() => {
    requestJson<Config>("/api/config")
      .then((data) => {
        if (
          typeof data.provider?.configured !== "boolean" ||
          !data.access ||
          !["password", "email"].includes(data.access.mode)
        )
          throw new Error(
            "App configuration is incomplete. Reload to try again.",
          );
        setConfig(data);
      })
      .catch(() =>
        setError(
          "App configuration could not be loaded. Reload and sign in again if needed.",
        ),
      );
  }, []);
  const unknownCost = results.some((r) => r.usage.cost === null);
  const current = results[active];
  const deliveryQuality = current ? qualityReport(current.design, current.layoutAudit) : null;
  const total = results.reduce(
    (a, r) => ({
      input: a.input + r.usage.input,
      output: a.output + r.usage.output,
      requests: a.requests + r.usage.requests,
      cost: a.cost + (r.usage.cost || 0),
    }),
    { input: 0, output: 0, requests: 0, cost: 0 },
  );
  function reset() {
    setTab("build");
    setResults([]);
    setChoices([]);
    setSelected([]);
    setActive(0);
    setInput("");
    setTitle("");
    setError("");
    setStatus("");
  }
  async function discover() {
    if (!input.trim()) return setError("Enter your website URL first.");
    setBusy(true);
    setError("");
    setStatus("Finding public pages…");
    try {
      const data = await post("discover", { url: input });
      setChoices(data.pages);
      setSelected(data.pages.slice(0, 1).map((p: PageChoice) => p.url));
      setStatus(data.note);
    } catch (e) {
      setError((e as Error).message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }
  async function build(demo = false) {
    if (buildController.current) return;
    const source = demo ? demoBrief : input;
    if (!source.trim())
      return setError(
        route === "url"
          ? "Enter a public website URL."
          : "Describe the website you want to create.",
      );
    if (
      !demo &&
      mode !== "none" &&
      !config?.provider.configured &&
      !apiKey.trim()
    )
      return setError(
        "The app owner must configure this AI provider first. Choose No AI API to build now.",
      );
    if (!demo && mode !== "none" && apiKey && !apiModel.trim())
      return setError(
        "Choose an available model in AI connection before building.",
      );
    if (!demo && mode === "paid" && apiKey && (!apiInputRate || !apiOutputRate))
      return setError(
        "Enter the model input and output prices before a paid build.",
      );
    setBusy(true);
    setError("");
    setDrawer(null);
    setLive(false);
    setConversionPreview(true);
    const controller = new AbortController();
    buildController.current = controller;
    let completed = 0;
    let failures = 0;
    const targets =
      demo || route === "brief"
        ? [source]
        : selected.length
          ? selected
          : [source];
    for (let i = 0; i < targets.length; i++) {
      if (controller.signal.aborted) break;
      setConversionSource(demo || route === "brief" ? "" : targets[i]);
      setStatus(
        `${demo || route === "brief" ? "Arranging your brief" : "Capturing and mapping page"} ${i + 1} of ${targets.length}…`,
      );
      try {
        const r = await streamBuild<Result>(
          {
            includeTemplate: false,
            route: demo ? "brief" : route,
            input: targets[i],
            title: demo ? "Verdant Studio" : title,
            type,
            mode: demo ? "none" : mode,
            budget: Number(budget),
            ...(!demo && mode !== "none" && apiKey.trim()
              ? {
                  connection: {
                    provider: apiProvider,
                    key: apiKey.trim(),
                    model: apiModel.trim(),
                    inputRate: mode === "free" ? 0 : Number(apiInputRate),
                    outputRate: mode === "free" ? 0 : Number(apiOutputRate),
                  },
                }
              : {}),
          },
          (message) =>
            setStatus(`Page ${i + 1} of ${targets.length} · ${message}`),
          controller.signal,
        );
        const first = completed === 0;
        completed++;
        setResults((prev) => (first ? [r] : [...prev, r]));
        if (first) setActive(0);
      } catch (e) {
        failures++;
        setError((e as Error).message);
      }
    }
    setStatus(
      controller.signal.aborted ? `Stopped. ${completed} completed drafts kept.` : failures
        ? `${targets.length - failures} pages completed. ${failures} need attention.`
        : "Your editable draft is ready for review.",
    );
    setBusy(false);
    buildController.current = null;
    if (completed) {
      setDrawer(null);
      setConversionPreview(false);
      setCompare(false);
      setLive(true);
    }
  }
  async function testApi() {
    const request = ++apiRequest.current;
    setApiTesting(true);
    setApiTest("Testing…");
    try {
      const data = await post("provider-test", {
        connection: {
          provider: apiProvider,
          key: apiKey.trim(),
          model: apiModel.trim(),
          inputRate: 0,
          outputRate: 0,
        },
      });
      if (request !== apiRequest.current) return;
      setApiTest(data.message);
      setApiState("success");
    } catch (e) {
      if (request === apiRequest.current) {
        setApiTest((e as Error).message);
        setApiState("error");
      }
    } finally {
      if (request === apiRequest.current) setApiTesting(false);
    }
  }
  async function applyBrand() {
    setBrandBusy(true);
    setError("");
    try {
      const data = await post("rebrand", {
        includeTemplate: false,
        designs: results.map((r) => r.design),
        brand: {
          name: brandName,
          oldName: oldBrand,
          font: brandFont,
          accent: brandAccent,
          colours: Object.fromEntries(
            Object.entries(globalColours)
              .filter(([, v]) => v.trim())
              .map(([k, v]) => [k, v.trim()]),
          ),
        },
      });
      setResults((prev) =>
        prev.map((r, i) => ({ ...r, ...data.pages[i], template: undefined })),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBrandBusy(false);
    }
  }
  async function exportJson(result: Result, name: string) {
    setZipBusy(true);
    setError("");
    try {
      const template =
        result.template ||
        (await post("template", { design: result.design })).template;
      download(JSON.stringify(template, null, 2), name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setZipBusy(false);
    }
  }
  async function exportAll() {
    setZipBusy(true);
    setError("");
    try {
      const res = await requestResponse(
        "/api/export",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            designs: results.map((r) => r.design),
            media,
          }),
        },
        120000,
      );
      download(await res.blob(), "elementor-pages.zip");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setZipBusy(false);
    }
  }
  const width = device === "desktop" ? "100%" : viewportWidth(device);
  const connectionForm = (
    <div className="connection-form">
      <div className="connection-intro">
        <span className="setup-icon">
          <KeyRound size={18} />
        </span>
        <div>
          <h3>Your AI connection</h3>
          <p>
            Connect a provider for this session. No key is needed for a basic
            draft.
          </p>
        </div>
        <span className={"connection-badge " + apiState}>
          {apiState === "success"
            ? "Verified"
            : apiKey
              ? "Not verified"
              : "Optional"}
        </span>
      </div>
      <label className="setup-field">
        Provider
        <select
          value={apiProvider}
          disabled={busy}
          onChange={(e) => {
            setApiProvider(e.target.value);
            setApiKey("");
            setApiModel("");
            setApiModels([]);
            setShowKey(false);
            resetConnection();
          }}
        >
          <option value="gemini">Google Gemini / AI Studio</option>
          <option value="openai">OpenAI</option>
        </select>
      </label>
      <label className="setup-field">
        API key
        <span className="secret-input">
          <input
            type={showKey ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            placeholder="Paste your API key"
            disabled={busy}
            onChange={(e) => {
              setApiKey(e.target.value);
              setApiModels([]);
              resetConnection();
            }}
          />
          <button
            type="button"
            aria-label={showKey ? "Hide API key" : "Show API key"}
            aria-pressed={showKey}
            onClick={() => setShowKey((v) => !v)}
          >
            {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </span>
      </label>
      <div className="model-heading">
        <span>Model</span>
        <button
          className="model-load"
          onClick={loadModels}
          disabled={
            busy || apiTesting || modelsLoading || apiKey.trim().length < 10
          }
        >
          {modelsLoading ? (
            <LoaderCircle size={14} className="spin" />
          ) : (
            <SlidersHorizontal size={14} />
          )}{" "}
          {modelsLoading ? "Loading models…" : "Load available models"}
        </button>
      </div>
      <label className="setup-field">
        <span className="sr-only">Model ID</span>
        <input
          value={apiModel}
          list="provider-model-list"
          placeholder={
            apiModels.length
              ? "Choose or type a model ID"
              : "Load models or paste an exact model ID"
          }
          disabled={busy}
          onChange={(e) => {
            setApiModel(e.target.value);
            resetConnection();
          }}
        />
        <datalist id="provider-model-list">
          {apiModels.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
      </label>
      <div className="connection-actions">
        <button
          className="secondary"
          onClick={testApi}
          disabled={
            busy ||
            apiTesting ||
            modelsLoading ||
            !apiKey.trim() ||
            !apiModel.trim()
          }
        >
          {apiTesting ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <CircleCheck size={15} />
          )}{" "}
          {apiTesting ? "Testing…" : "Test connection"}
        </button>
        {apiKey && (
          <button
            className="quiet"
            disabled={busy}
            onClick={() => {
              setApiKey("");
              setApiModels([]);
              setShowKey(false);
              resetConnection();
            }}
          >
            Disconnect
          </button>
        )}
      </div>
      {apiTest && (
        <p
          className={"api-feedback " + apiState}
          role={apiState === "error" ? "alert" : "status"}
        >
          {apiTest}
        </p>
      )}
      <p className="connection-privacy">
        <ShieldCheck size={14} /> Key stays in this session. It is not saved
        with projects or exports.
      </p>
      <details className="cost-details" open={mode === "paid" || undefined}>
        <summary>
          Usage & budget <ChevronDown size={14} />
        </summary>
        <div className="cost-content">
          <p>
            Free quota depends on your provider. Selecting free mode does not
            make a paid model free.
          </p>
          <label className="setup-field">
            Budget per page ($)
            <input
              type="number"
              min="0"
              max="50"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </label>
          {mode === "paid" && (
            <div className="pricing-grid">
              <label className="setup-field">
                Input / 1M tokens ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={apiInputRate}
                  onChange={(e) => setApiInputRate(e.target.value)}
                />
              </label>
              <label className="setup-field">
                Output / 1M tokens ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={apiOutputRate}
                  onChange={(e) => setApiOutputRate(e.target.value)}
                />
              </label>
            </div>
          )}
          <small>
            Server spending limits still apply. Confirm model prices with your
            provider.
          </small>
        </div>
      </details>
    </div>
  );
  const projectForm = (
    <section className="card input-card project-setup">
      <div className="card-heading">
        <div>
          <h2>What would you like to build?</h2>
          <p>Start with a website link or your client brief.</p>
        </div>
        <span className="subtle-tag">ELEMENTOR FREE</span>
      </div>
      <div className="route-tabs">
        <button
          className={route === "url" ? "selected" : ""}
          onClick={() => {
            setRoute("url");
            setInput("");
            setChoices([]);
          }}
          disabled={busy}
        >
          <Globe size={17} />
          Website URL
        </button>
        <button
          className={route === "brief" ? "selected" : ""}
          onClick={() => {
            setRoute("brief");
            setInput("");
            setChoices([]);
          }}
          disabled={busy}
        >
          <FileText size={17} />
          Client brief
        </button>
      </div>
      <label className="field-label" htmlFor="source">
        {route === "url" ? "Reference website" : "Tell us about the website"}
      </label>
      {route === "url" ? (
        <div className="url-input">
          <Globe size={18} />
          <input
            id="source"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoComplete="url"
            spellCheck={false}
            placeholder="https://example.com"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setChoices([]);
              setSelected([]);
            }}
            disabled={busy}
          />
        </div>
      ) : (
        <>
          <textarea
            id="source"
            placeholder="A modern landscape studio website, with a welcoming hero, services and a contact section…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <label className="field-label" htmlFor="title">
            Project name
          </label>
          <input
            id="title"
            className="input"
            placeholder="Your client or brand"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />
        </>
      )}
      <p className="input-hint">
        <ShieldCheck size={13} />
        {route === "url"
          ? "Use a public page you own or have permission to reproduce."
          : "No-AI mode arranges your words into editable sections."}
      </p>
      <div className="field-row">
        <div>
          <label className="field-label" htmlFor="site-type">
            Website type
          </label>
          <div className="select-wrap">
            <select
              id="site-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={busy}
            >
              <option value="auto">Auto detect</option>
              <option value="business">Business</option>
              <option value="landing">Landing page</option>
              <option value="portfolio">Portfolio</option>
              <option value="ecommerce">E-commerce</option>
              <option value="blog">Blog</option>
              <option value="resume">CV / resume</option>
            </select>
            <ChevronDown size={15} />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="api-mode">
            AI assistance
          </label>
          <div className="select-wrap">
            <select
              id="api-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              disabled={busy}
            >
              <option value="none">No AI · quick draft</option>
              <option value="free">My API · free quota</option>
              <option value="paid">My API · budgeted</option>
            </select>
            <ChevronDown size={15} />
          </div>
        </div>
      </div>
      {mode !== "none" && (
        <details className="connection-details">
          <summary>
            <span className="setup-icon">
              <KeyRound size={17} />
            </span>
            <span>
              <b>AI connection</b>
              <small>
                {apiState === "success"
                  ? apiModel
                  : apiKey
                    ? "Choose a model and verify your key"
                    : config?.provider.configured
                      ? "Owner connection available · or use your own"
                      : "Connect your key to use AI assistance"}
              </small>
            </span>
            <span className={"connection-badge " + apiState}>
              {apiState === "success" ? "Verified" : "Set up"}
            </span>
            <ChevronDown size={16} />
          </summary>
          {connectionForm}
        </details>
      )}
      {choices.length > 0 && (
        <div className="page-choices">
          <b>Choose up to 3 pages</b>
          {choices.map((p) => (
            <label key={p.url}>
              <input
                type="checkbox"
                checked={selected.includes(p.url)}
                disabled={
                  busy || (!selected.includes(p.url) && selected.length >= 3)
                }
                onChange={(e) =>
                  setSelected((prev) =>
                    e.target.checked
                      ? [...prev, p.url]
                      : prev.filter((u) => u !== p.url),
                  )
                }
              />
              <span>
                {p.title}
                <small>{p.url}</small>
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="project-submit">
        <div className="build-actions">
          {route === "url" && (
            <button
              className="secondary"
              onClick={discover}
              disabled={busy || !input.trim()}
            >
              Find pages
            </button>
          )}
          <button
            className="primary"
            onClick={() => build()}
            disabled={busy || !input.trim()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Zap size={17} />
            )}{" "}
            {busy ? "Building…" : "Create my draft"}
            {!busy && <ArrowRight size={17} />}
          </button>
        </div>
        <div className="small-note">
          <Check size={13} />
          Native widgets<span>·</span>No subscription required<span>·</span>
          Editable in Elementor
        </div>
      </div>
    </section>
  );
  const brandForm = (
    <section className="card" style={{ padding: 24, marginBottom: 20 }}>
      <h2>Brand & global colours</h2>
      <p>
        Apply to all completed pages. Use Live preview to edit individual text,
        images and spacing here.
      </p>
      <div className="brand-controls">
        <label>
          New brand name
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Your brand"
          />
        </label>
        <label>
          Replace source brand text
          <input
            value={oldBrand}
            onChange={(e) => setOldBrand(e.target.value)}
            placeholder="Exact original brand name"
          />
        </label>
        <FontPicker
          label="Brand font"
          value={brandFont}
          onChange={setBrandFont}
          resetValue="Original"
          disabled={brandBusy || busy}
        />
        <label>
          Button colour
          <input
            type="color"
            value={brandAccent}
            onChange={(e) => setBrandAccent(e.target.value)}
          />
        </label>
        <label>
          Button hex code
          <input
            value={brandAccent}
            onChange={(e) => setBrandAccent(e.target.value)}
            placeholder="#147D68"
            maxLength={7}
          />
        </label>
        <button
          className="primary"
          onClick={applyBrand}
          disabled={brandBusy || busy}
        >
          {brandBusy ? "Applying…" : "Apply branding"}
        </button>
      </div>
      <div className="global-colours">
        {[
          ["primary", "Primary / headings"],
          ["secondary", "Secondary / body text"],
          ["background", "Page background"],
          ["header", "Header background"],
          ["footer", "Footer background"],
          ["button", "Button background"],
          ["buttonText", "Button text"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <div className="hex-field">
              <input
                type="color"
                aria-label={label + " picker"}
                value={
                  /^#[0-9a-f]{6}$/i.test(globalColours[key] || "")
                    ? globalColours[key]
                    : "#ffffff"
                }
                onChange={(e) =>
                  setGlobalColours((prev) => ({
                    ...prev,
                    [key]: e.target.value,
                  }))
                }
              />
              <input
                aria-label={label + " hex"}
                value={globalColours[key] || ""}
                placeholder="Original · paste #HEXCODE"
                maxLength={7}
                onChange={(e) =>
                  setGlobalColours((prev) => ({
                    ...prev,
                    [key]: e.target.value,
                  }))
                }
              />
            </div>
          </label>
        ))}
      </div>
      <p>
        Blank fields keep the original colours. Header/footer colours apply to
        detected header/footer sections; rebuild older captures for detection.
      </p>
    </section>
  );
  return (
    <div className="app" data-theme={theme}>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Elementor Studio home">
          <span className="brand-icon">
            <Layers size={23} />
          </span>
          <div>
            Elementor<span>Studio</span>
          </div>
        </a>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav>
          <button
            className={tab === "build" ? "nav active" : "nav"}
            onClick={() => setTab("build")}
          >
            <LayoutGrid size={18} />
            Builder
            <span className="nav-dot" />
          </button>
          <button
            className={tab === "projects" ? "nav active" : "nav"}
            onClick={() => setTab("projects")}
          >
            <FolderOpen size={18} />
            Saved pages<span className="count">{results.length}</span>
          </button>
          <button
            className={tab === "settings" ? "nav active" : "nav"}
            onClick={() => setTab("settings")}
          >
            <Settings2 size={18} />
            API & settings
          </button>
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="crumb">Workspace</span>
            <span className="slash">/</span>
            <b>
              {tab === "settings"
                ? "API & settings"
                : tab === "projects"
                  ? "Saved pages"
                  : "Website builder"}
            </b>
          </div>
          <div className="top-right">
            {showSignOut && <AccountMenu />}
            <button
              className="quiet"
              onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
              aria-label="Toggle colour theme"
            >
              {theme === "dark" ? "☀ Light" : "☾ Dark"}
            </button>
            <button
              className="quiet"
              onClick={() => {
                setInput("");
                setTitle("");
                setChoices([]);
                setSelected([]);
                setError("");
                setStatus("");
                setTab("build");
                setDrawer("project");
              }}
              disabled={busy}
            >
              <Plus size={16} /> New project
            </button>
          </div>
        </header>
        {tab === "build" && current && (
          <div className="workspace-actions" aria-label="Project actions">
            <span>
              {current ? current.design.title : "Create your first draft"}
            </span>
            <button
              className="primary"
              onClick={() => {
                setCompare(false);
                setLive(true);
              }}
              disabled={!current || busy}
            >
              Open design editor
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setCompare(true);
                setLive(true);
              }}
            >
              Compare preview
            </button>
            <button
              className="secondary"
              onClick={() => setDrawer("brand")}
              disabled={!current || busy}
            >
              Brand & colours
            </button>
            <button
              className="secondary"
              onClick={() =>
                current && exportJson(current, `page-${active + 1}.json`)
              }
              disabled={!current || zipBusy || busy}
            >
              JSON
            </button>
            <button
              className="secondary"
              onClick={exportAll}
              disabled={!current || zipBusy || busy}
            >
              {zipBusy ? "Exporting…" : "Export ZIP"}
            </button>
          </div>
        )}
        <div className="content">
          <div className="heading">
            <h1>
              {tab === "settings"
                ? "Settings"
                : tab === "projects"
                  ? "Saved pages"
                  : "Your website workspace"}
            </h1>
            <p>
              {tab === "settings"
                ? "Manage your AI connection and appearance in one place."
                : tab === "projects"
                  ? "Drafts are saved in this browser. Export a copy to keep them."
                  : "Create a draft, make your changes, then download it for Elementor."}
            </p>
          </div>
          {error && (
            <div className="notice error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "build" && (
            <>
              {!current && drawer !== "project" && (
                <div className="builder-grid">{projectForm}</div>
              )}
              {status && (
                <div className="notice progress" role="status">
                  <button
                    type="button"
                    onClick={() => setConversionPreview(true)}
                  >
                    Open conversion preview
                  </button>
                  {busy ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <Check size={18} />
                  )}
                  <span>{status}</span>
                  {busy && <span className="live-dot" />}
                  {busy && buildController.current && <button type="button" onClick={() => buildController.current?.abort()}>Stop conversion</button>}
                </div>
              )}
              {current && (
                <section className="card preview-card">
                  <div className="preview-top">
                    <div>
                      <span className="eyebrow">EDITABLE DRAFT</span>
                      <h2>{current.design.title}</h2>
                    </div>
                    <div className="preview-controls">
                      <button
                        className="primary"
                        onClick={() => {
                          setCompare(false);
                          setLive(true);
                        }}
                      >
                        Open design editor
                      </button>
                      <div className="device-tabs">
                        {[
                          ["desktop", Monitor],
                          ["tablet", Tablet],
                          ["mobile", Smartphone],
                        ].map(([name, Icon]) => {
                          const I = Icon as typeof Monitor;
                          return (
                            <button
                              key={String(name)}
                              className={device === name ? "selected" : ""}
                              onClick={() => setDevice(String(name))}
                              aria-label={String(name) + " preview"}
                            >
                              <I size={17} />
                            </button>
                          );
                        })}
                      </div>
                      <button
                        className="secondary"
                        disabled={
                          !current.screenshot &&
                          !/^https?:/.test(current.design.source)
                        }
                        onClick={() => {
                          setCompare(true);
                          setLive(true);
                        }}
                      >
                        <ImageIcon size={16} />
                        Compare preview
                      </button>
                      <button
                        className="secondary"
                        onClick={() =>
                          exportJson(current, `page-${active + 1}.json`)
                        }
                      >
                        <Code2 size={16} />
                        JSON
                      </button>
                      <button
                        className="primary"
                        onClick={exportAll}
                        disabled={zipBusy || busy}
                      >
                        {zipBusy ? (
                          <LoaderCircle size={16} className="spin" />
                        ) : (
                          <Download size={16} />
                        )}
                        Export ZIP
                      </button>
                    </div>
                  </div>
                  <div className="page-tabs">
                    {results.map((r, i) => (
                      <button
                        key={i}
                        className={active === i ? "selected" : ""}
                        onClick={() => setActive(i)}
                      >
                        {r.design.title.slice(0, 30)} <Check size={12} />
                      </button>
                    ))}
                    <span>
                      {results.length} page{results.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="preview-stage">
                    <div className="draft-frame" style={{ maxWidth: width }}>
                      <div className="browser-bar">
                        <span />
                        <span />
                        <span />
                        <p>Generated draft · {device}</p>
                      </div>
                      <DraftViewport html={current.preview} device={device} />
                    </div>
                  </div>
                  <div className="quality-bar">
                    <span>
                      <Check size={14} />
                      {current.checks.nativeWidgets} native elements
                    </span>
                    <span>
                      <Check size={14} />
                      Structure checked
                    </span>
                    <span>
                      <Clock size={14} />
                      WordPress import: untested
                    </span>
                    <span>
                      <Clock size={14} />
                      Similarity: unmeasured
                    </span>
                  </div>
                  <details className="capture-review" open>
                    <summary>Delivery checklist · {deliveryQuality?.actionItems} items need work</summary>
                    <p>{deliveryQuality?.note}</p>
                    <ul>{deliveryQuality?.issues.map(issue => (
                      <li key={issue.code}><strong>{issue.severity === "action" ? "Action" : "Review"} · {issue.count}</strong> — {issue.message}</li>
                    ))}</ul>
                  </details>
                  {current.layoutAudit && (
                    <details
                      className="capture-review"
                      open={current.layoutAudit.devices.some(
                        (d) => d.shifted || d.missing,
                      )}
                    >
                      <summary>
                        {current.layoutAudit.status === "checked"
                          ? current.layoutAudit.devices.some(
                              (d) => d.shifted || d.missing,
                            )
                            ? "Layout needs review before delivery"
                            : "Initial layout check completed"
                          : "Layout check incomplete — compare before delivery"}
                      </summary>
                      <p>
                        Source vs initial draft, measured at three screen sizes.
                        This checks element positions and dimensions, not pixel
                        similarity or WordPress rendering.
                      </p>
                      <div className="layout-results">
                        {current.layoutAudit.devices.map((d) => (
                          <div key={d.device}>
                            <strong>
                              {d.device} · {d.width}px
                            </strong>
                            <span>{d.compared} elements compared</span>
                            <span>
                              {d.shifted} shifted over 24px · {d.missing}{" "}
                              missing/hidden
                            </span>
                            <span>
                              Typical drift: {d.medianDriftPx}px · 90th
                              percentile: {d.p90DriftPx}px
                            </span>
                            {!!d.issues.length && (
                              <ul>
                                {d.issues.map((issue) => (
                                  <li key={issue.id}>
                                    {issue.label || "Captured element"}:{" "}
                                    {issue.driftPx}px drift
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                      <p>{current.layoutAudit.note}</p>
                      <p>
                        <strong>Before delivery:</strong> compare flagged areas,
                        replace source links and branding, then check the
                        imported page in Elementor. Forms, cart and checkout
                        need their own backend connection.
                      </p>
                    </details>
                  )}
                  <details className="report">
                    <summary>
                      {current.design.warnings.length} review notes{" "}
                      <ChevronDown size={15} />
                    </summary>
                    <ul>
                      {current.design.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                    <label className="media-option">
                      <input
                        type="checkbox"
                        checked={!!current.design.catalogTools}
                        disabled={catalogBusy || busy}
                        onChange={async (e) => {
                          const design = {
                            ...current.design,
                            catalogTools: e.target.checked,
                          };
                          const index = active;
                          setCatalogBusy(true);
                          try {
                            const result = await requestJson<{
                              preview: string;
                            }>("/api/preview", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ design }),
                            });
                            setResults((previous) =>
                              previous.map((r, i) =>
                                i === index
                                  ? {
                                      ...r,
                                      design,
                                      preview: result.preview,
                                      template: undefined,
                                    }
                                  : r,
                              ),
                            );
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setCatalogBusy(false);
                          }
                        }}
                      />{" "}
                      Add local product search, sorting and quick preview
                      (changes the captured layout)
                    </label>
                    <label className="media-option">
                      <input
                        type="checkbox"
                        checked={media}
                        onChange={(e) => setMedia(e.target.checked)}
                      />{" "}
                      Include downloadable media in ZIP (within package size
                      limits)
                    </label>
                  </details>
                </section>
              )}
            </>
          )}
          {tab === "projects" && (
            <section className="card project-list">
              {results.length ? (
                results.map((r, i) => (
                  <div className="project-row" key={i}>
                    <span className="project-icon">
                      <FileText size={22} />
                    </span>
                    <div>
                      <h3>{r.design.title}</h3>
                      <p>
                        {r.capture === "brief"
                          ? "Describe your website draft"
                          : r.design.source}
                      </p>
                      <small>
                        {r.checks.nativeWidgets} native elements · import
                        untested
                      </small>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => {
                        setActive(i);
                        setTab("build");
                      }}
                    >
                      Review <ArrowRight size={16} />
                    </button>
                    <button
                      className="primary"
                      onClick={() => exportJson(r, `page-${i + 1}.json`)}
                    >
                      <Download size={16} />
                      JSON
                    </button>
                  </div>
                ))
              ) : (
                <div className="no-projects">
                  <FolderOpen size={36} />
                  <h3>No pages yet</h3>
                  <p>Build a draft to see it here.</p>
                  <button className="primary" onClick={() => setTab("build")}>
                    Open builder <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          )}
          {tab === "settings" && (
            <div className="settings-layout">
              <section className="card settings-connection">
                {connectionForm}
              </section>
              <aside className="settings-secondary">
                <section className="card preference-card">
                  <ShieldCheck size={20} />
                  <h2>Workspace access</h2>
                  <span className="connection-badge">
                    {config
                      ? config.access.mode === "email"
                        ? "Verified email login active"
                        : "Password login active"
                      : "Checking access…"}
                  </span>
                  <p>
                    {config?.access.mode === "email"
                      ? "Only your approved, verified email can open the private workspace."
                      : "Email login is waiting for its Supabase connection. Your existing password protects the workspace."}
                  </p>
                </section>
                <section className="card preference-card">
                  <h2>Appearance</h2>
                  <p>Choose what feels comfortable.</p>
                  <div className="appearance-options">
                    <button
                      aria-pressed={theme === "light"}
                      onClick={() => setTheme("light")}
                    >
                      ☀ Light
                    </button>
                    <button
                      aria-pressed={theme === "dark"}
                      onClick={() => setTheme("dark")}
                    >
                      ☾ Dark
                    </button>
                  </div>
                </section>
                <section className="card preference-card">
                  <ShieldCheck size={20} />
                  <h2>Start without a key</h2>
                  <p>
                    Capture, edit and export a basic draft without an AI
                    subscription.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => {
                      setMode("none");
                      setTab("build");
                    }}
                  >
                    Open builder <ArrowRight size={15} />
                  </button>
                </section>
                {config?.provider.configured && (
                  <section className="card preference-card">
                    <span className="connection-badge success">
                      Owner connection
                    </span>
                    <h2>{config.provider.model}</h2>
                    <p>
                      A server connection is available. Its credentials stay on
                      the server.
                    </p>
                  </section>
                )}
              </aside>
            </div>
          )}
        </div>
      </main>
      {drawer && (
        <SidePanel
          title={
            drawer === "project" ? "New project" : "Brand & global colours"
          }
          onClose={() => setDrawer(null)}
        >
          {drawer === "project" ? projectForm : brandForm}
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {status && <p role="status">{status}</p>}
        </SidePanel>
      )}
      {conversionPreview && (
        <ConversionPreview
          source={conversionSource}
          status={status}
          error={error}
          busy={busy}
          onCancelBuild={() => buildController.current?.abort()}
          onClose={() => setConversionPreview(false)}
        />
      )}
      {live && current && (
        <LiveWorkspace
          key={active}
          initialCompare={compare}
          design={current.design}
          preview={current.preview}
          screenshot={current.screenshot}
          onClose={() => setLive(false)}
          onSave={(design, preview) =>
            setResults((prev) =>
              prev.map((r, i) =>
                i === active
                  ? { ...r, design, preview, template: undefined }
                  : r,
              ),
            )
          }
        />
      )}
    </div>
  );
}
