import { enrichPoisWithWikimediaImages } from "@/lib/geo/wikimedia-images";
import { itinerarySchema, type Itinerary, type Poi } from "@/lib/schemas/trip";

function createPoiLookup(pois: Poi[]) {
  return new Map(pois.map((poi) => [poi.id, poi]));
}

export async function enrichItineraryPoiImages(itinerary: Itinerary) {
  const pois = itinerary.days.flatMap((day) => day.items.map((item) => item.poi));
  if (pois.length === 0) {
    return itinerary;
  }

  try {
    const enrichedPois = await enrichPoisWithWikimediaImages(pois, itinerary.request.destination);
    const poiLookup = createPoiLookup(enrichedPois);

    return itinerarySchema.parse({
      ...itinerary,
      days: itinerary.days.map((day) => ({
        ...day,
        items: day.items.map((item) => ({
          ...item,
          poi: poiLookup.get(item.poi.id) ?? item.poi
        }))
      }))
    });
  } catch (error) {
    console.warn("[poi-images] Unable to enrich itinerary images.", error);
    return itinerary;
  }
}
