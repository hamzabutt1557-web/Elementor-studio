import { responseError } from "./client-api";
/** One build, no retries. Deadline covers the whole streamed body. */
export async function streamBuild<T>(
  body: unknown,
  progress: (message: string) => void,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 130000);
  try {
    const response = await fetch("/api/build", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw await responseError(response);
    if (!response.body) throw new Error("Conversion response is empty.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        if (pending.length > 32_000_000)
          throw new Error("Conversion response is too large.");
        let end;
        while ((end = pending.indexOf("\n")) >= 0) {
          const line = pending.slice(0, end);
          pending = pending.slice(end + 1);
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "progress" && typeof event.message === "string")
            progress(event.message);
          if (event.type === "error")
            throw new Error(event.message || "Conversion failed.");
          if (event.type === "result") return event.result as T;
        }
        if (done)
          throw new Error(
            "Conversion ended before the draft was ready. No automatic retry was made.",
          );
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("Conversion timed out. No automatic retry was made.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
