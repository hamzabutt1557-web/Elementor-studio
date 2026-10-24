import { buildCapacity } from "@/lib/build-capacity";
import { ownerApiAccess } from "@/lib/owner-access";
import { apiProviderSchema } from "@/lib/api-provider";
import { briefDesign, nodeCount } from "@/lib/design";
import { crawl } from "@/lib/crawler";
import { refine, ProviderFailure } from "@/lib/provider";
import { previewHtml, toElementor } from "@/lib/elementor";
import { errorResponse, readBody, sameOrigin } from "@/lib/api";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(req: Request) {
  const denied = await ownerApiAccess(req);
  if (denied) return denied;
  try {
    sameOrigin(req);
    const body = await readBody(req, 18000);
    if (
      !["url", "brief"].includes(body.route) ||
      !["none", "free", "paid"].includes(body.mode)
    )
      throw new Error("Choose a valid build mode.");
    if (
      typeof body.input !== "string" ||
      !body.input.trim() ||
      body.input.length > 12000
    )
      throw new Error("Enter a URL or a brief of up to 12,000 characters.");
    const connection = body.connection
      ? apiProviderSchema.parse(body.connection)
      : undefined;
    const controller = new AbortController();
    const deadline = AbortSignal.timeout(110000);
    const signal = AbortSignal.any([req.signal, controller.signal, deadline]);
    const run = async (progress: (message: string) => void) => {
      const release = await buildCapacity.acquire(signal, () => progress("Waiting for an available conversion slot…"));
      try {
      signal.throwIfAborted();
      progress("Starting conversion…");
      let capture;
      if (body.route === "brief") {
        capture = {
          design: briefDesign(
            body.input,
            String(body.title || "").slice(0, 200),
            String(body.type || "business"),
          ),
          screenshot: "",
          capture: "brief",
        };
      } else {
        capture = await crawl(body.input, progress, signal);
      }
      let design = capture.design;
      let usage: {
        input: number;
        output: number;
        total: number;
        requests: number;
        cost: number | null;
        exact: boolean;
        model: string;
        reservedCost: number;
      } = {
        input: 0,
        output: 0,
        total: 0,
        requests: 0,
        cost: 0,
        exact: true,
        model: "No AI API",
        reservedCost: 0,
      };
      if (body.mode !== "none") {
        progress("Refining editable styles with AI…");
        try {
          const cap = Number(body.budget);
          if (!Number.isFinite(cap) || cap < 0 || cap > 50)
            throw new Error("Set a budget between $0 and $50.");
          const ai = await refine(design, cap, connection, signal);
          design = ai.design;
          usage = ai.usage;
        } catch (e) {
          if (e instanceof ProviderFailure) usage = e.usage;
          design.warnings.push(
            e instanceof Error
              ? e.message
              : "AI unavailable. No-AI draft preserved.",
          );
        }
      }
      signal.throwIfAborted();
      progress("Preparing preview…");
      return {
        ...capture,
        design,
        usage,
        preview: previewHtml(design),
        ...(body.includeTemplate !== false
          ? { template: toElementor(design) }
          : {}),
        checks: {
          structure: "passed",
          nativeWidgets: nodeCount(design),
          wordpressImport: "Not tested",
          similarity: "Not measured",
          store: "Not connected",
        },
      };
      } finally { release(); }
    };
    if (req.headers.get("accept")?.includes("application/x-ndjson")) {
      let cancelled = false;
      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream({
          async start(streamController) {
            const send = (event: unknown) => {
              if (!cancelled)
                streamController.enqueue(
                  encoder.encode(JSON.stringify(event) + "\n"),
                );
            };
            const heartbeat = setInterval(() => send({ type: "heartbeat" }), 10000);
            try {
              const result = await run((message) =>
                send({ type: "progress", message }),
              );
              send({ type: "result", result });
            } catch (error) {
              const detail = await errorResponse(error).json();
              send({ type: "error", message: signal.aborted ? (deadline.aborted ? "Conversion reached its time limit. No automatic retry was made." : "Conversion cancelled.") : detail.error });
            } finally {
              clearInterval(heartbeat);
              if (!cancelled) streamController.close();
            }
          },
          cancel() {
            cancelled = true;
            controller.abort();
          },
        }),
        {
          headers: {
            "Content-Type": "application/x-ndjson",
            "Cache-Control": "no-store, no-transform",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    return Response.json(await run(() => {}));
  } catch (e) {
    return errorResponse(e);
  }
}
