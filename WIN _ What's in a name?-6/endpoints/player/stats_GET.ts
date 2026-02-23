import { schema, OutputType } from "./stats_GET.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { sql } from "kysely";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const queryParams = {
      playerId: url.searchParams.get("playerId") ?? undefined,
    };
    
    const { playerId } = schema.parse(queryParams);

    // First, get the list of multiplayer room IDs (rooms with more than 1 player)
    const multiplayerRoomIds = await db
      .selectFrom("roomPlayers")
      .select("roomId")
      .groupBy("roomId")
      .having(sql`count(*)`, ">", 1)
      .execute();

    const roomIdsList = multiplayerRoomIds.map(r => r.roomId);

    // If no multiplayer rooms exist, return zeros
    if (roomIdsList.length === 0) {
      return new Response(
        superjson.stringify({
          gamesPlayed: 0,
          wordsSubmitted: 0,
          wordsAccepted: 0,
          wordsRejected: 0,
          gamesWon: 0
        } satisfies OutputType),
        { status: 200 }
      );
    }

    // Run queries in parallel for performance
    const [submissionStats, gamesWonResult] = await Promise.all([
      // 1. Get submission-related stats from wordSubmissions for multiplayer rooms only
      db.selectFrom("wordSubmissions")
        .select([
          // gamesPlayed: distinct roomIds
          sql<string>`count(distinct room_id)`.as("gamesPlayed"),
          // wordsSubmitted: total count
          sql<string>`count(*)`.as("wordsSubmitted"),
          // wordsAccepted: valid AND fits category
          sql<string>`count(case when is_valid = true and fits_category = true then 1 end)`.as("wordsAccepted")
        ])
        .where("playerId", "=", playerId)
        .where("roomId", "in", roomIdsList)
        .executeTakeFirst(),

      // 2. Get games won from rooms table for multiplayer rooms only
      db.selectFrom("rooms")
        .select(sql<string>`count(*)`.as("gamesWon"))
        .where("status", "=", "finished")
        .where("roundWinnerId", "=", playerId)
        .where("id", "in", roomIdsList)
        .executeTakeFirst()
    ]);

    const gamesPlayed = Number(submissionStats?.gamesPlayed ?? 0);
    const wordsSubmitted = Number(submissionStats?.wordsSubmitted ?? 0);
    const wordsAccepted = Number(submissionStats?.wordsAccepted ?? 0);
    const wordsRejected = wordsSubmitted - wordsAccepted;
    const gamesWon = Number(gamesWonResult?.gamesWon ?? 0);

    return new Response(
      superjson.stringify({
        gamesPlayed,
        wordsSubmitted,
        wordsAccepted,
        wordsRejected,
        gamesWon
      } satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500 }
    );
  }
}