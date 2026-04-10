import { z } from "zod";
import {
  isSupportedPlanningDestination,
  resolveSupportedPlanningDestination,
  SUPPORTED_DESTINATION_COUNT
} from "@/lib/planning/supported-destinations";

export const paceSchema = z.enum(["easy", "balanced", "packed"]);
export const budgetSchema = z.enum(["value", "balanced", "premium"]);

export const tripRequestSchema = z.object({
  destination: z.string().min(1),
  startDate: z.string().min(1),
  days: z.number().int().min(1).max(14),
  travelers: z.number().int().min(1).max(20),
  interests: z.array(z.string()).min(1),
  pace: paceSchema.default("balanced"),
  budget: budgetSchema.default("balanced"),
  mustVisit: z.array(z.string()).default([]),
  hotelArea: z.string().optional(),
  notes: z.string().optional()
});

export const planningDestinationSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return resolveSupportedPlanningDestination(trimmed) ?? trimmed;
  },
  z
    .string()
    .min(1)
    .refine(isSupportedPlanningDestination, {
      message: `Destination is not supported yet. Please choose one of the ${SUPPORTED_DESTINATION_COUNT} supported cities.`
    })
);

export const planningTripRequestSchema = tripRequestSchema.extend({
  destination: planningDestinationSchema
});

export const planningIssueSchema = z.object({
  severity: z.enum(["warning", "error"]),
  code: z.string(),
  message: z.string(),
  source: z.string(),
  suggestion: z.string().optional()
});

export const poiImageSchema = z.object({
  url: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().min(1),
  sourcePageUrl: z.string().url().optional(),
  provider: z.literal("wikimedia")
});

export const poiSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  city: z.string().optional(),
  country: z.string().default("CN"),
  categories: z.array(z.string()).default([]),
  latitude: z.number(),
  longitude: z.number(),
  recommendedDurationMinutes: z.number().int().min(30).max(360).default(90),
  openingHoursText: z.string().optional(),
  sourcePageUrl: z.string().url().optional(),
  image: poiImageSchema.optional()
});

const flexibleNumberSchema = z.preprocess((value) => {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }
  return value;
}, z.number());

export const relaxedPoiSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  categories: z.array(z.string()).optional(),
  latitude: flexibleNumberSchema.optional(),
  longitude: flexibleNumberSchema.optional(),
  recommendedDurationMinutes: z.number().int().min(30).max(360).optional(),
  openingHoursText: z.string().optional(),
  sourcePageUrl: z.string().url().optional(),
  image: poiImageSchema.optional()
});

export const itineraryItemSchema = z.object({
  id: z.string(),
  poi: poiSchema,
  category: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  durationMinutes: z.number().int().min(15).max(480),
  travelMinutesFromPrevious: z.number().int().min(0).max(300).default(0),
  notes: z.string().optional(),
  locked: z.boolean().default(false)
});

export const relaxedItineraryItemSchema = z.object({
  id: z.string().optional(),
  poi: relaxedPoiSchema,
  category: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  travelMinutesFromPrevious: z.number().int().min(0).max(300).optional(),
  notes: z.string().optional(),
  locked: z.boolean().optional()
});

export const itineraryDaySchema = z.object({
  date: z.string(),
  title: z.string(),
  totalTravelMinutes: z.number().int().min(0),
  intensityScore: z.number().min(0).max(10),
  items: z.array(itineraryItemSchema).default([])
});

export const relaxedItineraryDaySchema = z.object({
  date: z.string().optional(),
  title: z.string().optional(),
  totalTravelMinutes: z.number().int().min(0).optional(),
  intensityScore: z.number().min(0).max(10).optional(),
  items: z.array(relaxedItineraryItemSchema).default([])
});

export const itinerarySchema = z.object({
  request: tripRequestSchema,
  days: z.array(itineraryDaySchema),
  issues: z.array(planningIssueSchema).default([]),
  metadata: z.object({
    usedModel: z.string().optional(),
    geoProvider: z.string(),
    candidateSource: z.string().optional(),
    candidateCount: z.number().int().nonnegative().optional(),
    betaNotice: z.string().optional(),
    createdAt: z.string()
  })
});

export const relaxedItinerarySchema = z.object({
  request: tripRequestSchema.optional(),
  days: z.array(relaxedItineraryDaySchema),
  issues: z.array(planningIssueSchema).optional(),
  metadata: z
    .object({
      usedModel: z.string().optional(),
      geoProvider: z.string().optional(),
      candidateSource: z.string().optional(),
      candidateCount: z.number().int().nonnegative().optional(),
      betaNotice: z.string().optional(),
      createdAt: z.string().optional()
    })
    .optional()
});

export const tripSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  destination: z.string(),
  startDate: z.string(),
  days: z.number(),
  status: z.string(),
  updatedAt: z.string()
});

export const tripDetailSchema = tripSummarySchema.extend({
  request: tripRequestSchema,
  itinerary: itinerarySchema
});

export type TripRequest = z.infer<typeof tripRequestSchema>;
export type PlanningIssue = z.infer<typeof planningIssueSchema>;
export type PoiImage = z.infer<typeof poiImageSchema>;
export type Poi = z.infer<typeof poiSchema>;
export type ItineraryItem = z.infer<typeof itineraryItemSchema>;
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;
export type Itinerary = z.infer<typeof itinerarySchema>;
export type TripSummary = z.infer<typeof tripSummarySchema>;
export type TripDetail = z.infer<typeof tripDetailSchema>;
