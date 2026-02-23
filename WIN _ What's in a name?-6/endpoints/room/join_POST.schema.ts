import { z } from "zod";
import superjson from 'superjson';

export const schema = z.object({
  roomCode: z.string().min(1),
  playerName: z.string().min(1),
  playerId: z.string().min(1),
  userId: z.number().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  roomId?: number;
  error?: string;
};

export const postJoinRoom = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/room/join`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  
  if (!result.ok) {
    // It might return 400 for logic errors but still have the error body
    const errorObject = superjson.parse<OutputType>(await result.text());
    if (errorObject.error) {
        throw new Error(errorObject.error);
    }
    throw new Error("Failed to join room");
  }
  
  return superjson.parse<OutputType>(await result.text());
};