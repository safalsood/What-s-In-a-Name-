import { Transaction, Selectable } from "kysely";
import { DB, Rooms } from "./schema";

/**
 * Kicks inactive players from waiting rooms (inactive for 1+ minute).
 * Transfers host if needed or deletes room if no players remain.
 * 
 * @returns Updated room after host transfer (if applicable)
 */
export async function kickInactivePlayersFromWaiting(
  trx: Transaction<DB>,
  room: Selectable<Rooms>
): Promise<Selectable<Rooms>> {
  const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
  
  const inactivePlayers = await trx
    .selectFrom("roomPlayers")
    .selectAll()
    .where("roomId", "=", room.id)
    .where("lastSeenAt", "<", oneMinuteAgo)
    .execute();

  for (const player of inactivePlayers) {
    console.log(`Kicking inactive player ${player.playerName} (${player.playerId}) from room ${room.code}`);
    await trx.deleteFrom("roomPlayers")
      .where("id", "=", player.id)
      .execute();
  }

  // If host was kicked, transfer host or delete room
  if (inactivePlayers.some(p => p.playerId === room.hostId)) {
    const remainingPlayers = await trx
      .selectFrom("roomPlayers")
      .selectAll()
      .where("roomId", "=", room.id)
      .orderBy("joinedAt", "asc")
      .execute();

    if (remainingPlayers.length === 0) {
      console.log(`Room ${room.code} has no players remaining after kick, deleting room`);
      await trx.deleteFrom("rooms").where("id", "=", room.id).execute();
      throw new Error("Room was deleted due to inactivity");
    } else {
      const newHost = remainingPlayers[0];
      console.log(`Transferring host of room ${room.code} to ${newHost.playerName} (${newHost.playerId})`);
      await trx.updateTable("rooms")
        .set({ hostId: newHost.playerId, updatedAt: new Date() })
        .where("id", "=", room.id)
        .execute();
      
      // Return updated room
      return await trx.selectFrom("rooms")
        .selectAll()
        .where("id", "=", room.id)
        .executeTakeFirstOrThrow();
    }
  }

  return room;
}

/**
 * Kicks inactive players from playing rooms (inactive for 90+ seconds).
 * Removes shuffle votes from kicked players.
 * Transfers host if needed or marks room as finished if no players remain.
 * 
 * @returns Updated room after host transfer or status change (if applicable)
 */
export async function kickInactivePlayersFromPlaying(
  trx: Transaction<DB>,
  room: Selectable<Rooms>
): Promise<Selectable<Rooms>> {
  const ninetySecondsAgo = new Date(Date.now() - 90 * 1000);
  
  const inactivePlayers = await trx
    .selectFrom("roomPlayers")
    .selectAll()
    .where("roomId", "=", room.id)
    .where("lastSeenAt", "<", ninetySecondsAgo)
    .execute();

  if (inactivePlayers.length === 0) {
    return room;
  }

  for (const player of inactivePlayers) {
    console.log(`Kicking inactive player ${player.playerName} (${player.playerId}) from active game in room ${room.code}`);
    await trx.deleteFrom("roomPlayers")
      .where("id", "=", player.id)
      .execute();
  }

  // Remove shuffle votes from kicked players
  const kickedPlayerIds = inactivePlayers.map(p => p.playerId);
  const currentShuffleVotes = room.shuffleVotes || [];
  const updatedShuffleVotes = currentShuffleVotes.filter(
    id => !kickedPlayerIds.includes(id)
  );

  // Update room with cleaned shuffle votes
  await trx.updateTable("rooms")
    .set({ 
      shuffleVotes: updatedShuffleVotes,
      updatedAt: new Date()
    })
    .where("id", "=", room.id)
    .execute();

  // If host was kicked, transfer host or finish room
  if (inactivePlayers.some(p => p.playerId === room.hostId)) {
    const remainingPlayers = await trx
      .selectFrom("roomPlayers")
      .selectAll()
      .where("roomId", "=", room.id)
      .orderBy("joinedAt", "asc")
      .execute();

    if (remainingPlayers.length === 0) {
      console.log(`Room ${room.code} has no players remaining after kick during active game, marking as finished`);
      await trx.updateTable("rooms")
        .set({ 
          status: 'finished',
          updatedAt: new Date()
        })
        .where("id", "=", room.id)
        .execute();
      
      return await trx.selectFrom("rooms")
        .selectAll()
        .where("id", "=", room.id)
        .executeTakeFirstOrThrow();
    } else {
      const newHost = remainingPlayers[0];
      console.log(`Transferring host of room ${room.code} to ${newHost.playerName} (${newHost.playerId})`);
      await trx.updateTable("rooms")
        .set({ 
          hostId: newHost.playerId,
          updatedAt: new Date()
        })
        .where("id", "=", room.id)
        .execute();
      
      return await trx.selectFrom("rooms")
        .selectAll()
        .where("id", "=", room.id)
        .executeTakeFirstOrThrow();
    }
  }

  // Return updated room with cleaned shuffle votes
  return await trx.selectFrom("rooms")
    .selectAll()
    .where("id", "=", room.id)
    .executeTakeFirstOrThrow();
}