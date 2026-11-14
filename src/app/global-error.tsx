"use client";

/* Last resort when the root layout itself fails: plain HTML, no app styles. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#111113", color: "#f1f1f3" }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <div style={{ fontSize: 56, fontWeight: 700, color: "#f43f5e" }}>500</div>
          <h1 style={{ fontSize: 20, margin: "12px 0 8px" }}>Internal server error</h1>
          <p style={{ fontSize: 14, opacity: 0.7 }}>Something went wrong while loading FactoryFlow.</p>
          {error.digest && <p style={{ fontSize: 12, opacity: 0.5, fontFamily: "monospace" }}>Error ID: {error.digest}</p>}
          <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, border: 0, background: "#7c3aed", color: "#fff", cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
