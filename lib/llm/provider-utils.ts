export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim();
}

export function isLikelyOllamaBaseUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return false;

  try {
    const url = new URL(normalized);
    return url.port === "11434" || ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function getDefaultApiKeyForBaseUrl(baseUrl: string) {
  return isLikelyOllamaBaseUrl(baseUrl) ? "ollama" : "";
}

export function resolveModelsUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  const url = new URL(normalized);

  if (isLikelyOllamaBaseUrl(baseUrl)) {
    url.pathname = "/api/tags";
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/chat/completions")) {
    url.pathname = pathname.replace(/\/chat\/completions$/, "/models") || "/models";
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  if (pathname.endsWith("/responses")) {
    url.pathname = pathname.replace(/\/responses$/, "/models") || "/models";
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  return new URL("models", normalized.endsWith("/") ? normalized : `${normalized}/`).toString();
}
