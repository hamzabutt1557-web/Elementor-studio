/** Browser requests are never automatically retried: a build may use a paid API. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}
export async function responseError(
  response: Response,
): Promise<ApiRequestError> {
  let detail = "";
  try {
    const body = await response.json();
    if (typeof body?.error === "string") detail = body.error.slice(0, 600);
  } catch {}
  const status = response.status;
  if (status === 401)
    return new ApiRequestError(
      "Your login has expired. Reload the app and sign in again. Your saved drafts stay in this browser.",
      status,
    );
  if (status === 403)
    return new ApiRequestError(
      detail || "This account does not have access to this action.",
      status,
    );
  if (status === 429)
    return new ApiRequestError(
      "Too many requests. Please wait before trying again. No automatic retry was made.",
      status,
    );
  if (status === 413)
    return new ApiRequestError(
      "This request is too large. Try one page or a smaller image.",
      status,
    );
  if (status === 502 || status === 504)
    return new ApiRequestError(
      "The server did not finish in time. Your saved drafts are safe. Check the current build before starting another.",
      status,
    );
  return new ApiRequestError(
    detail ||
      "The server could not complete this request. Try again after checking your connection.",
    status,
  );
}
export async function requestResponse(
  path: string,
  init: RequestInit = {},
  timeoutMs = 45000,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const external = init.signal;
  const abort = () => controller.abort(external?.reason);
  if (external?.aborted) abort();
  else external?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetcher(path, {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) throw await responseError(response);
    return response;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (external?.aborted) throw error;
    if (timedOut)
      throw new ApiRequestError(
        "This request took too long. Your saved drafts are safe. No automatic retry was made.",
      );
    throw new ApiRequestError(
      "Connection lost. Check your internet connection, then try again. Your saved drafts are safe.",
    );
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", abort);
  }
}
export async function requestJson<T = any>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 45000,
): Promise<T> {
  const response = await requestResponse(path, init, timeoutMs);
  try {
    return await response.json();
  } catch {
    throw new ApiRequestError(
      "The server returned an incomplete response. Your saved drafts are safe.",
    );
  }
}
