import { schema, OutputType } from "./analytics_POST.schema";
import superjson from 'superjson';
import { 
  initGameSession, 
  trackFirstGrandAttempt, 
  incrementGrandAttemptCount, 
  updateMiniCategoriesSeen, 
  finalizeGameSession, 
  logSoloGameSessionToSheet 
} from "../../helpers/gameSessionStats";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const { action, soloSessionId, playerId } = input;

    switch (action) {
      case "init": {
        if (!input.gameStartTime) throw new Error("gameStartTime is required for init action");
        
                await initGameSession({
          soloSessionId,
          playerId,
          playerUsername: input.playerUsername,
          gameMode: "solo",
          gameStartTime: input.gameStartTime,
          miniCategoriesSeen: 0,
          playersCount: 1,
          roomId: null,
        });
        break;
      }

      case "trackFirstGrand": {
        if (input.currentLetterCount === undefined) throw new Error("currentLetterCount is required for trackFirstGrand action");
        if (input.roundsBeforeFirstGrandAttempt === undefined) throw new Error("roundsBeforeFirstGrandAttempt is required for trackFirstGrand action");
        
        await trackFirstGrandAttempt(soloSessionId, playerId, input.currentLetterCount, input.roundsBeforeFirstGrandAttempt);
        break;
      }

      case "incrementGrand": {
        await incrementGrandAttemptCount(soloSessionId, playerId);
        break;
      }

      case "updateMiniSeen": {
        if (input.count === undefined) throw new Error("count is required for updateMiniSeen action");
        
        await updateMiniCategoriesSeen(soloSessionId, playerId, input.count);
        break;
      }

      case "finalize": {
        if (input.finalLetterCount === undefined) throw new Error("finalLetterCount is required for finalize action");
        if (input.result === undefined) throw new Error("result is required for finalize action");
        if (input.totalRounds === undefined) throw new Error("totalRounds is required for finalize action");
        
        // 1. Finalize in DB
        await finalizeGameSession(soloSessionId, playerId, {
          finalLetterCount: input.finalLetterCount,
          result: input.result,
          totalRounds: input.totalRounds,
          finalGrandWordSubmitted: input.finalGrandWord,
          possibleGrandWordShown: input.possibleGrandWord,
        });
        
        // 2. Log to Google Sheets immediately
        // We don't await this to keep the response fast? 
        // Actually, for serverless it's better to await to ensure execution before lambda freezes/dies.
        await logSoloGameSessionToSheet(soloSessionId);
        break;
      }

      default:
        throw new Error(`Invalid action: ${(input as any).action}`);
    }

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("[SoloAnalytics] Error:", error);
    return new Response(
      superjson.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      } satisfies OutputType), 
      { status: 400 } // Using 400 for bad requests/logic errors
    );
  }
}