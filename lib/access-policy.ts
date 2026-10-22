import { createHash, timingSafeEqual } from "node:crypto";
type Env = Record<string, string | undefined>;
export function emailLoginEnabled(env: Env = process.env) {
  return env.AUTH_MODE === "email";
}
export function ownerEmail(env: Env = process.env) {
  return (env.OWNER_EMAIL || "").trim().toLowerCase();
}
export function emailLoginReady(env: Env = process.env) {
  if (
    !emailLoginEnabled(env) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail(env)) ||
    !env.SUPABASE_PUBLISHABLE_KEY
  )
    return false;
  try {
    const url = new URL(env.SUPABASE_URL || "");
    return (
      url.protocol === "https:" &&
      /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) &&
      url.pathname === "/" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
export function privateAccessConfigured(env: Env = process.env) {
  return emailLoginEnabled(env) ? emailLoginReady(env) : !!env.APP_PASSWORD;
}
export type VerifiedUser = {
  email?: string;
  email_confirmed_at?: string;
  is_anonymous?: boolean;
};
export function isOwner(user: VerifiedUser | null, env: Env = process.env) {
  return (
    !!user &&
    !user.is_anonymous &&
    !!user.email_confirmed_at &&
    !!ownerEmail(env) &&
    user.email?.trim().toLowerCase() === ownerEmail(env)
  );
}
export function basicAccess(
  authorization: string | null,
  env: Env = process.env,
) {
  if (!env.APP_PASSWORD || !authorization?.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString();
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    const hash = (s: string) => createHash("sha256").update(s).digest();
    return timingSafeEqual(
      hash(decoded.slice(separator + 1)),
      hash(env.APP_PASSWORD),
    );
  } catch {
    return false;
  }
}
