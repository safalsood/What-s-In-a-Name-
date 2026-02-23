import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  roomCode: z.string(),
  playerId: z.string(), // Now required for grand category suggestion
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

export const getMissedWords = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams({
    roomCode: input.roomCode,
    playerId: input.playerId,
  });

  const result = await fetch(`/_api/room/missed-words?${params.toString()}`, {
    method: "GET",
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