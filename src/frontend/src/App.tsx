import { Toaster } from "@/components/ui/sonner";
import { useActor } from "@/hooks/useActor";
import {
  AlertTriangle,
  CheckCheck,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Send,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Method = "GET" | "POST";
type ResponseType = "html" | "text" | "idle";
type ActiveMode = "search" | "proxy";

interface DDGRelatedTopic {
  Text?: string;
  FirstURL?: string;
  Icon?: { URL?: string };
  Name?: string;
  Topics?: DDGRelatedTopic[];
}

interface DDGResult {
  Text?: string;
  FirstURL?: string;
  Icon?: { URL?: string };
}

interface DDGResponse {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  Answer?: string;
  AnswerType?: string;
  RelatedTopics?: DDGRelatedTopic[];
  Results?: DDGResult[];
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  icon?: string;
}

function detectResponseType(text: string): ResponseType {
  const trimmed = text.trimStart();
  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<!doctype") ||
    trimmed.startsWith("<html") ||
    trimmed.startsWith("<HTML")
  ) {
    return "html";
  }
  return "text";
}

function injectBaseTag(html: string, targetUrl: string): string {
  try {
    const u = new URL(targetUrl);
    const base = `${u.protocol}//${u.host}`;
    const baseTag = `<base href="${base}/">`;
    if (/<head[\s>]/i.test(html)) {
      return html.replace(/(<head[^>]*>)/i, `$1${baseTag}`);
    }
    if (/<html[\s>]/i.test(html)) {
      return html.replace(/(<html[^>]*>)/i, `$1${baseTag}`);
    }
    return baseTag + html;
  } catch {
    return html;
  }
}

function isErrorResponse(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.startsWith("error") ||
    lower.includes("canister error") ||
    lower.includes("rejection") ||
    (lower.includes("failed") && text.length < 300)
  );
}

function extractTitle(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function parseDDGResults(data: DDGResponse): SearchResult[] {
  const results: SearchResult[] = [];

  if (data.Results) {
    for (const r of data.Results) {
      if (r.FirstURL && r.Text) {
        results.push({
          title: extractTitle(r.FirstURL),
          url: r.FirstURL,
          snippet: r.Text,
          icon: r.Icon?.URL || undefined,
        });
      }
    }
  }

  const flatTopics: DDGRelatedTopic[] = [];
  const flatten = (topics: DDGRelatedTopic[]) => {
    for (const t of topics) {
      if (t.Topics && t.Topics.length > 0) {
        flatten(t.Topics);
      } else if (t.FirstURL && t.Text) {
        flatTopics.push(t);
      }
    }
  };
  if (data.RelatedTopics) flatten(data.RelatedTopics);

  for (const t of flatTopics.slice(0, 15)) {
    if (t.FirstURL && t.Text) {
      results.push({
        title: extractTitle(t.FirstURL),
        url: t.FirstURL,
        snippet: t.Text,
        icon: t.Icon?.URL || undefined,
      });
    }
  }

  return results;
}

// Particle canvas component
function ParticleCanvas() {
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
        const alpha = Math.floor(p.opacity * 255)
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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: "transparent" }}
    />
  );
}

export default function App() {
  const { actor, isFetching: actorLoading } = useActor();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null,
  );
  const [searchAbstract, setSearchAbstract] = useState<{
    heading: string;
    text: string;
    url: string;
    answer: string;
  } | null>(null);
  const [searchError, setSearchError] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Proxy state
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<Method>("GET");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [responseType, setResponseType] = useState<ResponseType>("idle");
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [copied, setCopied] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const [activeMode, setActiveMode] = useState<ActiveMode>("search");

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Close fullscreen on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast.error("Enter a search query");
      searchInputRef.current?.focus();
      return;
    }

    setSearchLoading(true);
    setSearchResults(null);
    setSearchAbstract(null);
    setSearchError(false);
    setActiveMode("search");
    setResponse(null);
    setResponseType("idle");
    setIsFullscreen(false);

    try {
      const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1&skip_disambig=1&no_redirect=1`;
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DDGResponse = await res.json();

      const results = parseDDGResults(data);
      setSearchResults(results);

      const hasAbstract = data.AbstractText || data.Answer || data.Heading;
      if (hasAbstract) {
        setSearchAbstract({
          heading: data.Heading || "",
          text: data.AbstractText || data.Answer || "",
          url: data.AbstractURL || "",
          answer: data.Answer || "",
        });
      }

      if (results.length === 0 && !hasAbstract) {
        toast.info("No instant results — try a more specific query");
      } else {
        toast.success(`Found ${results.length} results`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSearchError(true);
      setSearchResults([]);
      toast.error(`Search failed: ${msg}`);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const loadThroughProxy = useCallback(
    async (targetUrl: string) => {
      if (!actor) {
        toast.error("Backend not ready");
        return;
      }
      setLoading(true);
      setResponse(null);
      setIsError(false);
      setActiveMode("proxy");
      setUrl(targetUrl);
      setIsFullscreen(false);

      try {
        const result = await actor.getURL(targetUrl);
        const errored = isErrorResponse(result);
        setIsError(errored);
        const type = errored ? "text" : detectResponseType(result);
        const finalResult =
          !errored && type === "html"
            ? injectBaseTag(result, targetUrl)
            : result;
        setResponse(finalResult);
        setResponseType(type);
        if (errored) {
          toast.error("Request returned an error");
        } else {
          toast.success("Page loaded through proxy");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setIsError(true);
        setResponse(msg);
        setResponseType("text");
        toast.error("Request failed");
      } finally {
        setLoading(false);
      }
    },
    [actor],
  );

  const handleFetch = useCallback(async () => {
    if (!url.trim()) {
      toast.error("Enter a URL first");
      urlInputRef.current?.focus();
      return;
    }
    if (!actor) {
      toast.error("Backend not ready");
      return;
    }

    const targetUrl = url.startsWith("http") ? url : `https://${url}`;
    setLoading(true);
    setResponse(null);
    setIsError(false);
    setActiveMode("proxy");
    setIsFullscreen(false);

    try {
      let result: string;
      if (method === "GET") {
        result = await actor.getURL(targetUrl);
      } else {
        result = await actor.postURL(targetUrl, body);
      }

      const errored = isErrorResponse(result);
      setIsError(errored);
      const type = errored ? "text" : detectResponseType(result);
      const finalResult =
        !errored && type === "html" ? injectBaseTag(result, targetUrl) : result;
      setResponse(finalResult);
      setResponseType(type);

      if (errored) {
        toast.error("Request returned an error");
      } else {
        toast.success("Response received");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setIsError(true);
      setResponse(msg);
      setResponseType("text");
      toast.error("Request failed");
    } finally {
      setLoading(false);
    }
  }, [url, method, body, actor]);

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFetch();
    }
  };

  const handleCopy = async () => {
    if (!response) return;
    await navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const handleReset = () => {
    setUrl("");
    setBody("");
    setResponse(null);
    setResponseType("idle");
    setIsError(false);
    setSearchQuery("");
    setSearchResults(null);
    setSearchAbstract(null);
    setSearchError(false);
    setActiveMode("search");
    setIsFullscreen(false);
    urlInputRef.current?.focus();
  };

  const showSearchResults =
    activeMode === "search" && (searchResults !== null || searchLoading);
  const showProxyResult =
    activeMode === "proxy" && (response !== null || loading);

  return (
    <div className="min-h-screen flex flex-col bg-white relative">
      <ParticleCanvas />

      {/* Fullscreen Overlay */}
      <AnimatePresence>
        {isFullscreen && response !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{ background: "rgba(0,0,0,0.92)" }}
          >
            {/* Fullscreen toolbar */}
            <div
              className="flex items-center justify-between px-4 py-2 flex-shrink-0"
              style={{
                background: "rgba(0,0,0,0.7)",
                borderBottom: "1px solid rgba(34,197,94,0.25)",
              }}
            >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" style={{ color: "#22c55e" }} />
                <span className="text-xs font-mono text-green-400 truncate max-w-xs">
                  {url}
                </span>
                {isError ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/50 text-red-400 border border-red-700">
                    <AlertTriangle className="w-3 h-3" />
                    Error
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                    style={{
                      background: "rgba(34,197,94,0.15)",
                      color: "#4ade80",
                      borderColor: "rgba(34,197,94,0.35)",
                    }}
                  >
                    {responseType === "html" ? "HTML" : "Text"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 hidden sm:block">
                  Press Esc to exit
                </span>
                <button
                  type="button"
                  data-ocid="proxy.fullscreen.close_button"
                  onClick={() => setIsFullscreen(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                  style={{
                    background: "rgba(34,197,94,0.15)",
                    color: "#4ade80",
                    border: "1px solid rgba(34,197,94,0.3)",
                  }}
                  title="Exit fullscreen (Esc)"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </button>
              </div>
            </div>

            {/* Fullscreen content */}
            <div className="flex-1 overflow-hidden">
              {responseType === "html" ? (
                <iframe
                  title="proxy-response-fullscreen"
                  srcDoc={response}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  className="border-0"
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <pre
                  className={`overflow-auto p-6 font-mono text-xs leading-relaxed h-full ${
                    isError ? "text-red-400" : "text-green-300"
                  }`}
                >
                  {response}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="relative z-10 pt-10 pb-2 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1
            className="font-display text-5xl font-bold tracking-tight"
            style={{ color: "#22c55e" }}
          >
            ProxShell
          </h1>
          <p className="mt-1 text-sm font-sans text-muted-foreground tracking-widest uppercase">
            Proxy Search Engine
          </p>
          {actorLoading && (
            <span
              data-ocid="app.loading_state"
              className="inline-flex items-center gap-1 mt-2 text-xs text-muted-foreground"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              connecting...
            </span>
          )}
        </motion.div>
      </header>

      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-8">
        {/* DuckDuckGo Search */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          aria-label="DuckDuckGo Search"
        >
          <div className="flex gap-2">
            <div
              className="flex-1 flex items-center gap-3 px-4 py-3.5 rounded-full bg-white search-shadow border border-border"
              style={{ borderColor: "rgba(34,197,94,0.25)" }}
            >
              <Search
                className="w-5 h-5 flex-shrink-0"
                style={{ color: "#22c55e" }}
              />
              <input
                ref={searchInputRef}
                data-ocid="search.input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search the web privately..."
                className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground outline-none"
                spellCheck={false}
              />
              {searchLoading && (
                <Loader2
                  data-ocid="search.loading_state"
                  className="w-4 h-4 animate-spin flex-shrink-0"
                  style={{ color: "#22c55e" }}
                />
              )}
            </div>
            <button
              type="button"
              data-ocid="search.submit_button"
              onClick={handleSearch}
              disabled={searchLoading || !searchQuery.trim()}
              className="px-6 py-3 rounded-full font-semibold text-white text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed glow-btn"
              style={{ background: "#22c55e" }}
            >
              {searchLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Search"
              )}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-3 px-1">
            {[
              "weather today",
              "latest news",
              "open source projects",
              "best recipes",
            ].map((q) => (
              <button
                type="button"
                key={q}
                onClick={() => {
                  setSearchQuery(q);
                  searchInputRef.current?.focus();
                }}
                className="px-3 py-1 rounded-full text-xs font-medium border transition-colors hover:border-green-400 hover:text-green-600"
                style={{ borderColor: "rgba(34,197,94,0.3)", color: "#4b7a5c" }}
              >
                {q}
              </button>
            ))}
          </div>
        </motion.section>

        {/* Search Results */}
        <AnimatePresence mode="wait">
          {showSearchResults && (
            <motion.section
              key="search-results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              aria-label="Search Results"
              data-ocid="search.list"
            >
              {searchLoading ? (
                <div
                  data-ocid="search.loading_state"
                  className="flex items-center gap-3 px-4 py-4 rounded-xl border"
                  style={{
                    borderColor: "rgba(34,197,94,0.3)",
                    background: "rgba(34,197,94,0.04)",
                  }}
                >
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    style={{ color: "#22c55e" }}
                  />
                  <span className="text-sm" style={{ color: "#16a34a" }}>
                    Searching DuckDuckGo...
                  </span>
                </div>
              ) : searchError ? (
                <div
                  data-ocid="search.error_state"
                  className="flex items-center gap-3 px-4 py-4 rounded-xl border border-red-200 bg-red-50"
                >
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-600">
                    Search failed. DuckDuckGo may be temporarily unavailable.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {searchAbstract &&
                    (searchAbstract.text || searchAbstract.answer) && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border px-5 py-4 bg-white"
                        style={{
                          borderColor: "rgba(34,197,94,0.35)",
                          background: "rgba(34,197,94,0.03)",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Zap
                            className="w-4 h-4"
                            style={{ color: "#22c55e" }}
                          />
                          <span
                            className="text-xs font-bold uppercase tracking-widest"
                            style={{ color: "#16a34a" }}
                          >
                            Instant Answer
                          </span>
                          {searchAbstract.heading && (
                            <span className="font-semibold text-sm text-foreground ml-1">
                              {searchAbstract.heading}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {searchAbstract.text || searchAbstract.answer}
                        </p>
                        {searchAbstract.url && (
                          <a
                            href={searchAbstract.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-xs hover:underline"
                            style={{ color: "#16a34a" }}
                          >
                            <ExternalLink className="w-3 h-3" />
                            {extractTitle(searchAbstract.url)}
                          </a>
                        )}
                      </motion.div>
                    )}

                  {searchResults && searchResults.length > 0 && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {searchResults.length} Related Results
                      </span>
                      <span
                        data-ocid="search.success_state"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                        style={{
                          background: "rgba(34,197,94,0.1)",
                          color: "#16a34a",
                          borderColor: "rgba(34,197,94,0.3)",
                        }}
                      >
                        DuckDuckGo
                      </span>
                    </div>
                  )}

                  {searchResults && searchResults.length > 0
                    ? searchResults.map((result, i) => (
                        <motion.div
                          key={result.url}
                          data-ocid={`search.item.${i + 1}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="group rounded-xl border bg-white px-5 py-4 flex flex-col gap-1.5 transition-shadow hover:shadow-md"
                          style={{ borderColor: "rgba(34,197,94,0.2)" }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              {result.icon &&
                                result.icon !== "//duckduckgo.com/i/" && (
                                  <img
                                    src={`https:${result.icon}`}
                                    alt=""
                                    className="w-4 h-4 rounded flex-shrink-0"
                                    onError={(e) => {
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = "none";
                                    }}
                                  />
                                )}
                              <span
                                className="text-xs font-medium truncate"
                                style={{ color: "#4b7a5c" }}
                              >
                                {result.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                type="button"
                                data-ocid={`search.item.${i + 1}`}
                                onClick={() => loadThroughProxy(result.url)}
                                disabled={actorLoading || loading}
                                className="px-3 py-1 rounded-full text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                                style={{ background: "#22c55e" }}
                                title="Open via proxy"
                              >
                                Via Proxy
                              </button>
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                                title="Open directly"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                            {result.snippet}
                          </p>
                        </motion.div>
                      ))
                    : !searchAbstract && (
                        <div
                          data-ocid="search.empty_state"
                          className="flex flex-col items-center justify-center py-10 gap-3"
                        >
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center"
                            style={{
                              background: "rgba(34,197,94,0.08)",
                              border: "1px solid rgba(34,197,94,0.2)",
                            }}
                          >
                            <Search
                              className="w-5 h-5"
                              style={{ color: "rgba(34,197,94,0.5)" }}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground text-center">
                            No results found for &ldquo;{searchQuery}&rdquo;.
                            <br />
                            <span className="text-xs">
                              Try a different search term or fetch a URL
                              directly.
                            </span>
                          </p>
                        </div>
                      )}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div
            className="flex-1 h-px"
            style={{ background: "rgba(34,197,94,0.15)" }}
          />
          <span className="text-xs text-muted-foreground uppercase tracking-widest px-2">
            or fetch a URL directly
          </span>
          <div
            className="flex-1 h-px"
            style={{ background: "rgba(34,197,94,0.15)" }}
          />
        </div>

        {/* URL Proxy */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          aria-label="URL Proxy"
        >
          <div className="green-card rounded-xl overflow-hidden">
            <div className="flex items-stretch">
              {/* Method toggle */}
              <div className="flex border-r border-border">
                {(["GET", "POST"] as Method[]).map((m) => (
                  <button
                    type="button"
                    key={m}
                    data-ocid={`proxy.${m.toLowerCase()}.toggle`}
                    onClick={() => setMethod(m)}
                    className={`px-4 py-3.5 text-xs font-bold tracking-wider transition-colors ${
                      method === m
                        ? "text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={method === m ? { background: "#22c55e" } : {}}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* URL input */}
              <div className="flex-1 flex items-center px-4 gap-2">
                <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  ref={urlInputRef}
                  data-ocid="proxy.url.input"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={handleUrlKeyDown}
                  placeholder="https://example.com/api"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none py-3.5"
                  spellCheck={false}
                />
              </div>

              {/* Send button */}
              <button
                type="button"
                data-ocid="proxy.submit_button"
                onClick={handleFetch}
                disabled={loading || actorLoading || !url.trim()}
                className="px-5 py-3.5 text-white text-xs font-bold tracking-wider uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                style={{ background: "#22c55e" }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="hidden sm:inline">Fetching</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Send</span>
                  </>
                )}
              </button>
            </div>

            <AnimatePresence>
              {method === "POST" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border px-4 py-2">
                    <span className="text-xs text-muted-foreground">
                      Request body
                    </span>
                  </div>
                  <textarea
                    data-ocid="proxy.body.textarea"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={4}
                    className="w-full bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/40 outline-none px-4 pb-4 resize-y"
                    spellCheck={false}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick examples */}
          <div className="flex flex-wrap gap-2 mt-3 px-1">
            {[
              "https://httpbin.org/get",
              "https://httpbin.org/json",
              "https://api.github.com",
            ].map((ex) => (
              <button
                type="button"
                key={ex}
                onClick={() => {
                  setUrl(ex);
                  setMethod("GET");
                  urlInputRef.current?.focus();
                }}
                className="px-3 py-1 rounded-full text-xs font-mono border transition-colors hover:border-green-400 hover:text-green-600"
                style={{
                  borderColor: "rgba(34,197,94,0.25)",
                  color: "#6b7280",
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </motion.section>

        {/* Proxy Loading indicator */}
        <AnimatePresence>
          {loading && (
            <motion.div
              data-ocid="proxy.loading_state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border"
              style={{
                borderColor: "rgba(34,197,94,0.3)",
                background: "rgba(34,197,94,0.04)",
              }}
            >
              <Loader2
                className="w-4 h-4 animate-spin"
                style={{ color: "#22c55e" }}
              />
              <span className="text-sm" style={{ color: "#16a34a" }}>
                Fetching via IC canister...
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Proxy Results */}
        <AnimatePresence>
          {showProxyResult && response !== null && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-0"
            >
              <div
                className="flex items-center justify-between px-4 py-3 rounded-t-xl border-b"
                style={{
                  background: "rgba(34,197,94,0.05)",
                  borderColor: "rgba(34,197,94,0.2)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Proxy Response
                  </span>
                  {isError ? (
                    <span
                      data-ocid="proxy.error_state"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Error
                    </span>
                  ) : (
                    <span
                      data-ocid="proxy.success_state"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                      style={{
                        background: "rgba(34,197,94,0.1)",
                        color: "#16a34a",
                        borderColor: "rgba(34,197,94,0.3)",
                      }}
                    >
                      {responseType === "html" ? "HTML" : "Text"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {responseType !== "html" && (
                    <button
                      type="button"
                      data-ocid="proxy.copy.button"
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground bg-white hover:bg-gray-50 border border-border rounded-lg transition-colors"
                    >
                      {copied ? (
                        <CheckCheck
                          className="w-3 h-3"
                          style={{ color: "#22c55e" }}
                        />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  )}
                  <button
                    type="button"
                    data-ocid="proxy.fullscreen.button"
                    onClick={() => setIsFullscreen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90"
                    style={{ background: "#22c55e" }}
                    title="View fullscreen"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Fullscreen</span>
                  </button>
                  <button
                    type="button"
                    data-ocid="proxy.reset.button"
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground bg-white hover:bg-gray-50 border border-border rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>
              </div>

              <div
                className="rounded-b-xl overflow-hidden border border-t-0"
                style={{ borderColor: "rgba(34,197,94,0.2)" }}
              >
                {responseType === "html" ? (
                  <iframe
                    title="proxy-response"
                    srcDoc={response}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    className="w-full border-0"
                    style={{ height: "600px" }}
                  />
                ) : (
                  <pre
                    className={`overflow-auto p-4 font-mono text-xs leading-relaxed max-h-[600px] bg-white ${
                      isError ? "text-red-600" : "text-foreground"
                    }`}
                  >
                    {response}
                  </pre>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        <AnimatePresence>
          {!showSearchResults && !showProxyResult && !loading && (
            <motion.div
              data-ocid="proxy.empty_state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.5 } }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 gap-3 text-center"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.2)",
                }}
              >
                <Search
                  className="w-6 h-6"
                  style={{ color: "rgba(34,197,94,0.5)" }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Search privately or enter a URL to fetch
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer
        className="relative z-10 border-t mt-auto"
        style={{ borderColor: "rgba(34,197,94,0.15)" }}
      >
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            ProxShell &mdash; Private Proxy Search
          </span>
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            &copy; {new Date().getFullYear()} Built with ♥ using caffeine.ai
          </a>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}
