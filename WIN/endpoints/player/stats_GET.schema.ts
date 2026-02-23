import { z } from "zod";
import superjson from 'superjson';

export const schema = z.object({
  playerId: z.string().min(1),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  gamesPlayed: number;
  wordsSubmitted: number;
  wordsAccepted: number;
  wordsRejected: number;
  gamesWon: number;
};

export const getPlayerStats = async (playerId: string, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ playerId });
  const result = await fetch(`/_api/player/stats?${params.toString()}`, {
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