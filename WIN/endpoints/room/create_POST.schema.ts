import { z } from "zod";
import superjson from 'superjson';
import { RoomTypeArrayValues } from "../../helpers/schema";

export const schema = z.object({
  playerName: z.string().min(1),
  playerId: z.string().min(1),
  roomType: z.enum(RoomTypeArrayValues),
  maxPlayers: z.number().min(2).max(12).optional(),
  userId: z.number().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  roomCode: string;
  roomId: number;
};

export const postCreateRoom = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/room/create`, {
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