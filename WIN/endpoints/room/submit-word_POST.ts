import { schema, OutputType } from "./submit-word_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { TOUGH_LETTERS } from "../../helpers/gameLogic";
import { validateWordStrict } from "../../helpers/wordValidator";
import { queueRoundDataLog, queueWordSubmissionLog } from "../../helpers/pendingGameLogs";
import { trackFirstGrandAttempt, incrementGrandAttemptCount, finalizeGameSession } from "../../helpers/gameSessionStats";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { roomCode, playerId, word, isGrandSubmit } = schema.parse(json);
    const cleanWord = word.trim().toLowerCase();

    const result = await db.transaction().execute(async (trx) => {
      const room = await trx.selectFrom("rooms")
        .selectAll()
        .where("code", "=", roomCode)
        .executeTakeFirst();

      if (!room) throw new Error("Room not found");
      if (room.status !== 'playing') throw new Error("Game is not active");

      const player = await trx.selectFrom("roomPlayers")
        .selectAll()
        .where("roomId", "=", room.id)
        .where("playerId", "=", playerId)
        .executeTakeFirst();

      if (!player) throw new Error("Player not in room");

      // --- 1. GRAND WORD SUBMISSION (Explicit Flag) ---
      if (isGrandSubmit) {
        console.log(`Player ${playerId} attempting GRAND word submission: "${cleanWord}"`);
        
        const collectedLetters = player.collectedLetters || [];
        
        // Track grand attempt stats (before validation)
                await trackFirstGrandAttempt(room.id, playerId, collectedLetters.length, room.roundNumber);
        await incrementGrandAttemptCount(room.id, playerId);
        
        if (!room.baseCategory) {
          return { success: false, valid: false, error: "No base category set for this game" };
        }

        if (collectedLetters.length === 0) {
          return { success: false, valid: false, error: "You need to collect some letters first" };
        }

        // Validate that word ONLY uses collected letters
        const collectedMap = new Map<string, number>();
        for (const l of collectedLetters) {
          collectedMap.set(l.toLowerCase(), (collectedMap.get(l.toLowerCase()) || 0) + 1);
        }
        
        const wordMap = new Map<string, number>();
        for (const char of cleanWord) {
          wordMap.set(char, (wordMap.get(char) || 0) + 1);
        }

        // Check that word only uses collected letters (no extra letters allowed)
        for (const [char, count] of wordMap.entries()) {
          const availableCount = collectedMap.get(char) || 0;
          if (count > availableCount) {
            return { 
              success: false, 
              valid: false, 
              error: "Word can only use letters you have collected" 
            };
          }
        }

        // Check minimum letter requirement (at least 4 letters)
if (cleanWord.length < 4) {
return {
success: false,
valid: false,
error: "Grand word must be at least 4 letters long"
};
}

// Fetch used words for base category
        const baseCategoryUsedWords = await trx.selectFrom("usedWords")
          .select("word")
          .where("roomId", "=", room.id)
          .where("category", "=", room.baseCategory)
          .execute();

        // Validate against base category (no starting letter constraint for grand words)
        const validationResult = await validateWordStrict({
          word: cleanWord,
          category: room.baseCategory,
          usedWords: baseCategoryUsedWords.map(w => w.word),
        });

        // Queue submission for deferred analytics
        await queueWordSubmissionLog(room.id, {
          playerId,
          playerName: player.playerName,
          roomId: room.id,
          word: cleanWord,
          category: room.baseCategory,
          isBaseCategory: true,
          isValid: validationResult.valid,
          fitsCategory: validationResult.fitsCategory ?? false,
        });

        // Queue round data for deferred Google Sheet logging
        await queueRoundDataLog(room.id, {
          category: room.baseCategory,
          word: cleanWord,
          isValid: validationResult.valid && (validationResult.fitsCategory ?? false),
          reason: (validationResult.valid && validationResult.fitsCategory) 
            ? "Accepted as grand word" 
            : (validationResult.rejectionReason || "Word rejected"),
          playerName: player.playerName,
        });

        if (!validationResult.valid || !validationResult.fitsCategory) {
          return { 
            success: false, 
            valid: false, 
            error: validationResult.rejectionReason || `Word must fit base category: ${room.baseCategory}` 
          };
        }

        // Word is valid for base category - WINNER!
        console.log(`MATCH WINNER: Player ${playerId} with grand word "${cleanWord}" (${cleanWord.length} letters)`);
        
        await trx.updateTable("rooms")
          .set({ status: 'finished', roundWinnerId: playerId, roundWinningWord: cleanWord, updatedAt: new Date() })
          .where("id", "=", room.id)
          .execute();
        
        // Finalize game session stats for all players
        const allPlayers = await trx.selectFrom("roomPlayers")
          .select(["playerId", "collectedLetters"])
          .where("roomId", "=", room.id)
          .execute();
        
        for (const p of allPlayers) {
          const isWinner = p.playerId === playerId;
          const letterCount = p.collectedLetters?.length || 0;
          await finalizeGameSession(room.id, p.playerId, {
            finalLetterCount: letterCount,
            result: isWinner ? "Win" : "Loss",
            totalRounds: room.roundNumber,
            finalGrandWordSubmitted: isWinner ? cleanWord : undefined,
            possibleGrandWordShown: undefined,
          });
        }
        
        return { success: true, valid: true, isMatchWinner: true };
      }

      // --- 2. Regular Round Logic ---
      
      // Check if round is already won (unless it's the bonus submission for the winner)
      if (room.roundWinnerId) {
        if (room.roundWinnerId !== playerId) {
          return { success: false, valid: false, error: "Round already ended" };
        }
        // Winner is submitting again. Check if they are allowed (Tough Letter Bonus)
        // We need to know if they already submitted the bonus.
        // Count their words for this round
        const wordCount = await trx.selectFrom("usedWords")
          .select(trx.fn.count("id").as("count"))
          .where("roomId", "=", room.id)
          .where("roundNumber", "=", room.roundNumber)
          .where("playerId", "=", playerId)
          .executeTakeFirst();
        
        const count = Number(wordCount?.count ?? 0);
        if (count >= 2) {
           return { success: false, valid: false, error: "Bonus word already submitted" };
        }
        
        // This is the bonus submission.
        // "The bonus word must... Start with one of the remaining 4 letters"
        // We need to know which letter was used first.
        // We can infer it from the first word, or just check if this word starts with ANY available letter that IS NOT the tough letter?
        // Actually, "Start with one of the remaining 4 letters".
        // Let's just check if it starts with any available letter.
        const firstLetter = cleanWord.charAt(0).toUpperCase();
        if (!room.letters?.includes(firstLetter)) {
           return { success: false, valid: false, error: "Must start with an available letter" };
        }
        
        // Fetch used words for current mini category
        const miniCategoryUsedWords = await trx.selectFrom("usedWords")
          .select("word")
          .where("roomId", "=", room.id)
          .where("category", "=", room.currentMiniCategory || "")
          .execute();

        // Validate
        const validationResult = await validateWordStrict({
          word: cleanWord,
          category: room.currentMiniCategory || "",
          usedWords: miniCategoryUsedWords.map(w => w.word),
        });

        // Queue submission for deferred analytics
        await queueWordSubmissionLog(room.id, {
          playerId,
          playerName: player.playerName,
          roomId: room.id,
          word: cleanWord,
          category: room.currentMiniCategory || "",
          isBaseCategory: false,
          isValid: validationResult.valid,
          fitsCategory: validationResult.fitsCategory ?? false,
        });

        // Queue round data for deferred Google Sheet logging
        await queueRoundDataLog(room.id, {
          category: room.currentMiniCategory || "",
          word: cleanWord,
          isValid: validationResult.valid && (validationResult.fitsCategory ?? false),
          reason: (validationResult.valid && validationResult.fitsCategory) 
            ? "Accepted as bonus word (tough letter)" 
            : (validationResult.rejectionReason || "Word rejected"),
          playerName: player.playerName,
        });

        if (!validationResult.valid || !validationResult.fitsCategory) {
           return { 
             success: false, 
             valid: false, 
             error: validationResult.rejectionReason || "Invalid word or category" 
           };
        }
        
        // Valid bonus word
        await trx.insertInto("usedWords")
          .values({
            roomId: room.id,
            playerId: playerId,
            roundNumber: room.roundNumber,
            category: room.currentMiniCategory || "",
            word: cleanWord,
            createdAt: new Date(),
          })
          .execute();
          
        // Add letter
        const newCollected = [...(player.collectedLetters || []), firstLetter];
        await trx.updateTable("roomPlayers")
          .set({ collectedLetters: newCollected })
          .where("id", "=", player.id)
          .execute();
          
        return { success: true, valid: true, isToughLetterBonus: true };
      }

      // --- 3. First Submission Logic ---
      
      // Check start letter
      const firstLetter = cleanWord.charAt(0).toUpperCase();
      if (!room.letters?.includes(firstLetter)) {
        return { success: false, valid: false, error: "Must start with one of the 5 letters" };
      }

      // Fetch used words for current mini category
      const miniCategoryUsedWords = await trx.selectFrom("usedWords")
        .select("word")
        .where("roomId", "=", room.id)
        .where("category", "=", room.currentMiniCategory || "")
        .execute();

      // Validate using strict validation
      const validationResult = await validateWordStrict({
        word: cleanWord,
        category: room.currentMiniCategory || "",
        allowedLetters: room.letters || [],
        usedWords: miniCategoryUsedWords.map(w => w.word),
      });

      // Queue submission for deferred analytics
      await queueWordSubmissionLog(room.id, {
        playerId,
        playerName: player.playerName,
        roomId: room.id,
        word: cleanWord,
        category: room.currentMiniCategory || "",
        isBaseCategory: false,
        isValid: validationResult.valid,
        fitsCategory: validationResult.fitsCategory ?? false,
      });

      // Queue round data for deferred Google Sheet logging
      await queueRoundDataLog(room.id, {
        category: room.currentMiniCategory || "",
        word: cleanWord,
        isValid: validationResult.valid && (validationResult.fitsCategory ?? false),
        reason: (validationResult.valid && validationResult.fitsCategory) 
          ? "Word accepted - fits category" 
          : (validationResult.rejectionReason || "Word rejected"),
        playerName: player.playerName,
      });

      if (!validationResult.valid) {
         return { 
           success: false, 
           valid: false, 
           error: validationResult.rejectionReason || "Not a valid English word" 
         };
      }
      if (!validationResult.fitsCategory) {
         return { 
           success: false, 
           valid: false, 
           error: validationResult.rejectionReason || `Does not fit category: ${room.currentMiniCategory}` 
         };
      }

      // Valid!
      // Check Tough Letter
      const isTough = TOUGH_LETTERS.includes(firstLetter);

      // Update Room
      const roomUpdate: {
        roundWinnerId: string;
        roundWinningWord: string;
        roundStartTime?: Date;
      } = {
        roundWinnerId: playerId,
        roundWinningWord: cleanWord,
      };

      // If tough letter, extend round time by 15 seconds
      if (isTough && room.roundStartTime) {
        const extendedStartTime = new Date(room.roundStartTime);
        extendedStartTime.setSeconds(extendedStartTime.getSeconds() + 15);
        roomUpdate.roundStartTime = extendedStartTime;
        console.log(`Tough letter bonus: Extended round time by 15 seconds for room ${roomCode}`);
      }

      await trx.updateTable("rooms")
        .set({ ...roomUpdate, updatedAt: new Date() })
        .where("id", "=", room.id)
        .execute();

      // Add letter
      const newCollected = [...(player.collectedLetters || []), firstLetter];
      await trx.updateTable("roomPlayers")
        .set({ collectedLetters: newCollected })
        .where("id", "=", player.id)
        .execute();

      // Record word
      await trx.insertInto("usedWords")
        .values({
          roomId: room.id,
          playerId: playerId,
          roundNumber: room.roundNumber,
          category: room.currentMiniCategory || "",
          word: cleanWord,
          createdAt: new Date(),
        })
        .execute();

      return { success: true, valid: true, isToughLetterBonus: isTough };
    });

    return new Response(
      superjson.stringify(result satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("Submit word error:", error);
    return new Response(
      superjson.stringify({ success: false, valid: false, error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500 }
    );
  }
}