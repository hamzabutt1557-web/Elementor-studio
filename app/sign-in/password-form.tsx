"use client";
import { useState, type FormEvent } from "react";
export default function PasswordForm() {
  const [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to sign in.");
      window.location.replace("/");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to sign in. Please try again.",
      );
      setBusy(false);
    }
  }
  return (
    <form className="auth-notice auth-form" onSubmit={submit}>
      <label htmlFor="app-password">App password</label>
      <input
        id="app-password"
        name="password"
        type={show ? "text" : "password"}
        autoComplete="current-password"
        required
        maxLength={1024}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        type="button"
        className="quiet"
        aria-pressed={show}
        onClick={() => setShow(!show)}
      >
        {show ? "Hide password" : "Show password"}
      </button>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Opening workspace…" : "Open workspace"}
      </button>
      <p>Use your existing app password. No username is needed.</p>
    </form>
  );
}
