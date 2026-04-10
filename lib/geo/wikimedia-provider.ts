import { buildFallbackMatrix } from "@/lib/geo/shared";
import type { GeoProvider, GeoSearchParams, TravelMode } from "@/lib/geo/types";
import {
  getDefaultCountryForDestination,
  getPreferredDestinationName,
  normalizeDestinationTerm,
  shouldPreferChineseOutput
} from "@/lib/planning/destination";
import { getDestinationGeoAnchor } from "@/lib/planning/destination-geo";
import {
  getPoiQualityScore,
  hasVenueLikeSignal,
  isBroadAreaLikePoiName
} from "@/lib/planning/poi-signals";
import { buildWikiPageUrl } from "@/lib/geo/wikimedia-images";
import type { Poi } from "@/lib/schemas/trip";
import { getMeaningfulPoiAddress, hasMeaningfulPoiAddress } from "@/lib/utils/poi-address";

type WikimediaSearchResult = {
  title?: string;
  pageid?: number;
  snippet?: string;
};

type WikimediaSearchResponse = {
  query?: {
    search?: WikimediaSearchResult[];
  };
};

type WikipediaQueryPage = {
  title?: string;
  missing?: boolean;
  extract?: string;
  coordinates?: Array<{
    lat?: number;
    lon?: number;
  }>;
};

type WikipediaPageQueryResponse = {
  query?: {
    pages?: WikipediaQueryPage[];
  };
};

type WikimediaSection = {
  index?: string;
  line?: string;
};

type WikimediaSectionsResponse = {
  parse?: {
    title?: string;
    sections?: WikimediaSection[];
  };
};

type WikimediaSectionTextResponse = {
  parse?: {
    title?: string;
    text?: string;
  };
};

type ParsedListing = {
  name: string;
  address?: string;
  openingHoursText?: string;
  summary?: string;
  latitude?: number;
  longitude?: number;
  sourceUrl?: string;
  categories: string[];
};

const DEFAULT_TIMEOUT_MS = 15_000;
const chineseAreaLikePattern = /(大道|东路|西路|南路|北路|金融贸易区)(?:\s*\(.+\))?$/u;
const poiVenueKeywordPattern = /(店|酒楼|酒家|饭店|飯店|餐厅|餐廳|街|庙|廟|馆|館|博物馆|博物館|塔|楼|樓|大厦|大廈|公园|公園|园|園|故居|旧居|舊居|会馆|會館)$/u;
const foodPoiPattern = /(酒楼|酒家|点心店|點心店|饭店|飯店|小吃街|美食街|馒头店|饅頭店|茶馆|茶館|咖啡馆|咖啡館|食府|餐馆|餐館|老字号|老字號)/u;
const genericDishPattern = /(小笼包|小籠包|生煎|中式小吃|炸猪排|松糕|青团|青糰|粢饭糕)$/u;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createApiUrl(host: string, params: Record<string, string>) {
  const url = new URL(`https://${host}/w/api.php`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, integer) => String.fromCodePoint(Number.parseInt(integer, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function stripTags(value: string | undefined) {
  if (!value) {
    return "";
  }

  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function toNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveSourcePageUrl(rawHref: string | undefined, host: string) {
  if (!rawHref) {
    return undefined;
  }

  if (/^https?:\/\//i.test(rawHref)) {
    return rawHref;
  }

  if (rawHref.startsWith("//")) {
    return `https:${rawHref}`;
  }

  if (rawHref.startsWith("/")) {
    return `https://${host}${rawHref}`;
  }

  return undefined;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function createSyntheticCoordinates(seed: string, destination: string) {
  const hash = hashString(seed);
  const anchor = getDestinationGeoAnchor(destination);
  const isDomestic = shouldPreferChineseOutput(destination);
  const baseLat = anchor?.latitude ?? (isDomestic ? 30 : 40);
  const baseLng = anchor?.longitude ?? (isDomestic ? 112 : 2);
  return {
    latitude: Number((baseLat + ((hash % 900) - 450) / 10_000).toFixed(6)),
    longitude: Number((baseLng + (((hash >> 8) % 900) - 450) / 10_000).toFixed(6))
  };
}

function createPoiId(destination: string, name: string) {
  return `wikimedia-${normalizeDestinationTerm(destination)}-${normalizeDestinationTerm(name) || "poi"}`;
}

function createSupplementalPoiId(destination: string, name: string) {
  return `wiki-search-${normalizeDestinationTerm(destination)}-${normalizeDestinationTerm(name) || "poi"}`;
}

function createHeaders() {
  return {
    "User-Agent": "AutoTrip/0.1 (https://localhost; planning research)"
  };
}

function hasPoiLikeVenueMarker(name: string) {
  return poiVenueKeywordPattern.test(name);
}

function isGenericDishLikeName(name: string) {
  return genericDishPattern.test(name);
}

async function requestJson<T>(url: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: createHeaders(),
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;

      if (attempt < 1) {
        await delay(400 * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown upstream fetch failure.");
}

function normalizeText(value: string | undefined) {
  return normalizeDestinationTerm(stripTags(value));
}

function inferCategories(sectionLine: string, listing: ParsedListing, tags: string[]) {
  const categories = new Set<string>();
  const section = normalizeText(sectionLine);
  const text = `${listing.name} ${listing.summary ?? ""} ${listing.address ?? ""}`;

  if (/饮食|飲食|eat|food|restaurant/.test(section)) {
    categories.add("\u7f8e\u98df");
  }
  if (/城隍庙|城隍廟|田子坊|新天地|馒头店|饅頭店|小吃|美食/.test(text)) {
    categories.add("\u7f8e\u98df");
  }
  if (/活动|drink|night/.test(section) || /夜景|观景|觀景|塔|天际线|天際線/.test(text)) {
    categories.add("\u591c\u666f");
  }
  if (/外滩|外灘|东方明珠|東方明珠|环球金融中心|環球金融中心|上海中心|电视塔|電視塔/.test(text)) {
    categories.add("\u591c\u666f");
  }
  if (/自然|park|garden/.test(section) || /公园|公園|植物园|植物園|湿地|濕地/.test(text)) {
    categories.add("\u81ea\u7136");
  }
  if (
    /人文|历史|歷史|see|sight|museum|culture/.test(section) ||
    /博物馆|博物館|故居|古镇|古鎮|寺|庙|廟|文化|历史|歷史/.test(text)
  ) {
    categories.add("\u5386\u53f2");
  }
  if (/建筑|建築|tower|building/.test(text)) {
    categories.add("\u5efa\u7b51");
  }

  if (categories.size === 0) {
    const normalizedTags = tags.map((tag) => normalizeDestinationTerm(tag));

    if (normalizedTags.some((tag) => /历史|museum|architecture/.test(tag))) {
      categories.add("\u5386\u53f2");
    } else if (normalizedTags.some((tag) => /夜景|night/.test(tag))) {
      categories.add("\u591c\u666f");
    } else if (normalizedTags.some((tag) => /自然|park/.test(tag))) {
      categories.add("\u81ea\u7136");
    } else if (normalizedTags.some((tag) => /美食|food|eat/.test(tag))) {
      categories.add("\u7f8e\u98df");
    } else {
      categories.add("\u666f\u70b9");
    }
  }

  return Array.from(categories).slice(0, 2);
}

function inferCategoriesFromSearch(title: string, extract: string | undefined, interest: string) {
  const categories = new Set<string>();
  const text = `${title} ${extract ?? ""}`;
  const normalizedInterest = normalizeDestinationTerm(interest);

  if (foodPoiPattern.test(text)) {
    categories.add("\u7f8e\u98df");
  }
  if (/夜景|观景|觀景|电视塔|電視塔|大厦|大廈|中心大厦|摩天/.test(text)) {
    categories.add("\u591c\u666f");
  }
  if (/博物馆|博物館|故居|旧居|舊居|城隍庙|城隍廟|古镇|古鎮|园林|園林|历史|歷史/.test(text)) {
    categories.add("\u5386\u53f2");
  }
  if (/大厦|大廈|建筑|建築|塔/.test(text)) {
    categories.add("\u5efa\u7b51");
  }

  if (categories.size === 0) {
    if (/美食|小吃|点心|food|eat/.test(normalizedInterest)) {
      categories.add("\u7f8e\u98df");
    } else if (/夜景|night/.test(normalizedInterest)) {
      categories.add("\u591c\u666f");
    } else if (/历史|museum|architecture/.test(normalizedInterest)) {
      categories.add("\u5386\u53f2");
    } else {
      categories.add("\u666f\u70b9");
    }
  }

  return Array.from(categories).slice(0, 2);
}

function isLikelyAreaListing(listing: ParsedListing) {
  const normalizedName = normalizeText(listing.name);
  const summary = `${listing.summary ?? ""} ${listing.address ?? ""}`;

  return (
    isBroadAreaLikePoiName(listing.name) ||
    chineseAreaLikePattern.test(listing.name) ||
    /大学|大學|学院|學院|校区|校區|度假区|度假區/.test(listing.name) ||
    normalizedName === normalizeText("\u9646\u5bb6\u5634") ||
    /金融中心|金融贸易区|住宅区|行政区/.test(summary)
  );
}

function parseListingsFromSection(html: string, sectionLine: string, tags: string[], host: string) {
  const items = html.match(/<li><bdi class="vcard">[\s\S]*?<\/li>/g) ?? [];
  const isParsedListing = (listing: ParsedListing | null): listing is ParsedListing => listing !== null;

  return items
    .map((item) => {
      const nameMatch =
        item.match(/class="[^"]*listing-name[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ??
        item.match(/class="[^"]*listing-name[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      const name = stripTags(nameMatch?.[1]);

      if (!name) {
        return null;
      }

      const address = stripTags(item.match(/class="label listing-address">([\s\S]*?)<\/span>/i)?.[1]) || undefined;
      const openingHoursText =
        stripTags(item.match(/class="note listing-hours">([\s\S]*?)<\/span>/i)?.[1]) || undefined;
      const summary = stripTags(item.match(/class="note listing-content">([\s\S]*?)<\/span>/i)?.[1]) || undefined;
      const latitude = toNumber(item.match(/abbr class="latitude">([^<]+)<\/abbr>/i)?.[1]);
      const longitude = toNumber(item.match(/abbr class="longitude">([^<]+)<\/abbr>/i)?.[1]);
      const rawSourceHref =
        item.match(/class="[^"]*listing-name[^"]*"[^>]*href="([^"]+)"/i)?.[1] ??
        item.match(/class="[^"]*listing-name[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"/i)?.[1] ??
        item.match(/href="([^"]+)"/i)?.[1];
      const sourceUrlMatch = resolveSourcePageUrl(rawSourceHref, host);

      const listing: ParsedListing = {
        name,
        address,
        openingHoursText,
        summary,
        latitude,
        longitude,
        sourceUrl: sourceUrlMatch,
        categories: inferCategories(
          sectionLine,
          {
            name,
            address,
            openingHoursText,
            summary,
            latitude,
            longitude,
            sourceUrl: sourceUrlMatch,
            categories: []
          },
          tags
        )
      };

      return isLikelyAreaListing(listing) ? null : listing;
    })
    .filter(isParsedListing);
}

function getPreferredHost(destination: string) {
  return shouldPreferChineseOutput(destination) ? "zh.wikivoyage.org" : "en.wikivoyage.org";
}

function getSectionKeywords(tags: string[], destination: string) {
  const keywords = new Set<string>();
  const prefersChinese = shouldPreferChineseOutput(destination);
  const normalizedTags = tags.map((tag) => normalizeDestinationTerm(tag));

  keywords.add(prefersChinese ? "\u89c2\u5149" : "See");

  if (normalizedTags.some((tag) => /food|eat|\u7f8e\u98df/.test(tag))) {
    keywords.add(prefersChinese ? "\u98f2\u98df" : "Eat");
    keywords.add(prefersChinese ? "\u996e\u98df" : "Food");
  }

  if (normalizedTags.some((tag) => /night|\u591c\u666f/.test(tag))) {
    keywords.add(prefersChinese ? "\u6d3b\u52a8" : "Do");
  }

  if (normalizedTags.some((tag) => /history|museum|architecture|\u5386\u53f2|\u535a\u7269|\u5efa\u7b51/.test(tag))) {
    keywords.add(prefersChinese ? "\u4eba\u6587\u666f\u70b9" : "See");
    keywords.add(prefersChinese ? "\u57ce\u533a\u89c2\u5149" : "Historic");
  }

  return Array.from(keywords).map((keyword) => normalizeText(keyword));
}

function getSupplementalSearchTerms(destination: string, interest: string) {
  const prefersChinese = shouldPreferChineseOutput(destination);

  if (prefersChinese) {
    if (interest.includes("\u7f8e\u98df")) {
      return [`${destination} \u5c0f\u5403`, `${destination} \u70b9\u5fc3`, `${destination} \u8001\u5b57\u53f7`];
    }

    if (interest.includes("\u591c\u666f")) {
      return [`${destination} \u89c2\u666f`, `${destination} \u7535\u89c6\u5854`, `${destination} \u5927\u53a6`];
    }

    if (interest.includes("\u5386\u53f2")) {
      return [`${destination} \u535a\u7269\u9986`, `${destination} \u6545\u5c45`, `${destination} \u53e4\u9547`];
    }
  }

  if (/food|eat/i.test(interest)) {
    return [`${destination} food`, `${destination} local snacks`];
  }
  if (/night/i.test(interest)) {
    return [`${destination} observation deck`, `${destination} skyline`];
  }
  if (/history|museum|architecture/i.test(interest)) {
    return [`${destination} museum`, `${destination} historic site`];
  }

  return [`${destination} ${interest}`];
}

async function resolveDestinationPageTitle(destination: string, host: string) {
  const preferredName = getPreferredDestinationName(destination);
  const searchTerms = Array.from(
    new Set([
      preferredName,
      destination,
      shouldPreferChineseOutput(destination) && !/市$/u.test(preferredName) ? `${preferredName}\u5e02` : ""
    ].filter(Boolean))
  );

  for (const term of searchTerms) {
    const searchResponse = await requestJson<WikimediaSearchResponse>(
      createApiUrl(host, {
        action: "query",
        list: "search",
        srsearch: term,
        format: "json",
        formatversion: "2",
        srlimit: "5"
      })
    );

    const results = searchResponse.query?.search ?? [];
    const normalizedTerm = normalizeText(term);
    const exact = results.find((result) => normalizeText(result.title) === normalizedTerm);

    if (exact?.title) {
      return exact.title;
    }

    const best = results.find((result) => {
      const normalizedTitle = normalizeText(result.title);
      return normalizedTitle.includes(normalizedTerm) || normalizedTerm.includes(normalizedTitle);
    });

    if (best?.title) {
      return best.title;
    }
  }

  throw new Error(`Unable to find a travel guide page for ${destination}.`);
}

async function fetchSectionIndex(destination: string, host: string) {
  const pageTitle = await resolveDestinationPageTitle(destination, host);
  const response = await requestJson<WikimediaSectionsResponse>(
    createApiUrl(host, {
      action: "parse",
      page: pageTitle,
      prop: "sections",
      format: "json",
      formatversion: "2"
    })
  );

  return {
    pageTitle,
    sections: response.parse?.sections ?? []
  };
}

async function fetchSectionText(host: string, pageTitle: string, sectionIndex: string) {
  const response = await requestJson<WikimediaSectionTextResponse>(
    createApiUrl(host, {
      action: "parse",
      page: pageTitle,
      prop: "text",
      section: sectionIndex,
      format: "json",
      formatversion: "2"
    })
  );

  return response.parse?.text ?? "";
}

async function searchWikipediaTitles(destination: string, interest: string) {
  const host = shouldPreferChineseOutput(destination) ? "zh.wikipedia.org" : "en.wikipedia.org";
  const titles: string[] = [];
  const seen = new Set<string>();

  for (const searchTerm of getSupplementalSearchTerms(destination, interest)) {
    const response = await requestJson<WikimediaSearchResponse>(
      createApiUrl(host, {
        action: "query",
        list: "search",
        srsearch: searchTerm,
        format: "json",
        formatversion: "2",
        srlimit: "6"
      })
    );

    for (const result of response.query?.search ?? []) {
      const title = result.title?.trim();
      if (!title || seen.has(title)) {
        continue;
      }

      seen.add(title);
      titles.push(title);
    }
  }

  return {
    host,
    titles: titles.slice(0, 12)
  };
}

async function fetchWikipediaPages(host: string, titles: string[]) {
  if (titles.length === 0) {
    return [];
  }

  const response = await requestJson<WikipediaPageQueryResponse>(
    createApiUrl(host, {
      action: "query",
      prop: "coordinates|extracts",
      titles: titles.join("|"),
      exintro: "1",
      explaintext: "1",
      redirects: "1",
      format: "json",
      formatversion: "2"
    })
  );

  return (response.query?.pages ?? []).filter((page) => !page.missing && page.title);
}

export function isUsefulSupplementalPage(
  destination: string,
  title: string,
  extract: string | undefined,
  interest: string,
  hasCoordinates: boolean
) {
  const text = `${title} ${extract ?? ""}`;
  const normalizedDestination = normalizeDestinationTerm(destination);
  const normalizedTitle = normalizeDestinationTerm(title);
  const normalizedText = normalizeDestinationTerm(text);
  const mentionsDestination =
    normalizedText.includes(normalizedDestination) || normalizedDestination.includes(normalizedText);
  const mentionsKnownNonDestinationCity =
    /\u4e0a\u6d77|\u5317\u4eac|\u5e7f\u5dde|\u6df1\u5733|\u676d\u5dde|\u6210\u90fd|\u91cd\u5e86|\u5357\u4eac|\u82cf\u5dde|\u6b66\u6c49|\u897f\u5b89/.test(
      text
    );
  const isAdministrativeRegionPage =
    /(?:\u7701|\u5e02|\u81ea\u6cbb\u533a|\u7279\u522b\u884c\u653f\u533a|\u5730\u533a|\u76df)$/.test(title) &&
    !hasPoiLikeVenueMarker(title);
  const isTransitOrMediaPage =
    /(?:\u8f68\u9053\u4ea4\u901a.*\u7ebf|\u5730\u94c1.*\u7ebf|\u5e7f\u64ad\u7535\u89c6\u53f0|\u7535\u89c6\u53f0|\u516c\u4ea4.*\u7ebf)/.test(
      title
    );
  const lacksCoordinatesAndVenueSignal =
    !hasCoordinates && !hasPoiLikeVenueMarker(title) && !hasVenueLikeSignal(title);
  const mentionsOtherKnownCity = /涓婃捣|鍖椾含|骞垮窞|娣卞湷|鏉窞|鎴愰兘|閲嶅簡|鍗椾含|鑻忓窞|姝︽眽|瑗垮畨/.test(text);

  if (!mentionsDestination && mentionsKnownNonDestinationCity) {
    return false;
  }

  if (!mentionsDestination) {
    if (!/上海|北京|广州|深圳|杭州|成都|重庆|南京|苏州|武汉|西安/.test(text)) {
      return false;
    }
  }

  if (/大学|大學|学院|學院|校区|校區|列表|事件|条例|條例|行政区|行政區/.test(title)) {
    return false;
  }

  if (
    normalizedTitle === normalizedDestination ||
    normalizedTitle === `${normalizedDestination}\u5e02` ||
    isAdministrativeRegionPage ||
    isTransitOrMediaPage ||
    lacksCoordinatesAndVenueSignal ||
    normalizeDestinationTerm(title) === `${normalizeDestinationTerm(destination)}市` ||
    isBroadAreaLikePoiName(title) ||
    chineseAreaLikePattern.test(title) ||
    /博物馆藏|博物館藏|竹书|竹書|文献中心|文獻中心/.test(title) ||
    (isGenericDishLikeName(title) && !hasPoiLikeVenueMarker(title))
  ) {
    return false;
  }

  if (interest.includes("\u7f8e\u98df")) {
    return foodPoiPattern.test(text) && (hasPoiLikeVenueMarker(title) || hasVenueLikeSignal(title));
  }

  if (interest.includes("\u591c\u666f")) {
    return /夜景|观景|觀景|电视塔|電視塔|大厦|大廈|中心大厦|摩天|塔/.test(text) && !chineseAreaLikePattern.test(title);
  }

  if (interest.includes("\u5386\u53f2")) {
    return (
      /博物馆|博物館|故居|旧居|舊居|园|園|庙|廟|街|古镇|古鎮|历史|歷史/.test(text) &&
      (hasPoiLikeVenueMarker(title) || hasCoordinates)
    );
  }

  return true;
}

async function buildSupplementalSearchPois(params: GeoSearchParams) {
  const destinationName = getPreferredDestinationName(params.destination);
  const collected: Poi[] = [];

  for (const interest of params.tags) {
    const { host, titles } = await searchWikipediaTitles(params.destination, interest);
    const pages = await fetchWikipediaPages(host, titles);

    for (const page of pages) {
      const title = page.title?.trim();
      if (
        !title ||
        !isUsefulSupplementalPage(
          params.destination,
          title,
          page.extract,
          interest,
          Boolean(page.coordinates?.[0])
        )
      ) {
        continue;
      }

      const coordinates = page.coordinates?.[0];
      const syntheticCoordinates = createSyntheticCoordinates(
        `${params.destination}:${title}:supplemental`,
        params.destination
      );
      const categories = inferCategoriesFromSearch(title, page.extract, interest);

      collected.push({
        id: createSupplementalPoiId(params.destination, title),
        name: title,
        address: "",
        city: destinationName,
        country: getDefaultCountryForDestination(params.destination),
        categories,
        latitude: coordinates?.lat ?? syntheticCoordinates.latitude,
        longitude: coordinates?.lon ?? syntheticCoordinates.longitude,
        recommendedDurationMinutes: categories.includes("\u7f8e\u98df")
          ? 75
          : categories.includes("\u591c\u666f")
            ? 60
            : 90,
        sourcePageUrl: buildWikiPageUrl(host, title)
      });
    }
  }

  return collected;
}

function dedupePois(pois: Poi[]) {
  const seen = new Set<string>();

  return pois.filter((poi) => {
    const key = normalizeDestinationTerm(poi.name);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizeComparablePoiName(value: string) {
  return normalizeDestinationTerm(value).replace(/广播|廣播|观光|觀光/g, "");
}

function isFuzzyDuplicateName(left: string, right: string) {
  const normalizedLeft = normalizeComparablePoiName(left);
  const normalizedRight = normalizeComparablePoiName(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const minLength = Math.min(normalizedLeft.length, normalizedRight.length);
  if (minLength < 4) {
    return false;
  }

  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

function isResidenceLikePoi(name: string) {
  return /旧居|舊居|寓所|住宅|官邸/.test(name);
}

function getPoiPriority(poi: Poi, destinationName: string) {
  let score = getPoiQualityScore(destinationName, poi);

  if (poi.openingHoursText) {
    score += 4;
  }
  if (hasMeaningfulPoiAddress({ address: poi.address, city: poi.city ?? destinationName })) {
    score += 3;
  }
  if (poi.categories.includes("\u591c\u666f")) {
    score += 4;
  }
  if (poi.categories.includes("\u7f8e\u98df")) {
    score += 3;
  }
  if (poi.categories.includes("\u5386\u53f2")) {
    score += 2;
  }
  if (/博物馆|博物館/.test(poi.name)) {
    score += 6;
  }
  if (/酒楼|酒家|点心店|點心店|老字号|老字號|城隍庙|城隍廟/.test(poi.name)) {
    score += 4;
  }
  if (/博物馆|博物館|酒楼|酒家|点心店|點心店|老字号|老字號|观景塔|觀景塔|电视塔|電視塔|大厦|大廈/.test(poi.name)) {
    score += 3;
  }
  if (isResidenceLikePoi(poi.name)) {
    score -= 6;
  }
  if (/度假区|度假區/.test(poi.name)) {
    score -= 2;
  }

  return score;
}

function prioritizePois(pois: Poi[], destinationName: string) {
  const sorted = [...pois]
    .map((poi, index) => ({
      poi,
      index,
      score: getPoiPriority(poi, destinationName)
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.poi);

  const selected: Poi[] = [];
  let residenceLikeCount = 0;

  for (const poi of sorted) {
    if (selected.some((existing) => isFuzzyDuplicateName(existing.name, poi.name))) {
      continue;
    }

    if (isResidenceLikePoi(poi.name)) {
      if (residenceLikeCount >= 2) {
        continue;
      }
      residenceLikeCount += 1;
    }

    selected.push(poi);
  }

  return selected;
}

export class WikimediaProvider implements GeoProvider {
  name = "wikimedia";
  capabilities = {
    supportsCountryFallback: true,
    supportsOpeningHours: true,
    accurateInternational: false
  };

  async searchPois(params: GeoSearchParams) {
    try {
      const host = getPreferredHost(params.destination);
      const sectionKeywords = getSectionKeywords(params.tags, params.destination);
      const { pageTitle, sections } = await fetchSectionIndex(params.destination, host);
      const relevantSections = sections.filter((section) => {
        const normalizedLine = normalizeText(section.line);
        return sectionKeywords.some(
          (keyword) => normalizedLine.includes(keyword) || keyword.includes(normalizedLine)
        );
      });

      const collected: Poi[] = [];
      const destinationName = getPreferredDestinationName(params.destination);

      for (const section of relevantSections) {
        if (!section.index || !section.line) {
          continue;
        }

        const html = await fetchSectionText(host, pageTitle, section.index);
        const listings = parseListingsFromSection(html, section.line, params.tags, host);

        for (const listing of listings) {
          const syntheticCoordinates = createSyntheticCoordinates(
            `${params.destination}:${listing.name}`,
            params.destination
          );

          collected.push({
            id: createPoiId(params.destination, listing.name),
            name: listing.name,
            address:
              getMeaningfulPoiAddress({
                address: listing.address,
                city: destinationName
              }) ?? "",
            city: destinationName,
            country: getDefaultCountryForDestination(params.destination),
            categories: listing.categories,
            latitude: listing.latitude ?? syntheticCoordinates.latitude,
            longitude: listing.longitude ?? syntheticCoordinates.longitude,
            recommendedDurationMinutes: /美食/.test(listing.categories.join(" "))
              ? 75
              : /夜景/.test(listing.categories.join(" "))
                ? 60
                : 90,
            openingHoursText: listing.openingHoursText,
            sourcePageUrl: listing.sourceUrl
          });
        }
      }

      const supplemental = await buildSupplementalSearchPois(params);
      return prioritizePois(dedupePois([...collected, ...supplemental]), destinationName);
    } catch (error) {
      throw new Error(
        shouldPreferChineseOutput(params.destination)
          ? `联网资料检索失败，请检查网络后重试：${error instanceof Error ? error.message : String(error)}`
          : `Online travel-guide lookup failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getPoiDetail(_poiId: string) {
    return null;
  }

  async getTravelMatrix(points: Poi[], _mode: TravelMode) {
    return buildFallbackMatrix(points);
  }

  async getOpeningHours(_poiId: string) {
    return undefined;
  }
}
