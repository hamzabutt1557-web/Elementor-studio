import { isOwner, ownerEmail, type VerifiedUser } from "./access-policy";
export type LoginAuth = {
  signInWithOtp(input: {
    email: string;
    options: { shouldCreateUser: boolean };
  }): Promise<{ error: { status?: number } | null }>;
  verifyOtp(input: {
    email: string;
    token: string;
    type: "email";
  }): Promise<{
    data: { user: VerifiedUser | null };
    error: { status?: number } | null;
  }>;
  signOut(input?: { scope: "local" }): Promise<unknown>;
};
export async function ownerLogin(
  action: "send" | "verify",
  body: Record<string, unknown>,
  auth: LoginAuth,
  env: Record<string, string | undefined> = process.env,
) {
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email !== ownerEmail(env))
    return { status: 403, error: "This email does not have workspace access." };
  if (action === "send") {
    const { error } = await auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error)
      return {
        status: error.status === 429 ? 429 : 503,
        error:
          error.status === 429
            ? "Too many code requests. Please wait before trying again."
            : "Unable to send the code. Check the email connection and try again.",
      };
    return { status: 200 };
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!/^\d{6,10}$/.test(token))
    return {
      status: 400,
      error: "Enter the verification code from your email.",
    };
  const { data, error } = await auth.verifyOtp({ email, token, type: "email" });
  if (error)
    return {
      status: error.status === 429 ? 429 : 400,
      error:
        error.status === 429
          ? "Too many attempts. Please wait before trying again."
          : "The code is invalid or expired. Request a new one.",
    };
  if (!isOwner(data.user, env)) {
    await auth.signOut({ scope: "local" });
    return {
      status: 403,
      error: "This account does not have workspace access.",
    };
  }
  return { status: 200 };
}
