import { z } from "zod";
import superjson from 'superjson';

const baseInput = z.object({
  playerId: z.string(),
  playerName: z.string().optional(),
});

const selectBaseSchema = baseInput.extend({
  type: z.literal("base"),
});

const selectMiniSchema = baseInput.extend({
  type: z.literal("mini"),
  currentLetters: z.array(z.string()),
  usedMiniCategoryIds: z.array(z.string()),
  failedMiniCategoryIds: z.array(z.string()),
  consecutiveFailures: z.number(),
  baseCategory: z.string(),
});

export const schema = z.union([selectBaseSchema, selectMiniSchema]);

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  categoryId: string;
  categoryName: string;
};

export const postSelectCategory = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/categories/select`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};