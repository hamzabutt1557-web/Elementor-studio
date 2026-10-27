import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { emailLoginEnabled } from "./access-policy";
export const PASSWORD_COOKIE = "studio_password_session";
export const PASSWORD_SESSION_SECONDS = 8 * 60 * 60;
type Env = Record<string, string | undefined>;
const equal = (a: string, b: string) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
export function passwordMatches(value: unknown, env: Env = process.env) {
  return (
    !emailLoginEnabled(env) &&
    !!env.APP_PASSWORD &&
    typeof value === "string" &&
    value.length <= 1024 &&
    equal(value, env.APP_PASSWORD)
  );
}
export function issuePasswordSession(env: Env = process.env, now = Date.now()) {
  if (!env.APP_PASSWORD || emailLoginEnabled(env))
    throw new Error("Password login unavailable");
  const payload = `v1.${Math.floor(now / 1000) + PASSWORD_SESSION_SECONDS}.${randomBytes(24).toString("hex")}`;
  return (
    payload +
    "." +
    createHmac("sha256", env.APP_PASSWORD)
      .update("studio-password-session:" + payload)
      .digest("hex")
  );
}
export function passwordSessionAccess(
  cookie: string | null,
  env: Env = process.env,
  now = Date.now(),
) {
  if (
    !env.APP_PASSWORD ||
    emailLoginEnabled(env) ||
    !cookie ||
    cookie.length > 8192
  )
    return false;
  const value = cookie
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(PASSWORD_COOKIE + "="))
    ?.slice(PASSWORD_COOKIE.length + 1);
  if (!value || !/^v1\.\d{10,12}\.[a-f0-9]{48}\.[a-f0-9]{64}$/.test(value))
    return false;
  const parts = value.split("."),
    expires = Number(parts[1]),
    seconds = Math.floor(now / 1000);
  if (expires <= seconds || expires > seconds + PASSWORD_SESSION_SECONDS)
    return false;
  const payload = parts.slice(0, 3).join(".");
  return equal(
    parts[3],
    createHmac("sha256", env.APP_PASSWORD)
      .update("studio-password-session:" + payload)
      .digest("hex"),
  );
}
