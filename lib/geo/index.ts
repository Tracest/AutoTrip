import { getAmapApiKey } from "@/lib/env";
import { AmapProvider } from "@/lib/geo/amap-provider";
import { MockGeoProvider } from "@/lib/geo/mock-provider";
import { WikimediaProvider } from "@/lib/geo/wikimedia-provider";

export function createGeoProvider() {
  const amapKey = getAmapApiKey();
  if (amapKey) {
    return new AmapProvider(amapKey);
  }

  if (process.env.AUTO_TRIP_FORCE_MOCK === "1") {
    return new MockGeoProvider();
  }

  return new WikimediaProvider();
}
