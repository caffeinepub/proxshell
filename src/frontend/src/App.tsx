import { Toaster } from "@/components/ui/sonner";
import {
  Gamepad2,
  Globe,
  Keyboard,
  Loader2,
  Moon,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { GamesSidebar } from "./GamesSidebar";
import { useIsMobile } from "./hooks/use-mobile";
import { useActor } from "./hooks/useActor";

// Particle canvas component
function ParticleCanvas({ darkMode }: { darkMode: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    interface Particle {
      x: number;
      y: number;
      r: number;
      speed: number;
      drift: number;
      opacity: number;
      phase: number;
    }

    const count = 80;
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 2 + Math.random() * 4,
      speed: 0.3 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 0.4,
      opacity: 0.15 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.008;

      for (const p of particles) {
        p.y -= p.speed;
        p.x += p.drift + Math.sin(t + p.phase) * 0.3;

        if (p.y + p.r < 0) {
          p.y = canvas.height + p.r;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -p.r) p.x = canvas.width + p.r;
        if (p.x > canvas.width + p.r) p.x = -p.r;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        const alpha = Math.floor(p.opacity * (darkMode ? 0.5 : 1) * 255)
          .toString(16)
          .padStart(2, "0");
        ctx.fillStyle = `#22c55e${alpha}`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [darkMode]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: "transparent" }}
    />
  );
}

function openIframeTab(targetUrl: string) {
  let url = targetUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  const newTab = window.open("about:blank", "_blank");
  if (!newTab) return;

  const html = `<!DOCTYPE html>
<html style="margin:0;padding:0;height:100%;width:100%;">
<head>
  <meta charset="UTF-8" />
  <title>${url}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <iframe src="${url}" allowfullscreen allow="autoplay; fullscreen; microphone; camera"></iframe>
</body>
</html>`;

  newTab.document.open();
  newTab.document.write(html);
  newTab.document.close();
}

export default function App() {
  const isMobile = useIsMobile();
  const { actor, isFetching: actorFetching } = useActor();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("google.com");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("proxshell-dark") === "true";
    } catch {
      return false;
    }
  });
  const [panicKey, setPanicKey] = useState(() => {
    try {
      return localStorage.getItem("proxshell-panic-key") || "";
    } catch {
      return "";
    }
  });
  const [pendingPanicKey, setPendingPanicKey] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const panicInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem("proxshell-dark", String(darkMode));
    } catch {
      /* ignore */
    }
  }, [darkMode]);

  // Global panic key listener
  useEffect(() => {
    if (isMobile || !panicKey) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === panicKey) {
        window.location.href = "https://classroom.google.com/";
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panicKey, isMobile]);

  const handleNavigate = async () => {
    const raw = urlInput.trim();
    if (!raw) return;

    let url = raw;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    // If actor is ready, use the backend proxy
    if (actor && !actorFetching) {
      setIsLoading(true);
      try {
        const html = await actor.getURL(url);

        // Inject <base href> after <head> if not present
        let proxiedHtml = html;
        if (!proxiedHtml.includes("<base")) {
          proxiedHtml = proxiedHtml.replace(
            /<head([^>]*)>/i,
            `<head$1><base href="${url}" target="_blank">`,
          );
        }

        const newTab = window.open("about:blank", "_blank");
        if (newTab) {
          newTab.document.open();
          newTab.document.write(proxiedHtml);
          newTab.document.close();
        }
      } catch (err) {
        console.error("Proxy fetch failed, falling back to iframe:", err);
        openIframeTab(url);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Fallback: open as iframe
      openIframeTab(url);
    }

    setUrlInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNavigate();
    }
  };

  const handlePanicKeyCapture = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
    setPendingPanicKey(e.key);
    setIsCapturing(false);
    panicInputRef.current?.blur();
  };

  const savePanicKey = () => {
    if (!pendingPanicKey) return;
    try {
      localStorage.setItem("proxshell-panic-key", pendingPanicKey);
    } catch {
      /* ignore */
    }
    setPanicKey(pendingPanicKey);
  };

  const clearPanicKey = () => {
    try {
      localStorage.removeItem("proxshell-panic-key");
    } catch {
      /* ignore */
    }
    setPanicKey("");
    setPendingPanicKey("");
  };

  const bg = darkMode ? "#0f1117" : "#ffffff";
  const text = darkMode ? "#e2e8f0" : "#1a1a1a";
  const muted = darkMode ? "#64748b" : "#6b7280";
  const cardBg = darkMode ? "#1e2330" : "#ffffff";
  const borderColor = darkMode ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.25)";
  const inputBg = darkMode ? "#1e2330" : "#ffffff";

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        background: bg,
        color: text,
        transition: "background 0.3s, color 0.3s",
      }}
    >
      <ParticleCanvas darkMode={darkMode} />

      {/* Games Sidebar */}
      <GamesSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onGameClick={(gameUrl) => {
          window.open(gameUrl, "_blank", "noopener,noreferrer");
        }}
      />

      {/* Header */}
      <header className="relative z-10 pt-10 pb-2 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          {/* Games toggle button — top left */}
          <button
            type="button"
            data-ocid="games.sidebar.toggle"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: "rgba(34,197,94,0.1)",
              color: "#22c55e",
              border: "1px solid rgba(34,197,94,0.25)",
            }}
            title="Browse Games"
          >
            <Gamepad2 className="w-4 h-4" />
            <span className="hidden sm:inline">Games</span>
          </button>

          {/* Settings button — top right */}
          <button
            type="button"
            data-ocid="settings.open_modal_button"
            onClick={() => setSettingsOpen(true)}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: "rgba(34,197,94,0.1)",
              color: "#22c55e",
              border: "1px solid rgba(34,197,94,0.25)",
            }}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          <h1
            className="font-display text-5xl font-bold tracking-tight"
            style={{ color: "#22c55e" }}
          >
            ProxShell
          </h1>
          <p
            className="mt-1 text-sm font-sans tracking-widest uppercase"
            style={{ color: muted }}
          >
            Proxy Browser
          </p>
        </motion.div>
      </header>

      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-4 py-12 flex flex-col gap-8 items-center">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full"
          aria-label="URL Navigation"
        >
          <div
            className="flex items-center gap-3 px-4 py-3.5 rounded-full border"
            style={{
              background: inputBg,
              borderColor,
              boxShadow: darkMode
                ? "0 0 0 1px rgba(34,197,94,0.1)"
                : "0 2px 12px rgba(34,197,94,0.08)",
            }}
          >
            <Globe
              className="w-5 h-5 flex-shrink-0"
              style={{ color: "#22c55e" }}
            />
            <input
              ref={inputRef}
              data-ocid="url.input"
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="type a url"
              className="flex-1 bg-transparent text-base outline-none"
              style={{ color: text }}
              spellCheck={false}
              autoComplete="off"
              disabled={isLoading}
            />
            <button
              type="button"
              data-ocid="url.submit_button"
              onClick={handleNavigate}
              disabled={!urlInput.trim() || isLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-white text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#22c55e" }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                "Go"
              )}
            </button>
          </div>
          <p className="text-center mt-4 text-xs" style={{ color: muted }}>
            {isLoading
              ? "Fetching page via proxy..."
              : "Press Enter or click Go to open the site through the proxy"}
          </p>
        </motion.section>

        {/* Empty state hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.6 } }}
          className="flex flex-col items-center gap-3 text-center mt-4"
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            <Globe
              className="w-6 h-6"
              style={{ color: "rgba(34,197,94,0.5)" }}
            />
          </div>
          <p className="text-sm" style={{ color: muted }}>
            Type any website URL and browse freely via the proxy
          </p>
        </motion.div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              data-ocid="settings.modal"
              className="rounded-2xl p-6 shadow-2xl"
              style={{
                background: cardBg,
                border: `1px solid ${borderColor}`,
                color: text,
                width: isMobile ? "calc(100vw - 2rem)" : "22rem",
                maxWidth: "22rem",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Settings</h2>
                <button
                  type="button"
                  data-ocid="settings.close_button"
                  onClick={() => setSettingsOpen(false)}
                  className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                  style={{ color: muted }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Dark / Light Mode Toggle */}
              <div
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{
                  background: darkMode
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(34,197,94,0.05)",
                  border: `1px solid ${borderColor}`,
                }}
              >
                <div className="flex items-center gap-3">
                  {darkMode ? (
                    <Moon className="w-4 h-4" style={{ color: "#22c55e" }} />
                  ) : (
                    <Sun className="w-4 h-4" style={{ color: "#22c55e" }} />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {darkMode ? "Dark Mode" : "Light Mode"}
                    </p>
                    <p className="text-xs" style={{ color: muted }}>
                      Switch appearance
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-ocid="settings.darkmode.toggle"
                  onClick={() => setDarkMode((d) => !d)}
                  className="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
                  style={{ background: darkMode ? "#22c55e" : "#d1d5db" }}
                  aria-label="Toggle dark mode"
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                    style={{
                      transform: darkMode
                        ? "translateX(20px)"
                        : "translateX(0)",
                    }}
                  />
                </button>
              </div>

              {/* Panic Key — desktop only */}
              {!isMobile && (
                <div
                  className="mt-4 px-4 py-3 rounded-xl"
                  style={{
                    background: darkMode
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(34,197,94,0.05)",
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Keyboard
                      className="w-4 h-4"
                      style={{ color: "#22c55e" }}
                    />
                    <p className="text-sm font-semibold">Panic Key</p>
                    <span
                      className="ml-auto text-xs px-1.5 py-0.5 rounded-md font-medium"
                      style={{
                        background: "rgba(34,197,94,0.12)",
                        color: "#22c55e",
                      }}
                    >
                      Desktop only
                    </span>
                  </div>
                  <p className="text-xs mb-3" style={{ color: muted }}>
                    Press this key anywhere to instantly go to Google Classroom.
                  </p>

                  {/* Active saved key indicator */}
                  {panicKey && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs" style={{ color: muted }}>
                        Active:
                      </span>
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold"
                        style={{
                          background: "rgba(34,197,94,0.15)",
                          border: "1px solid rgba(34,197,94,0.4)",
                          color: "#22c55e",
                          boxShadow: "0 2px 0 rgba(34,197,94,0.3)",
                        }}
                      >
                        {panicKey}
                      </span>
                      <button
                        type="button"
                        data-ocid="settings.panic_key.delete_button"
                        onClick={clearPanicKey}
                        className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-opacity hover:opacity-70"
                        style={{
                          color: "#ef4444",
                          background: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.2)",
                        }}
                      >
                        <X className="w-3 h-3" />
                        Clear
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        ref={panicInputRef}
                        data-ocid="settings.panic_key.input"
                        type="text"
                        readOnly
                        value=""
                        placeholder={
                          isCapturing
                            ? "Press any key..."
                            : pendingPanicKey
                              ? `"`
                              : "Click and press a key..."
                        }
                        onFocus={() => setIsCapturing(true)}
                        onBlur={() => setIsCapturing(false)}
                        onKeyDown={handlePanicKeyCapture}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                        style={{
                          background: inputBg,
                          border: isCapturing
                            ? "1px solid #22c55e"
                            : `1px solid ${borderColor}`,
                          color: text,
                          boxShadow: isCapturing
                            ? "0 0 0 2px rgba(34,197,94,0.15)"
                            : "none",
                          transition: "border 0.15s, box-shadow 0.15s",
                        }}
                      />
                      {/* Show pending key as a badge overlay */}
                      {pendingPanicKey && !isCapturing && (
                        <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-bold"
                            style={{
                              background: "rgba(34,197,94,0.15)",
                              border: "1px solid rgba(34,197,94,0.4)",
                              color: "#22c55e",
                              boxShadow: "0 2px 0 rgba(34,197,94,0.25)",
                            }}
                          >
                            {pendingPanicKey}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      data-ocid="settings.panic_key.save_button"
                      onClick={savePanicKey}
                      disabled={!pendingPanicKey}
                      className="px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "#22c55e" }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer
        className="relative z-10 border-t mt-auto"
        style={{ borderColor: "rgba(34,197,94,0.15)" }}
      >
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-xs" style={{ color: muted }}>
            ProxShell &mdash; Private Proxy Browser
          </span>
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs transition-colors hover:opacity-80"
            style={{ color: muted }}
          >
            &copy; {new Date().getFullYear()} Built with ♥ using caffeine.ai
          </a>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}
