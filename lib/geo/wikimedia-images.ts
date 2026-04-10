import type { Poi, PoiImage } from "@/lib/schemas/trip";
import { normalizeDestinationTerm, shouldPreferChineseOutput } from "@/lib/planning/destination";

type PageImageReference = {
  poiId: string;
  host: string;
  title: string;
  sourcePageUrl: string;
};

type PageImagesResponse = {
  query?: {
    pages?: Array<{
      title?: string;
      missing?: boolean;
      thumbnail?: {
        source?: string;
        width?: number;
        height?: number;
      };
    }>;
  };
};

const PAGE_IMAGE_SIZE = 480;
const MAX_BATCH_SIZE = 20;
const WIKIMEDIA_IMAGE_PROVIDER = "wikimedia";
const wikipediaPoiPrefixes = ["wikimedia-", "wiki-search-"];

function isSupportedWikimediaHost(host: string) {
  return /(?:^|\.)(wikipedia\.org|wikivoyage\.org|wikimedia\.org)$/i.test(host);
}

function normalizeWikiTitle(value: string) {
  return normalizeDestinationTerm(value).replace(/^the/u, "");
}

export function buildWikiPageUrl(host: string, title: string) {
  return `https://${host}/wiki/${encodeURIComponent(title.trim().replace(/\s+/g, "_"))}`;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function buildPageImagesApiUrl(host: string, titles: string[]) {
  const url = new URL(`https://${host}/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", String(PAGE_IMAGE_SIZE));
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", titles.join("|"));
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  return url.toString();
}

async function requestPageImages(host: string, titles: string[]) {
  const response = await fetch(buildPageImagesApiUrl(host, titles), {
    cache: "no-store",
    headers: {
      "User-Agent": "AutoTrip/0.1 (https://localhost; poi image preview)"
    }
  });

  if (!response.ok) {
    throw new Error(`Page image lookup failed with ${response.status}.`);
  }

  const payload = (await response.json()) as PageImagesResponse;
  return payload.query?.pages ?? [];
}

function parsePageReferenceFromUrl(url: string, destination: string) {
  try {
    const parsed = new URL(url);
    if (!isSupportedWikimediaHost(parsed.hostname)) {
      return null;
    }

    const wikiPathIndex = parsed.pathname.indexOf("/wiki/");
    if (wikiPathIndex === -1) {
      return null;
    }

    const title = decodeURIComponent(parsed.pathname.slice(wikiPathIndex + "/wiki/".length))
      .replace(/_/g, " ")
      .trim();

    if (!title) {
      return null;
    }

    const normalizedDestination = normalizeWikiTitle(destination);
    const normalizedTitle = normalizeWikiTitle(title);
    const looksLikeDestinationLandingPage =
      parsed.hostname.includes("wikivoyage.org") &&
      (Boolean(parsed.hash) || normalizedDestination === normalizedTitle);

    if (looksLikeDestinationLandingPage) {
      return null;
    }

    return {
      host: parsed.hostname,
      title,
      sourcePageUrl: `${parsed.origin}${parsed.pathname}`
    };
  } catch {
    return null;
  }
}

export function getWikimediaPageReference(poi: Poi, destination: string): PageImageReference | null {
  if (poi.image?.provider === WIKIMEDIA_IMAGE_PROVIDER) {
    return null;
  }

  if (poi.sourcePageUrl) {
    const parsed = parsePageReferenceFromUrl(poi.sourcePageUrl, destination);
    if (parsed) {
      return {
        poiId: poi.id,
        ...parsed
      };
    }
  }

  if (!wikipediaPoiPrefixes.some((prefix) => poi.id.startsWith(prefix))) {
    return null;
  }

  const title = poi.name.trim();
  if (!title) {
    return null;
  }

  const host = shouldPreferChineseOutput(destination) ? "zh.wikipedia.org" : "en.wikipedia.org";
  return {
    poiId: poi.id,
    host,
    title,
    sourcePageUrl: buildWikiPageUrl(host, title)
  };
}

function resolvePageMatches(
  pageTitle: string,
  references: PageImageReference[]
) {
  const normalizedPageTitle = normalizeWikiTitle(pageTitle);
  const exactMatches = references.filter((reference) => normalizeWikiTitle(reference.title) === normalizedPageTitle);

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  const fuzzyMatches = references.filter((reference) => {
    const normalizedReferenceTitle = normalizeWikiTitle(reference.title);
    return (
      normalizedReferenceTitle.includes(normalizedPageTitle) ||
      normalizedPageTitle.includes(normalizedReferenceTitle)
    );
  });

  return fuzzyMatches.length === 1 ? fuzzyMatches : [];
}

export async function enrichPoisWithWikimediaImages(pois: Poi[], destination: string) {
  const references = pois
    .map((poi) => getWikimediaPageReference(poi, destination))
    .filter((reference): reference is PageImageReference => reference !== null);

  if (references.length === 0) {
    return pois;
  }

  const referencesByHost = new Map<string, PageImageReference[]>();

  for (const reference of references) {
    const bucket = referencesByHost.get(reference.host) ?? [];
    bucket.push(reference);
    referencesByHost.set(reference.host, bucket);
  }

  const imagesByPoiId = new Map<string, PoiImage>();

  for (const [host, hostReferences] of referencesByHost) {
    const uniqueTitles = Array.from(new Set(hostReferences.map((reference) => reference.title)));

    for (const titleBatch of chunk(uniqueTitles, MAX_BATCH_SIZE)) {
      const pages = await requestPageImages(host, titleBatch);

      for (const page of pages) {
        if (!page.title || page.missing || !page.thumbnail?.source) {
          continue;
        }

        const matchedReferences = resolvePageMatches(page.title, hostReferences);
        if (matchedReferences.length === 0) {
          continue;
        }

        const sourcePageUrl = buildWikiPageUrl(host, page.title);
        for (const reference of matchedReferences) {
          imagesByPoiId.set(reference.poiId, {
            url: page.thumbnail.source,
            width: page.thumbnail.width,
            height: page.thumbnail.height,
            alt: `${reference.title} 图片预览`,
            sourcePageUrl,
            provider: WIKIMEDIA_IMAGE_PROVIDER
          });
        }
      }
    }
  }

  if (imagesByPoiId.size === 0) {
    return pois;
  }

  return pois.map((poi) => {
    const image = imagesByPoiId.get(poi.id);
    if (!image) {
      return poi;
    }

    return {
      ...poi,
      sourcePageUrl: poi.sourcePageUrl ?? image.sourcePageUrl,
      image
    };
  });
}
