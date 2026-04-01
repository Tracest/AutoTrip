import { getAmapApiKey } from "@/lib/env";
import { AmapProvider } from "@/lib/geo/amap-provider";
import { MockGeoProvider } from "@/lib/geo/mock-provider";

export function createGeoProvider() {
  const amapKey = getAmapApiKey();
  if (amapKey) {
    return new AmapProvider(amapKey);
  }

  return new MockGeoProvider();
}
