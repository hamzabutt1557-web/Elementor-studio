import { emailLoginReady } from "@/lib/access-policy";
import PasswordForm from "./password-form";
import { emailLoginEnabled } from "@/lib/access-policy";
import LoginForm from "./login-form";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <main className="auth-screen">
      <div className="auth-heading">
        <span className="auth-mark">E</span>
        <h1>Your private workspace</h1>
        <p>
          {emailLoginEnabled()
            ? "Sign in with your approved email to continue."
            : "Enter your app password to open Elementor Studio."}
        </p>
      </div>
      {emailLoginReady() ? (
        <LoginForm />
      ) : !emailLoginEnabled() && process.env.APP_PASSWORD ? (
        <PasswordForm />
      ) : (
        <div className="auth-notice">
          Sign-in setup is incomplete. Contact the workspace owner.
        </div>
      )}
    </main>
  );
}
