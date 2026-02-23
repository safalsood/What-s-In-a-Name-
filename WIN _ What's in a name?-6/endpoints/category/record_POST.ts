import { schema, OutputType } from "./record_POST.schema";
import superjson from 'superjson';
import { trackDeadRound, trackCategoryUsage } from "../../helpers/gameAnalytics";

export async function handle(request: Request) {
  try {
    const text = await request.text();
    const json = superjson.parse(text);
    const { playerId, playerName, categoryName, isBaseCategory, eventType } = schema.parse(json);

    if (eventType === "dead_round") {
      // Track a dead round (no valid submissions in this round)
      await trackDeadRound({ category: categoryName });
    } else {
      // Track category usage for history tracking
      await trackCategoryUsage({
        playerId,
        playerName,
        categoryName,
        isBaseCategory,
      });
    }

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error recording category usage:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 400 }
    );
  }
}