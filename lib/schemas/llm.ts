import { z } from "zod";

export const llmSettingsSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().optional().default(""),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.3),
  apiStyle: z.literal("openai").default("openai"),
  enabled: z.boolean().default(true)
});

export const llmTestSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().optional().default(""),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.3)
});

export const llmSettingsResponseSchema = z.object({
  baseUrl: z.string().url().optional(),
  model: z.string().optional(),
  temperature: z.number().optional(),
  apiStyle: z.literal("openai").optional(),
  enabled: z.boolean().optional(),
  hasApiKey: z.boolean().optional(),
  apiKeyOptional: z.boolean().optional(),
  configured: z.boolean()
});

export type LlmSettingsInput = z.infer<typeof llmSettingsSchema>;
export type LlmTestInput = z.infer<typeof llmTestSchema>;
export type LlmSettingsResponse = z.infer<typeof llmSettingsResponseSchema>;
