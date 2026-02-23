import { schema, OutputType } from "./flush-logs_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { flushPendingLogs } from "../../helpers/pendingGameLogs";
import { logGameSessionsToSheet } from "../../helpers/gameSessionStats";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { roomCode } = schema.parse(json);

    // 1. Look up room by code to get ID
    const room = await db
      .selectFrom("rooms")
      .select("id")
      .where("code", "=", roomCode)
      .executeTakeFirst();

    if (!room) {
      return new Response(
        superjson.stringify({ error: "Room not found" }), 
        { status: 404 }
      );
    }

    // 2. Flush logs
    const logsProcessed = await flushPendingLogs(room.id);

    // 3. Flush game session stats to Google Sheets
    await logGameSessionsToSheet(room.id);

    // 4. Return success
    return new Response(
      superjson.stringify({ 
        success: true, 
        logsProcessed 
      } satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("Flush logs error:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500 }
    );
  }
}