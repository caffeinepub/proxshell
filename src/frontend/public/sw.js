// ProxShell Service Worker
// Intercepts sub-resource requests within proxy viewer tabs and strips
// anti-embedding headers (X-Frame-Options, Content-Security-Policy) from responses.

const CACHE_NAME = "proxshell-v1";

// ICP infrastructure domains -- must never be intercepted
const ICP_DOMAINS = [
  "ic0.app",
  "icp0.io",
  "icp-api.io",
  "raw.ic0.app",
  "caffeine.ai",
  "caffeinelabs.xyz",
];

function isIcpRequest(url) {
  return ICP_DOMAINS.some(
    (domain) => url.hostname === domain || url.hostname.endsWith("." + domain)
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Pass through same-origin requests (app assets, canister HTTP gateway)
  if (url.origin === self.location.origin) return;

  // Pass through ICP backend calls so CBOR bodies are never dropped
  if (isIcpRequest(url)) return;

  // For other cross-origin requests, fetch and strip blocking headers
  event.respondWith(
    fetch(event.request.url, {
      method: event.request.method,
      headers: (() => {
        const headers = {};
        for (const [key, value] of event.request.headers.entries()) {
          headers[key] = value;
        }
        return headers;
      })(),
      body:
        event.request.method !== "GET" && event.request.method !== "HEAD"
          ? event.request.clone().body
          : undefined,
      mode: "cors",
      credentials: "omit",
    })
      .then((response) => {
        const newHeaders = new Headers();
        for (const [key, value] of response.headers.entries()) {
          const lower = key.toLowerCase();
          if (
            lower === "x-frame-options" ||
            lower === "content-security-policy" ||
            lower === "content-security-policy-report-only" ||
            lower === "x-content-type-options"
          ) {
            continue;
          }
          newHeaders.set(key, value);
        }
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      })
      .catch(() => {
        return new Response("Resource unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      })
  );
});
