"use client";
import { useState } from "react";
export default function AccountMenu() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <button
        className="quiet"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/auth/sign-out", { method: "POST" });
            if (!r.ok) throw new Error();
            window.location.assign("/sign-in");
          } catch {
            setError("Unable to sign out. Try again.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
