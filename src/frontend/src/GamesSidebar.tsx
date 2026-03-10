import { Gamepad2, Loader2, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

const HTML_URL = "https://cdn.jsdelivr.net/gh/gn-math/html@main";
const COVER_URL = "https://cdn.jsdelivr.net/gh/gn-math/covers@main";
const ZONES_URL = "https://cdn.jsdelivr.net/gh/gn-math/assets@main/zones.json";

const HIDDEN_GAMES = [
  "request games",
  "commented game",
  "suggest games",
  "comments",
];

function isHidden(name: string): boolean {
  // Strip leading [!] prefix and trim before comparing
  const normalized = name
    .toLowerCase()
    .replace(/^\[!\]\s*/, "")
    .trim();
  return HIDDEN_GAMES.some((h) => normalized === h || normalized.startsWith(h));
}

interface Zone {
  id: number;
  name: string;
  url: string;
  cover: string;
  author?: string;
  authorLink?: string;
  featured?: boolean;
  special?: string[];
}

function resolveUrl(url: string): string {
  return url.replace("{HTML_URL}", HTML_URL).replace("{COVER_URL}", COVER_URL);
}

function resolveCover(cover: string): string {
  return cover
    .replace("{COVER_URL}", COVER_URL)
    .replace("{HTML_URL}", HTML_URL);
}

async function openGame(zone: Zone) {
  const url = resolveUrl(zone.url);
  if (zone.url.startsWith("http")) {
    window.open(zone.url, "_blank", "noopener,noreferrer");
    return;
  }
  // Fetch HTML and write to about:blank
  const newWindow = window.open("", "_blank");
  if (!newWindow) return;
  try {
    const res = await fetch(`${url}?t=${Date.now()}`);
    const html = await res.text();
    newWindow.document.open();
    newWindow.document.write(
      `<!DOCTYPE html><html><head>
      <style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;overflow:hidden;}iframe{width:100%;height:100%;border:none;}</style>
      </head><body>
      ${html}
      </body></html>`,
    );
    newWindow.document.close();
  } catch {
    newWindow.document.open();
    newWindow.document.write(
      `<html><body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;"><p>Failed to load game.</p></body></html>`,
    );
    newWindow.document.close();
  }
}

interface GamesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onGameClick?: (url: string) => void;
}

export function GamesSidebar({ isOpen, onClose }: GamesSidebarProps) {
  const [search, setSearch] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoadingZones(true);
    setFetchError(false);
    fetch(`${ZONES_URL}?t=${Date.now()}`)
      .then((r) => r.json())
      .then((data: Zone[]) => {
        const visible = data.filter((z) => !isHidden(z.name));
        setZones(visible);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoadingZones(false));
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search.trim()) return zones;
    const q = search.toLowerCase();
    return zones.filter((z) => z.name.toLowerCase().includes(q));
  }, [search, zones]);

  const handleGameClick = async (zone: Zone) => {
    onClose();
    await openGame(zone);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={onClose}
          />

          {/* Sidebar panel */}
          <motion.aside
            key="sidebar"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-72 flex flex-col"
            style={{
              background: "#0f172a",
              borderRight: "1px solid rgba(34,197,94,0.25)",
              boxShadow: "4px 0 32px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div
              className="flex flex-col items-center pt-6 pb-4 px-4 relative"
              style={{ borderBottom: "1px solid rgba(34,197,94,0.15)" }}
            >
              <button
                type="button"
                data-ocid="games.sidebar.close_button"
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
                style={{ color: "rgba(34,197,94,0.6)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(34,197,94,0.1)";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "#22c55e";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "rgba(34,197,94,0.6)";
                }}
                aria-label="Close games sidebar"
              >
                <X className="w-5 h-5" />
              </button>

              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{
                  background: "rgba(34,197,94,0.15)",
                  border: "1px solid rgba(34,197,94,0.3)",
                }}
              >
                <Gamepad2 className="w-5 h-5" style={{ color: "#22c55e" }} />
              </div>

              <h2
                className="text-2xl font-bold tracking-tight"
                style={{
                  color: "#22c55e",
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                }}
              >
                Games
              </h2>

              <p
                className="text-xs italic mt-1 text-center"
                style={{ color: "rgba(34,197,94,0.6)" }}
              >
                Take a browse at our games.
              </p>

              <span
                className="mt-2 text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(34,197,94,0.1)",
                  color: "rgba(34,197,94,0.7)",
                  border: "1px solid rgba(34,197,94,0.2)",
                }}
              >
                {loadingZones ? "Loading..." : `${zones.length} games`}
              </span>
            </div>

            {/* Search */}
            <div
              className="px-3 py-3"
              style={{ borderBottom: "1px solid rgba(34,197,94,0.1)" }}
            >
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(34,197,94,0.2)",
                }}
              >
                <Search
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: "rgba(34,197,94,0.5)" }}
                />
                <input
                  type="text"
                  data-ocid="games.search_input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search games..."
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "#e2e8f0", caretColor: "#22c55e" }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="text-xs"
                    style={{ color: "rgba(34,197,94,0.5)" }}
                  >
                    ✕
                  </button>
                )}
              </div>
              {search && (
                <p
                  className="text-xs mt-1.5 px-1"
                  style={{ color: "rgba(34,197,94,0.5)" }}
                >
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Games list */}
            <div
              className="flex-1 overflow-y-auto py-2 px-2"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(34,197,94,0.3) transparent",
              }}
            >
              {loadingZones ? (
                <div
                  data-ocid="games.loading_state"
                  className="flex flex-col items-center justify-center py-12 gap-3"
                >
                  <Loader2
                    className="w-6 h-6 animate-spin"
                    style={{ color: "#22c55e" }}
                  />
                  <p
                    className="text-xs"
                    style={{ color: "rgba(34,197,94,0.5)" }}
                  >
                    Loading games...
                  </p>
                </div>
              ) : fetchError ? (
                <div
                  data-ocid="games.error_state"
                  className="flex flex-col items-center justify-center py-12 gap-2 px-4 text-center"
                >
                  <p
                    className="text-xs"
                    style={{ color: "rgba(255,100,100,0.7)" }}
                  >
                    Failed to load games. Check your connection.
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div
                  data-ocid="games.empty_state"
                  className="flex flex-col items-center justify-center py-12 gap-2"
                >
                  <Gamepad2
                    className="w-8 h-8"
                    style={{ color: "rgba(34,197,94,0.3)" }}
                  />
                  <p
                    className="text-sm text-center"
                    style={{ color: "rgba(34,197,94,0.5)" }}
                  >
                    No games found
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {filtered.map((zone, i) => (
                    <li key={zone.id}>
                      <button
                        type="button"
                        data-ocid={i < 5 ? `games.item.${i + 1}` : undefined}
                        onClick={() => handleGameClick(zone)}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-3"
                        style={{ color: "#cbd5e1" }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget as HTMLButtonElement;
                          el.style.background = "rgba(34,197,94,0.12)";
                          el.style.color = "#22c55e";
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget as HTMLButtonElement;
                          el.style.background = "transparent";
                          el.style.color = "#cbd5e1";
                        }}
                      >
                        <img
                          src={resolveCover(zone.cover)}
                          alt=""
                          className="w-8 h-8 rounded object-cover flex-shrink-0"
                          style={{ background: "rgba(255,255,255,0.05)" }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                        <span className="truncate">{zone.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-4 py-3 text-center"
              style={{ borderTop: "1px solid rgba(34,197,94,0.1)" }}
            >
              <p className="text-xs" style={{ color: "rgba(34,197,94,0.35)" }}>
                Powered by gn-math
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
