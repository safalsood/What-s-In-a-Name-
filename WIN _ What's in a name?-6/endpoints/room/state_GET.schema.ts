import { z } from "zod";
import superjson from 'superjson';
import { Selectable } from "kysely";
import { Rooms, RoomPlayers } from "../../helpers/schema";

export const schema = z.object({
  roomCode: z.string(),
  playerId: z.string(),
});

export type OutputType = {
  room: Selectable<Rooms>;
  players: Selectable<RoomPlayers>[];
  shuffleVotes: string[];
  voteCount: number;
  voteThreshold: number;
};

export const getRoomState = async (roomCode: string, playerId: string, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ roomCode, playerId });
  const result = await fetch(`/_api/room/state?${params.toString()}`, {
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