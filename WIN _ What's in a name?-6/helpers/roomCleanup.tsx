import { Transaction } from "kysely";
import { DB } from "./schema";

/**
 * Cleans up inactive rooms where all players have been inactive for 5+ minutes.
 * Also cleans up empty waiting rooms that are 5+ minutes old.
 */
/**
 * Deletes a room and all its dependent records from all referencing tables.
 */
async function deleteRoomAndDependents(trx: Transaction<DB>, roomId: number): Promise<void> {
  // Clear active_room_id references from users
  await trx.updateTable("users").set({ activeRoomId: null }).where("activeRoomId", "=", roomId).execute();
  // Delete from all dependent tables
  await trx.deleteFrom("roundHistory").where("roomId", "=", roomId).execute();
  await trx.deleteFrom("pendingGameLogs").where("roomId", "=", roomId).execute();
  await trx.deleteFrom("usedWords").where("roomId", "=", roomId).execute();
  await trx.deleteFrom("wordSubmissions").where("roomId", "=", roomId).execute();
  await trx.deleteFrom("gameSessionStats").where("roomId", "=", roomId).execute();
  await trx.deleteFrom("roomPlayers").where("roomId", "=", roomId).execute();
  await trx.deleteFrom("rooms").where("id", "=", roomId).execute();
}

export async function cleanupInactiveRooms(trx: Transaction<DB>): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  // Find rooms where ALL players are inactive for 5+ minutes
  const inactiveRooms = await trx
    .selectFrom("rooms")
    .innerJoin("roomPlayers", "rooms.id", "roomPlayers.roomId")
    .select(["rooms.id", "rooms.code"])
    .where("rooms.status", "in", ["waiting", "playing"])
    .groupBy(["rooms.id", "rooms.code"])
    .having(
      trx.fn.max("roomPlayers.lastSeenAt"),
      "<",
      fiveMinutesAgo
    )
    .execute();

    for (const room of inactiveRooms) {
    console.log(`Cleaning up inactive room ${room.code} (all players inactive for 5+ minutes)`);
    await deleteRoomAndDependents(trx, room.id);
  }

  // Also clean up waiting rooms with no players that are 5+ minutes old
  const emptyOldRooms = await trx
    .selectFrom("rooms")
    .leftJoin("roomPlayers", "rooms.id", "roomPlayers.roomId")
    .select(["rooms.id", "rooms.code"])
    .where("rooms.status", "=", "waiting")
    .where("rooms.createdAt", "<", fiveMinutesAgo)
    .where("roomPlayers.id", "is", null)
    .execute();

  for (const room of emptyOldRooms) {
    console.log(`Cleaning up empty old room ${room.code} (waiting for 5+ minutes with no players)`);
    await deleteRoomAndDependents(trx, room.id);
  }
}