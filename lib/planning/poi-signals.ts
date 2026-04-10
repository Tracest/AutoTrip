import {
  getDestinationAliases,
  normalizeDestinationTerm,
  shouldPreferChineseOutput
} from "@/lib/planning/destination";
import type { Poi } from "@/lib/schemas/trip";

export type PoiBucket = "culture" | "food" | "night" | "nature" | "other";

type PoiSignalInput = Pick<Poi, "name" | "address" | "categories" | "openingHoursText">;

const bucketKeywordMap: Record<Exclude<PoiBucket, "other">, string[]> = {
  culture: [
    "历史",
    "人文",
    "博物馆",
    "美术馆",
    "纪念馆",
    "展览馆",
    "故居",
    "旧址",
    "古镇",
    "古街",
    "老街",
    "古城",
    "寺",
    "庙",
    "祠",
    "园林",
    "豫园",
    "城隍庙",
    "步行街",
    "里弄",
    "石库门",
    "museum",
    "historic",
    "history",
    "architecture"
  ],
  food: [
    "美食",
    "小吃",
    "点心",
    "酒楼",
    "饭店",
    "餐厅",
    "食府",
    "老字号",
    "茶馆",
    "咖啡馆",
    "甜品",
    "夜市",
    "food",
    "restaurant",
    "snack",
    "dessert",
    "tea"
  ],
  night: [
    "夜景",
    "观景",
    "观光",
    "电视塔",
    "明珠",
    "外滩",
    "灯光",
    "天际线",
    "观景台",
    "摩天轮",
    "夜游",
    "江景",
    "center tower",
    "tower",
    "bund",
    "skyline",
    "nightview"
  ],
  nature: [
    "自然",
    "公园",
    "植物园",
    "湿地",
    "湖",
    "山",
    "森林",
    "花园",
    "garden",
    "park",
    "lake",
    "mountain"
  ]
};

const venueKeywordSignals = [
  "博物馆",
  "美术馆",
  "纪念馆",
  "展览馆",
  "故居",
  "旧址",
  "园",
  "园林",
  "塔",
  "寺",
  "庙",
  "祠",
  "阁",
  "楼",
  "坊",
  "街",
  "步行街",
  "酒楼",
  "饭店",
  "餐厅",
  "店",
  "公园",
  "乐园",
  "桥",
  "码头",
  "museum",
  "restaurant",
  "tower",
  "garden",
  "park"
];

const explicitFoodVenueKeywords = [
  "酒楼",
  "饭店",
  "餐厅",
  "食府",
  "点心店",
  "小吃",
  "老字号",
  "茶馆",
  "咖啡馆",
  "restaurant",
  "snack",
  "dessert",
  "tea"
];

const explicitCultureLandmarkKeywords = [
  "城隍庙",
  "豫园",
  "田子坊",
  "新天地",
  "博物馆",
  "美术馆",
  "纪念馆",
  "古镇",
  "古街",
  "老街",
  "步行街",
  "故居",
  "旧址",
  "园林",
  "museum"
];

const explicitNightLandmarkKeywords = [
  "外滩",
  "东方明珠",
  "电视塔",
  "观景台",
  "摩天轮",
  "中心大厦",
  "tower",
  "bund",
  "skyline"
];

const broadAreaKeywords = [
  "road",
  "street",
  "district",
  "area",
  "town",
  "lane",
  "concession",
  "neighborhood",
  "financial district",
  "central area",
  "downtown",
  "片区",
  "区域",
  "城区",
  "新区",
  "开发区",
  "金融区",
  "商务区",
  "生活区",
  "租界",
  "大道",
  "路",
  "街区",
  "镇"
];

const strongLandmarkKeywords = [
  "外滩",
  "东方明珠",
  "电视塔",
  "观景台",
  "中心大厦",
  "环球金融中心",
  "金茂",
  "武康大楼",
  "museum",
  "bund",
  "tower"
];

const dubiousBuildingKeywords = [
  "大厦",
  "大楼",
  "公寓",
  "写字楼",
  "金融中心",
  "商务中心"
];

const genericConceptKeywords = ["石库门", "里弄文化", "本帮菜"];

const destinationPreferredPoiMap = new Map<string, string[]>([
  [
    "shanghai",
    [
      "外滩",
      "东方明珠",
      "豫园",
      "老城隍庙",
      "上海博物馆",
      "上海自然博物馆",
      "田子坊",
      "新天地",
      "南京路步行街",
      "武康大楼",
      "上海中心大厦",
      "上海环球金融中心",
      "金茂大厦",
      "沈大成",
      "王家沙",
      "绿波廊"
    ]
  ],
  [
    "guiyang",
    ["甲秀楼", "黔灵山公园", "青岩古镇", "青云市集", "文昌阁", "弘福寺", "贵州省博物馆", "二七路小吃街"]
  ]
]);

const destinationAvoidPoiMap = new Map<string, string[]>([
  ["shanghai", ["上海大厦", "长滩观景塔", "石库门"]]
]);

const inferredPoiCategoryRules = [
  {
    keywords: ["\u535a\u7269\u9986", "\u7eaa\u5ff5\u9986", "\u7f8e\u672f\u9986", "museum", "gallery"],
    zh: ["\u535a\u7269\u9986", "\u5386\u53f2"],
    en: ["museum", "history"],
    buckets: ["culture"] as PoiBucket[]
  },
  {
    keywords: [
      "\u7f8e\u98df\u8857",
      "\u5c0f\u5403\u8857",
      "\u591c\u5e02",
      "\u5e02\u96c6",
      "\u9910\u5385",
      "\u996d\u5e97",
      "\u9152\u697c",
      "\u8001\u5b57\u53f7",
      "restaurant",
      "snack",
      "dessert",
      "food street",
      "night market",
      "bazaar"
    ],
    zh: ["\u7f8e\u98df"],
    en: ["food"],
    buckets: ["food"] as PoiBucket[]
  },
  {
    keywords: [
      "\u89c2\u666f\u53f0",
      "\u7535\u89c6\u5854",
      "\u53cc\u5b50\u5854",
      "\u6469\u5929\u8f6e",
      "\u591c\u6e38",
      "tower",
      "bund",
      "skyline",
      "viewpoint",
      "night cruise"
    ],
    zh: ["\u591c\u666f"],
    en: ["nightview"],
    buckets: ["night"] as PoiBucket[]
  },
  {
    keywords: [
      "\u516c\u56ed",
      "\u690d\u7269\u56ed",
      "\u52a8\u7269\u56ed",
      "\u6e7f\u5730",
      "\u5ce1\u8c37",
      "\u7011\u5e03",
      "\u6e56",
      "\u5c71",
      "park",
      "garden",
      "lake",
      "mountain",
      "canyon",
      "waterfall"
    ],
    zh: ["\u81ea\u7136"],
    en: ["nature"],
    buckets: ["nature"] as PoiBucket[]
  }
] as const;

const defaultBucketCategories: Record<Exclude<PoiBucket, "other">, { zh: string[]; en: string[] }> = {
  culture: {
    zh: ["\u5386\u53f2"],
    en: ["history"]
  },
  food: {
    zh: ["\u7f8e\u98df"],
    en: ["food"]
  },
  night: {
    zh: ["\u591c\u666f"],
    en: ["nightview"]
  },
  nature: {
    zh: ["\u81ea\u7136"],
    en: ["nature"]
  }
};

const normalizedKeywordCache = new Map<string, string>();

function normalizeSignalText(value: string | undefined) {
  return normalizeDestinationTerm(value ?? "");
}

function normalizeKeyword(keyword: string) {
  const cached = normalizedKeywordCache.get(keyword);
  if (cached) {
    return cached;
  }

  const normalized = normalizeSignalText(keyword);
  normalizedKeywordCache.set(keyword, normalized);
  return normalized;
}

function includesAny(normalizedText: string, keywords: readonly string[]) {
  return keywords.some((keyword) => normalizedText.includes(normalizeKeyword(keyword)));
}

function getDestinationHintKeywords(destination: string, source: Map<string, string[]>) {
  for (const alias of getDestinationAliases(destination)) {
    const matched = source.get(alias);
    if (matched) {
      return matched;
    }
  }

  return [];
}

function hasStrongLandmarkSignal(normalizedText: string) {
  return includesAny(normalizedText, strongLandmarkKeywords);
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values));
}

export function hasVenueLikeSignal(name: string) {
  return includesAny(normalizeSignalText(name), venueKeywordSignals);
}

export function isBroadAreaLikePoiName(name: string) {
  const normalizedName = normalizeSignalText(name);
  if (!normalizedName) {
    return false;
  }

  return includesAny(normalizedName, broadAreaKeywords) && !hasVenueLikeSignal(name);
}

export function getPoiBuckets(poi: PoiSignalInput) {
  const normalizedText = normalizeSignalText(
    `${poi.name} ${poi.address ?? ""} ${(poi.categories ?? []).join(" ")}`
  );
  const buckets = new Set<PoiBucket>();

  for (const [bucket, keywords] of Object.entries(bucketKeywordMap) as Array<
    [Exclude<PoiBucket, "other">, string[]]
  >) {
    if (includesAny(normalizedText, keywords)) {
      buckets.add(bucket);
    }
  }

  if (buckets.size === 0) {
    buckets.add("other");
  }

  return Array.from(buckets);
}

export function getPoiPrimaryBucket(poi: PoiSignalInput) {
  const normalizedName = normalizeSignalText(poi.name);
  const buckets = getPoiBuckets(poi);

  if (includesAny(normalizedName, explicitFoodVenueKeywords)) {
    return "food" as const;
  }
  if (includesAny(normalizedName, explicitNightLandmarkKeywords)) {
    return "night" as const;
  }
  if (includesAny(normalizedName, explicitCultureLandmarkKeywords)) {
    return "culture" as const;
  }
  if (buckets.includes("food")) {
    return "food" as const;
  }
  if (buckets.includes("night")) {
    return "night" as const;
  }
  if (buckets.includes("culture")) {
    return "culture" as const;
  }
  if (buckets.includes("nature")) {
    return "nature" as const;
  }

  return "other" as const;
}

function inferPoiCategoriesFromName(destination: string, poi: PoiSignalInput) {
  const normalizedName = normalizeSignalText(poi.name);
  const matchedRule = inferredPoiCategoryRules.find((rule) => includesAny(normalizedName, rule.keywords));

  if (!matchedRule) {
    return {
      categories: [] as string[],
      buckets: [] as PoiBucket[]
    };
  }

  return {
    categories: shouldPreferChineseOutput(destination) ? [...matchedRule.zh] : [...matchedRule.en],
    buckets: [...matchedRule.buckets]
  };
}

function getCategoryBuckets(category: string) {
  return getPoiBuckets({
    name: "",
    address: "",
    categories: [category],
    openingHoursText: undefined
  }).filter((bucket) => bucket !== "other");
}

export function normalizePoiCategories(destination: string, poi: PoiSignalInput) {
  const existingCategories = dedupeStrings((poi.categories ?? []).map((category) => category.trim()).filter(Boolean));
  const inferred = inferPoiCategoriesFromName(destination, poi);

  if (inferred.categories.length > 0) {
    const hasAlignedExistingCategory = existingCategories.some((category) =>
      getCategoryBuckets(category).some((bucket) => inferred.buckets.includes(bucket))
    );
    const isConservativeNightInference = inferred.buckets.includes("night") && inferred.buckets.length === 1;

    if (!hasAlignedExistingCategory && (!isConservativeNightInference || existingCategories.length === 0)) {
      return inferred.categories;
    }
  }

  if (existingCategories.length > 0) {
    return existingCategories;
  }

  const primaryBucket = getPoiPrimaryBucket(poi);
  if (primaryBucket === "other") {
    return [];
  }

  return shouldPreferChineseOutput(destination)
    ? [...defaultBucketCategories[primaryBucket].zh]
    : [...defaultBucketCategories[primaryBucket].en];
}

export function getPoiQualityScore(destination: string, poi: PoiSignalInput) {
  const normalizedName = normalizeSignalText(poi.name);
  const normalizedText = normalizeSignalText(
    `${poi.name} ${poi.address ?? ""} ${(poi.categories ?? []).join(" ")}`
  );
  const buckets = getPoiBuckets(poi);
  let score = 0;

  if (poi.openingHoursText) {
    score += 2;
  }
  if (buckets.includes("culture")) {
    score += 2;
  }
  if (buckets.includes("food")) {
    score += 3;
  }
  if (buckets.includes("night")) {
    score += 3;
  }
  if (buckets.includes("nature")) {
    score += 1;
  }

  if (
    includesAny(normalizedName, [
      "博物馆",
      "美术馆",
      "纪念馆",
      "城隍庙",
      "豫园",
      "古镇",
      "古街",
      "老街",
      "步行街",
      "公园"
    ])
  ) {
    score += 5;
  }
  if (includesAny(normalizedName, ["点心店", "酒楼", "饭店", "餐厅", "老字号", "小吃"])) {
    score += 4;
  }
  if (includesAny(normalizedName, ["外滩", "电视塔", "东方明珠", "观景台", "摩天轮", "中心大厦", "金茂"])) {
    score += 5;
  }

  const preferredKeywords = getDestinationHintKeywords(destination, destinationPreferredPoiMap);
  if (includesAny(normalizedName, preferredKeywords)) {
    score += 10;
  }

  const avoidKeywords = getDestinationHintKeywords(destination, destinationAvoidPoiMap);
  if (includesAny(normalizedName, avoidKeywords)) {
    score -= 10;
  }

  if (isBroadAreaLikePoiName(poi.name)) {
    score -= 12;
  }
  if (includesAny(normalizedText, ["金融区", "金融贸易区", "开发区", "住宅区", "商务区", "写字楼"])) {
    score -= 10;
  }
  if (includesAny(normalizedName, dubiousBuildingKeywords) && !hasStrongLandmarkSignal(normalizedText)) {
    score -= 6;
  }
  if (includesAny(normalizedName, genericConceptKeywords)) {
    score -= 8;
  }
  if (includesAny(normalizedText, ["大学", "学院", "校区", "宿舍"])) {
    score -= 12;
  }

  return score;
}
