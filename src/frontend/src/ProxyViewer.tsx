import { AlertTriangle, Globe, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useActor } from "./hooks/useActor";

function stripAntiEmbedHeaders(html: string): string {
  // Remove X-Frame-Options and Content-Security-Policy meta http-equiv tags
  return html
    .replace(/<meta[^>]+http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, "")
    .replace(
      /<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi,
      "",
    );
}

function injectBase(html: string, targetUrl: string): string {
  if (html.toLowerCase().includes("<base")) return html;
  return html.replace(
    /<head([^>]*)>/i,
    `<head$1><base href="${targetUrl}" target="_blank">`,
  );
}

export function ProxyViewer() {
  const { actor, isFetching } = useActor();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [srcDoc, setSrcDoc] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const hash = window.location.hash;
  const targetUrl = (() => {
    const prefix = "#proxy?url=";
    if (!hash.startsWith(prefix)) return "";
    try {
      return decodeURIComponent(hash.slice(prefix.length));
    } catch {
      return hash.slice(prefix.length);
    }
  })();

  useEffect(() => {
    if (!targetUrl) {
      setErrorMsg("No URL provided.");
      setStatus("error");
      return;
    }
    if (isFetching || !actor) return;

    let cancelled = false;

    async function fetchPage() {
      setStatus("loading");
      try {
        const raw = await actor!.getURL(targetUrl);
        if (cancelled) return;
        let html = stripAntiEmbedHeaders(raw);
        html = injectBase(html, targetUrl);
        setSrcDoc(html);
        setStatus("done");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to fetch the page.",
        );
        setStatus("error");
      }
    }

    fetchPage();
    return () => {
      cancelled = true;
    };
  }, [actor, isFetching, targetUrl]);

  if (status === "done") {
    return (
      <iframe
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
        allow="autoplay; fullscreen; microphone; camera"
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          border: "none",
          display: "block",
        }}
        title="ProxShell Viewer"
      />
    );
  }

  const isError = status === "error";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f1117",
        color: "#e2e8f0",
        gap: "1.5rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Green glow orb */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(34,197,94,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isError ? (
          <AlertTriangle style={{ width: 28, height: 28, color: "#ef4444" }} />
        ) : (
          <Globe
            style={{
              width: 28,
              height: 28,
              color: "#22c55e",
              animation: "spin 2s linear infinite",
            }}
          />
        )}
      </div>

      <div style={{ textAlign: "center", maxWidth: 400, padding: "0 1rem" }}>
        {isError ? (
          <>
            <p
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "#ef4444",
                marginBottom: "0.5rem",
              }}
            >
              Failed to load page
            </p>
            <p style={{ fontSize: "0.875rem", color: "#94a3b8" }}>{errorMsg}</p>
            <p
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
                marginTop: "0.5rem",
              }}
            >
              Some sites block server-side fetching. Try another URL.
            </p>
          </>
        ) : (
          <>
            <p
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "#22c55e",
                marginBottom: "0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              <Loader2
                style={{
                  width: 18,
                  height: 18,
                  animation: "spin 1s linear infinite",
                }}
              />
              Fetching via proxy...
            </p>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#64748b",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {targetUrl}
            </p>
          </>
        )}
      </div>

      <style>
        {
          "@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"
        }
      </style>
    </div>
  );
}
