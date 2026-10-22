import { emailLoginReady } from "@/lib/access-policy";
import LoginForm from "./login-form";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <main className="auth-screen">
      <div className="auth-heading">
        <span className="auth-mark">E</span>
        <h1>Your private workspace</h1>
        <p>Sign in with your approved email to continue.</p>
      </div>
      {emailLoginReady() ? (
        <LoginForm />
      ) : (
        <div className="auth-notice">
          Email login is awaiting its one-time connection. Your existing app
          password is still active.
          <br />
          <a href="/">Back to workspace</a>
        </div>
      )}
    </main>
  );
}
