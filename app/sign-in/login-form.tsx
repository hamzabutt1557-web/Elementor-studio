"use client";
import { useEffect, useState, type FormEvent } from "react";
export default function LoginForm() {
  const [email, setEmail] = useState(""),
    [token, setToken] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(sent ? "/api/auth/verify" : "/api/auth/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Unable to sign in. Try again.");
      if (sent) {
        window.location.assign("/");
        return;
      }
      setSent(true);
      setCooldown(60);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to sign in. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="auth-notice auth-form" onSubmit={submit}>
      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        value={email}
        readOnly={sent}
        onChange={(e) => setEmail(e.target.value)}
      />
      {sent && (
        <>
          <p role="status">Enter the code from your email. Check Spam too.</p>
          <label htmlFor="login-code">Verification code</label>
          <input
            id="login-code"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6,10}"
            required
            minLength={6}
            maxLength={10}
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
          />
        </>
      )}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" type="submit" disabled={busy}>
        {busy
          ? "Please wait…"
          : sent
            ? "Verify & open workspace"
            : "Send verification code"}
      </button>
      {sent && (
        <div className="auth-alternatives">
          <button
            type="button"
            className="quiet"
            disabled={busy}
            onClick={() => {
              setSent(false);
              setToken("");
              setError("");
            }}
          >
            Change email
          </button>
          <button
            type="button"
            className="quiet"
            disabled={busy || cooldown > 0}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await fetch("/api/auth/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error || "Unable to resend.");
                setCooldown(60);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to resend.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {cooldown ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      )}
    </form>
  );
}
