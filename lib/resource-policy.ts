import { privateAccessConfigured } from "./access-policy";
import { normalizeUrl } from "./network";

/** Direct URL capture in the private workspace; network/robots checks are independent. */
export function assertCaptureAccess(url: string, env: Record<string,string|undefined> = process.env) {
  normalizeUrl(url);
  if (env.NODE_ENV === "production" && !privateAccessConfigured(env))
    throw new Error("Website capture needs a private workspace. Ask the owner to finish access setup, or start with a client brief.");
}
export function serverBudget(requested: number, env: Record<string,string|undefined> = process.env) {
  const configured = Number(env.AI_MAX_REQUEST_USD || "0.25");
  if(!Number.isFinite(configured)||configured<0||configured>50) throw new Error("Invalid server AI_MAX_REQUEST_USD setting.");
  return Math.min(requested, configured);
}
export function assertServerAiAccess(env: Record<string,string|undefined> = process.env) {
  if(env.NODE_ENV === "production" && !privateAccessConfigured(env))
    throw new Error("Server-funded AI is disabled on a public app. Configure private workspace access or use your own API connection.");
}
