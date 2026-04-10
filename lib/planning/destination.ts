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
  ["zhuhai", ["zhuhai", "\u73e0\u6d77", "\u73e0\u6d77\u5e02"]],
  ["hefei", ["hefei", "\u5408\u80a5", "\u5408\u80a5\u5e02"]],
  ["fuzhou", ["fuzhou", "\u798f\u5dde", "\u798f\u5dde\u5e02"]],
  ["lanzhou", ["lanzhou", "\u5170\u5dde", "\u5170\u5dde\u5e02"]],
  ["nanning", ["nanning", "\u5357\u5b81", "\u5357\u5b81\u5e02"]],
  ["haikou", ["haikou", "\u6d77\u53e3", "\u6d77\u53e3\u5e02"]],
  ["shijiazhuang", ["shijiazhuang", "\u77f3\u5bb6\u5e84", "\u77f3\u5bb6\u5e84\u5e02"]],
  ["zhengzhou", ["zhengzhou", "\u90d1\u5dde", "\u90d1\u5dde\u5e02"]],
  ["nanchang", ["nanchang", "\u5357\u660c", "\u5357\u660c\u5e02"]],
  ["changchun", ["changchun", "\u957f\u6625", "\u957f\u6625\u5e02"]],
  ["shenyang", ["shenyang", "\u6c88\u9633", "\u6c88\u9633\u5e02"]],
  ["hohhot", ["hohhot", "huhehaote", "\u547c\u548c\u6d69\u7279", "\u547c\u548c\u6d69\u7279\u5e02"]],
  ["yinchuan", ["yinchuan", "\u94f6\u5ddd", "\u94f6\u5ddd\u5e02"]],
  ["xining", ["xining", "\u897f\u5b81", "\u897f\u5b81\u5e02"]],
  ["jinan", ["jinan", "\u6d4e\u5357", "\u6d4e\u5357\u5e02"]],
  ["taiyuan", ["taiyuan", "\u592a\u539f", "\u592a\u539f\u5e02"]],
  ["taipei", ["taipei", "\u53f0\u5317", "\u53f0\u5317\u5e02"]],
  ["urumqi", ["urumqi", "wulumuqi", "\u4e4c\u9c81\u6728\u9f50", "\u4e4c\u9c81\u6728\u9f50\u5e02"]],
  ["lhasa", ["lhasa", "\u62c9\u8428", "\u62c9\u8428\u5e02"]]
] as const satisfies ReadonlyArray<readonly [string, readonly string[]]>;

const domesticRegionFallbackGroups = [
  ["anhui", "hefei", ["anhui", "\u5b89\u5fbd", "\u5b89\u5fbd\u7701"]],
  ["fujian", "fuzhou", ["fujian", "\u798f\u5efa", "\u798f\u5efa\u7701"]],
  ["gansu", "lanzhou", ["gansu", "\u7518\u8083", "\u7518\u8083\u7701"]],
  ["guangdong", "guangzhou", ["guangdong", "\u5e7f\u4e1c", "\u5e7f\u4e1c\u7701"]],
  ["guangxi", "nanning", ["guangxi", "\u5e7f\u897f", "\u5e7f\u897f\u58ee\u65cf\u81ea\u6cbb\u533a", "\u5e7f\u897f\u81ea\u6cbb\u533a"]],
  ["guizhou", "guiyang", ["guizhou", "\u8d35\u5dde", "\u8d35\u5dde\u7701"]],
  ["hainan", "haikou", ["hainan", "\u6d77\u5357", "\u6d77\u5357\u7701"]],
  ["hebei", "shijiazhuang", ["hebei", "\u6cb3\u5317", "\u6cb3\u5317\u7701"]],
  ["heilongjiang", "harbin", ["heilongjiang", "\u9ed1\u9f99\u6c5f", "\u9ed1\u9f99\u6c5f\u7701"]],
  ["henan", "zhengzhou", ["henan", "\u6cb3\u5357", "\u6cb3\u5357\u7701"]],
  ["hubei", "wuhan", ["hubei", "\u6e56\u5317", "\u6e56\u5317\u7701"]],
  ["hunan", "changsha", ["hunan", "\u6e56\u5357", "\u6e56\u5357\u7701"]],
  ["jiangsu", "nanjing", ["jiangsu", "\u6c5f\u82cf", "\u6c5f\u82cf\u7701"]],
  ["jiangxi", "nanchang", ["jiangxi", "\u6c5f\u897f", "\u6c5f\u897f\u7701"]],
  ["jilin", "changchun", ["jilin", "\u5409\u6797", "\u5409\u6797\u7701"]],
  ["liaoning", "shenyang", ["liaoning", "\u8fbd\u5b81", "\u8fbd\u5b81\u7701"]],
  ["neimenggu", "hohhot", ["inner mongolia", "nei mongol", "neimenggu", "\u5185\u8499\u53e4", "\u5185\u8499\u53e4\u81ea\u6cbb\u533a"]],
  ["ningxia", "yinchuan", ["ningxia", "\u5b81\u590f", "\u5b81\u590f\u56de\u65cf\u81ea\u6cbb\u533a", "\u5b81\u590f\u81ea\u6cbb\u533a"]],
  ["qinghai", "xining", ["qinghai", "\u9752\u6d77", "\u9752\u6d77\u7701"]],
  ["shaanxi", "xian", ["shaanxi", "\u9655\u897f", "\u9655\u897f\u7701"]],
  ["shandong", "jinan", ["shandong", "\u5c71\u4e1c", "\u5c71\u4e1c\u7701"]],
  ["shanxi", "taiyuan", ["shanxi", "\u5c71\u897f", "\u5c71\u897f\u7701"]],
  ["sichuan", "chengdu", ["sichuan", "\u56db\u5ddd", "\u56db\u5ddd\u7701"]],
  ["taiwan", "taipei", ["taiwan", "\u53f0\u6e7e", "\u53f0\u6e7e\u7701"]],
  ["xinjiang", "urumqi", ["xinjiang", "\u65b0\u7586", "\u65b0\u7586\u7ef4\u543e\u5c14\u81ea\u6cbb\u533a", "\u65b0\u7586\u81ea\u6cbb\u533a"]],
  ["xizang", "lhasa", ["tibet", "xizang", "\u897f\u85cf", "\u897f\u85cf\u81ea\u6cbb\u533a"]],
  ["yunnan", "kunming", ["yunnan", "\u4e91\u5357", "\u4e91\u5357\u7701"]],
  ["zhejiang", "hangzhou", ["zhejiang", "\u6d59\u6c5f", "\u6d59\u6c5f\u7701"]]
] as const satisfies ReadonlyArray<readonly [string, string, readonly string[]]>;

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
const domesticAliasKeyIndex = new Map<string, string>();
const domesticAliasGroupsByKey = new Map<string, string[]>();

for (const [key, aliases] of domesticAliasGroups) {
  const normalizedAliases = unique(
    aliases.map((alias) => normalizeDestinationTerm(alias)).filter(Boolean)
  );

  for (const alias of normalizedAliases) {
    domesticAliasIndex.set(alias, normalizedAliases);
    domesticAliasKeyIndex.set(alias, key);
  }
}

for (const [key, aliases] of domesticAliasGroups) {
  domesticAliasGroupsByKey.set(key, unique(aliases.map((alias) => alias.trim()).filter(Boolean)));
}

const domesticRegionFallbackIndex = new Map<string, string>();
const domesticRegionAliasIndex = new Map<string, string[]>();

for (const [, cityKey, aliases] of domesticRegionFallbackGroups) {
  const normalizedAliases = unique(
    aliases.map((alias) => normalizeDestinationTerm(alias)).filter(Boolean)
  );

  domesticRegionAliasIndex.set(cityKey, normalizedAliases);

  for (const alias of normalizedAliases) {
    domesticRegionFallbackIndex.set(alias, cityKey);
  }
}

function preferAliasDisplay(aliases: string[], destination: string) {
  const preferChinese = /[\u4e00-\u9fff]/u.test(destination);
  return (
    aliases.find((alias) => (/[\u4e00-\u9fff]/u.test(alias) ? preferChinese : !preferChinese)) ??
    aliases[0] ??
    destination
  );
}

export function getDestinationAliases(destination: string) {
  const normalized = normalizeDestinationTerm(destination);
  if (!normalized) {
    return [];
  }

  const directAliases = domesticAliasIndex.get(normalized);
  if (directAliases) {
    return directAliases;
  }

  const fallbackCityKey = domesticRegionFallbackIndex.get(normalized);
  if (!fallbackCityKey) {
    return [normalized];
  }

  return unique([
    ...(domesticRegionAliasIndex.get(fallbackCityKey) ?? []),
    ...(domesticAliasGroupsByKey.get(fallbackCityKey) ?? []).map((alias) => normalizeDestinationTerm(alias))
  ]).filter(Boolean);
}

export function isLikelyDomesticDestination(destination: string) {
  const normalized = normalizeDestinationTerm(destination);

  return (
    /[\u4e00-\u9fa5]/.test(destination) ||
    domesticAliasIndex.has(normalized) ||
    domesticRegionFallbackIndex.has(normalized)
  );
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
  const matchedKey = domesticAliasKeyIndex.get(normalized) ?? domesticRegionFallbackIndex.get(normalized);

  if (matchedKey) {
    const aliases = domesticAliasGroupsByKey.get(matchedKey);
    if (aliases && aliases.length > 0) {
      return aliases.find((alias) => /[\u4e00-\u9fff]/u.test(alias)) ?? aliases[0];
    }
  }

  for (const [, aliases] of domesticAliasGroups) {
    if (!aliases.some((alias) => normalizeDestinationTerm(alias) === normalized)) {
      continue;
    }

    return aliases.find((alias) => /[\u4e00-\u9fff]/u.test(alias)) ?? destination;
  }

  return destination;
}

export function resolvePlanningDestination(destination: string) {
  const normalized = normalizeDestinationTerm(destination);
  const fallbackCityKey = domesticRegionFallbackIndex.get(normalized);

  if (!fallbackCityKey) {
    return destination;
  }

  const aliases = domesticAliasGroupsByKey.get(fallbackCityKey);
  if (!aliases || aliases.length === 0) {
    return destination;
  }

  return preferAliasDisplay(aliases, destination);
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
