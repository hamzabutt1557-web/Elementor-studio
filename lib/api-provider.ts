import { z } from "zod";
export const apiProviderSchema = z
  .object({
    provider: z.enum(["gemini", "openai"]),
    key: z
      .string()
      .trim()
      .min(10)
      .max(500)
      .regex(/^[^\s]+$/),
    model: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9_.:/-]+$/),
    inputRate: z.number().min(0).max(1000),
    outputRate: z.number().min(0).max(1000),
  })
  .strict();
export type ApiProvider = z.infer<typeof apiProviderSchema>;
export function connection(input: unknown) {
  const settings = apiProviderSchema.parse(input);
  return {
    ...settings,
    base:
      settings.provider === "gemini"
        ? "https://generativelanguage.googleapis.com/v1beta/openai/"
        : "https://api.openai.com/v1/",
  };
}
