import { schema, OutputType } from "./leave_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { roomCode, playerId, userId } = schema.parse(json);

    await db.transaction().execute(async (trx) => {
      const room = await trx.selectFrom("rooms")
        .select(["id", "hostId", "status"])
        .where("code", "=", roomCode)
        .executeTakeFirst();

      if (!room) return;

      // Remove player
      await trx.deleteFrom("roomPlayers")
        .where("roomId", "=", room.id)
        .where("playerId", "=", playerId)
        .execute();

      // Clear user's active_room_id if userId provided
      if (userId !== undefined) {
        await trx.updateTable("users")
          .set({ activeRoomId: null })
          .where("id", "=", userId)
          .execute();
      }

      // Check remaining players
      const remainingPlayers = await trx.selectFrom("roomPlayers")
        .select(["playerId", "joinedAt"])
        .where("roomId", "=", room.id)
        .orderBy("joinedAt", "asc")
        .execute();

      if (remainingPlayers.length === 0) {
        // Room empty, delete it
        await trx.deleteFrom("rooms").where("id", "=", room.id).execute();
      } else if (room.hostId === playerId) {
        // Host left, assign new host (oldest player)
        const newHost = remainingPlayers[0];
        await trx.updateTable("rooms")
          .set({ hostId: newHost.playerId })
          .where("id", "=", room.id)
          .execute();
      }
    });

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("Leave room error:", error);
    return new Response(
      superjson.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500 }
    );
  }
}