import { Transaction, Selectable } from "kysely";
import { DB, Rooms } from "./schema";
import { startGameRound } from "./roomGameStart";

/**
 * Checks if a public room should auto-start when preferred player count is reached.
 * If yes, starts the game round.
 * 
 * @returns Updated room if auto-start occurred, otherwise original room
 */
export async function autoStartIfReady(
  trx: Transaction<DB>,
  room: Selectable<Rooms>
): Promise<Selectable<Rooms>> {
  if (
    room.status !== 'waiting' ||
    room.roomType !== 'public' ||
    room.preferredPlayers <= 0
  ) {
    return room;
  }

  const playerCount = await trx
    .selectFrom("roomPlayers")
    .select(trx.fn.count("id").as("count"))
    .where("roomId", "=", room.id)
    .executeTakeFirstOrThrow();

  const currentPlayerCount = Number(playerCount.count);

  if (currentPlayerCount >= room.preferredPlayers) {
    console.log(`Room ${room.code}: Auto-starting game with ${currentPlayerCount} players (reached preferred count of ${room.preferredPlayers})`);
    
    try {
      await startGameRound(trx, {
        roomId: room.id,
        room: room,
        isFirstRound: true,
      });

      // Fetch updated room after auto-start
      return await trx.selectFrom("rooms")
        .selectAll()
        .where("id", "=", room.id)
        .executeTakeFirstOrThrow();
    } catch (error) {
      console.error(`Auto-start failed for room ${room.code}:`, error);
      // Return original room even if auto-start fails
      return room;
    }
  }

  return room;
}