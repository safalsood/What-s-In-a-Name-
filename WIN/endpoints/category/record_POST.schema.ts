import { z } from "zod";
import superjson from 'superjson';

export const schema = z.object({
  playerId: z.string(),
  playerName: z.string().optional(),
  categoryName: z.string().min(1),
  isBaseCategory: z.boolean(),
  eventType: z.enum(["category_used", "dead_round"]).optional().default("category_used"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
};

export const postRecordCategory = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/category/record`, {
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