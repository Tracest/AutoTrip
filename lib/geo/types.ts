import type { Poi } from "@/lib/schemas/trip";

export type TravelMode = "driving" | "walking" | "transit";

export type TravelMatrixEntry = {
  fromPoiId: string;
  toPoiId: string;
  minutes: number;
};

export type GeoSearchParams = {
  destination: string;
  tags: string[];
  radius: number;
};

export type GeoProviderCapabilities = {
  supportsCountryFallback: boolean;
  supportsOpeningHours: boolean;
  accurateInternational: boolean;
};

export type GeoProvider = {
  name: string;
  capabilities: GeoProviderCapabilities;
  searchPois(params: GeoSearchParams): Promise<Poi[]>;
  getPoiDetail(poiId: string): Promise<Poi | null>;
  getTravelMatrix(points: Poi[], mode: TravelMode): Promise<TravelMatrixEntry[]>;
  getOpeningHours(poiId: string): Promise<string | undefined>;
};
