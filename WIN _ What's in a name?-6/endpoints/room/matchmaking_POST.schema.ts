import { z } from "zod";
import superjson from 'superjson';

export const schema = z.object({
  playerName: z.string(),
  playerId: z.string(),
  userId: z.number().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  roomCode: string;
  roomId: number;
  joined: boolean; // true if joined existing, false if created new
  error?: string;
};

export const postMatchmaking = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/room/matchmaking`, {
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