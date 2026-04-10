type PoiAddressInput = {
  address?: string | null;
  city?: string | null;
};

const punctuationPattern = /[\s,，、.。·•\-_/|:;'"“”‘’()[\]{}【】<>]/g;
const latinSpecificityPattern =
  /\b(\d+|no\.?\s*\d+|road|rd\.?|street|st\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?|district|plaza|square|building|floor|center|centre|park|pier|wharf)\b/i;
const chineseSpecificityPattern = /[0-9０-９]|号|路|街|道|巷|弄|里|区|县|镇|乡|村|园|苑|广场|大厦|楼|层|门|入口/;
const vagueAddressPattern = /^(various locations|multiple locations|city center|downtown|across the city|unknown|tbd)$/i;

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(punctuationPattern, "");
}

function stripAdministrativeSuffix(value: string) {
  return normalizeToken(value)
    .replace(/(特别行政区|自治区|自治州|自治县|省|市|区|县)$/u, "")
    .replace(/\b(city|district|province|county|municipality)\b/gi, "");
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

export function getMeaningfulPoiAddress(input: PoiAddressInput) {
  const address = input.address?.trim();
  if (!address) {
    return null;
  }

  if (vagueAddressPattern.test(address)) {
    return null;
  }

  const normalizedAddress = stripAdministrativeSuffix(address);
  const normalizedCity = input.city ? stripAdministrativeSuffix(input.city) : "";

  if (normalizedCity && normalizedAddress === normalizedCity) {
    return null;
  }

  if (chineseSpecificityPattern.test(address) || latinSpecificityPattern.test(address)) {
    return address;
  }

  if (containsCjk(address)) {
    return address.length >= 7 ? address : null;
  }

  const wordCount = address.split(/\s+/).filter(Boolean).length;
  return wordCount >= 4 ? address : null;
}

export function hasMeaningfulPoiAddress(input: PoiAddressInput) {
  return Boolean(getMeaningfulPoiAddress(input));
}
