import { z } from "zod";
import superjson from 'superjson';

export const schema = z.object({
  word: z.string().min(1, "Word is required"),
  category: z.string().optional(),
  categoryTags: z.array(z.string()).optional(),
  allowedLetters: z.array(z.string()).optional(),
  usedWords: z.array(z.string()).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  valid: boolean;
  word: string;
  definition?: string;
  fitsCategory?: boolean;
  rejectionReason?: string;
  error?: string;
};

export const postValidateWord = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/validate-word`, {
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