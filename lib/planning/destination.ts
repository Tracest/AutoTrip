const domesticAliasGroups = [
  ["beijing", ["beijing", "peking", "\u5317\u4eac", "\u5317\u4eac\u5e02"]],
  ["shanghai", ["shanghai", "\u4e0a\u6d77", "\u4e0a\u6d77\u5e02"]],
  ["guangzhou", ["guangzhou", "canton", "\u5e7f\u5dde", "\u5e7f\u5dde\u5e02"]],
  ["shenzhen", ["shenzhen", "\u6df1\u5733", "\u6df1\u5733\u5e02"]],
  ["hangzhou", ["hangzhou", "\u676d\u5dde", "\u676d\u5dde\u5e02"]],
  ["suzhou", ["suzhou", "\u82cf\u5dde", "\u82cf\u5dde\u5e02"]],
  ["nanjing", ["nanjing", "\u5357\u4eac", "\u5357\u4eac\u5e02"]],
  ["chengdu", ["chengdu", "\u6210\u90fd", "\u6210\u90fd\u5e02"]],
  ["chongqing", ["chongqing", "\u91cd\u5e86", "\u91cd\u5e86\u5e02"]],
  ["wuhan", ["wuhan", "\u6b66\u6c49", "\u6b66\u6c49\u5e02"]],
  ["xian", ["xian", "xi'an", "\u897f\u5b89", "\u897f\u5b89\u5e02"]],
  ["kunming", ["kunming", "\u6606\u660e", "\u6606\u660e\u5e02"]],
  ["guiyang", ["guiyang", "\u8d35\u9633", "\u8d35\u9633\u5e02"]],
  ["xiamen", ["xiamen", "\u53a6\u95e8", "\u53a6\u95e8\u5e02"]],
  ["sanya", ["sanya", "\u4e09\u4e9a", "\u4e09\u4e9a\u5e02"]],
  ["qingdao", ["qingdao", "\u9752\u5c9b", "\u9752\u5c9b\u5e02"]],
  ["harbin", ["harbin", "\u54c8\u5c14\u6ee8", "\u54c8\u5c14\u6ee8\u5e02"]],
  ["changsha", ["changsha", "\u957f\u6c99", "\u957f\u6c99\u5e02"]],
  ["zhangjiajie", ["zhangjiajie", "\u5f20\u5bb6\u754c", "\u5f20\u5bb6\u754c\u5e02"]],
  ["zhuhai", ["zhuhai", "\u73e0\u6d77", "\u73e0\u6d77\u5e02"]]
] as const satisfies ReadonlyArray<readonly [string, readonly string[]]>;

export function normalizeDestinationTerm(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[\s\-_/|,.;:()\uFF08\uFF09\u3010\u3011\[\]]+/g, "");
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

const domesticAliasIndex = new Map<string, string[]>();

for (const [, aliases] of domesticAliasGroups) {
  const normalizedAliases = unique(
    aliases.map((alias) => normalizeDestinationTerm(alias)).filter(Boolean)
  );

  for (const alias of normalizedAliases) {
    domesticAliasIndex.set(alias, normalizedAliases);
  }
}

export function getDestinationAliases(destination: string) {
  const normalized = normalizeDestinationTerm(destination);
  if (!normalized) {
    return [];
  }

  return domesticAliasIndex.get(normalized) ?? [normalized];
}

export function isLikelyDomesticDestination(destination: string) {
  return /[\u4e00-\u9fa5]/.test(destination) || domesticAliasIndex.has(normalizeDestinationTerm(destination));
}

export function getDefaultCountryForDestination(destination: string) {
  return isLikelyDomesticDestination(destination) ? "CN" : "INTL";
}

export function containsCjk(value: string | undefined | null) {
  if (!value) {
    return false;
  }

  return /[\u4e00-\u9fff]/u.test(value);
}

export function shouldPreferChineseOutput(destination: string) {
  return isLikelyDomesticDestination(destination);
}

export function getPreferredDestinationName(destination: string) {
  const normalized = normalizeDestinationTerm(destination);

  for (const [, aliases] of domesticAliasGroups) {
    if (!aliases.some((alias) => normalizeDestinationTerm(alias) === normalized)) {
      continue;
    }

    return aliases.find((alias) => /[\u4e00-\u9fff]/u.test(alias)) ?? destination;
  }

  return destination;
}

export function matchesDestinationAlias(
  value: string | undefined | null,
  destination: string
) {
  if (!value) {
    return false;
  }

  const normalizedValue = normalizeDestinationTerm(value);
  if (!normalizedValue) {
    return false;
  }

  return getDestinationAliases(destination).some(
    (alias) => normalizedValue.includes(alias) || alias.includes(normalizedValue)
  );
}
