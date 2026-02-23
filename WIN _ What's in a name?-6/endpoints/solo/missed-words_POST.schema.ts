import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  baseCategory: z.string(),
  collectedLetters: z.array(z.string()),
  categoriesPlayed: z.array(
    z.object({
      category: z.string(),
      letters: z.array(z.string()),
    })
  ),
});

export type InputType = z.infer<typeof schema>;

export type MissedWordItem = {
  category: string;
  exampleWord: string;
  startingLetter: string;
};

export type OutputType = {
  missedWords: MissedWordItem[];
  grandCategorySuggestion: {
    word: string;
  };
};

export const postMissedWords = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/solo/missed-words`, {
    method: "POST",
    body: superjson.stringify(body),
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