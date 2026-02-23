import { schema, OutputType } from "./select_POST.schema";
import superjson from 'superjson';
import { getPlayerRecentCategories, trackCategoryUsage } from "../../helpers/gameAnalytics";
import { selectBaseCategoryForPlayers, selectMiniCategory } from "../../helpers/categoryManager";
import { trackCategoryLetterUsage, clearMiniCategoriesCache } from "../../helpers/googleSheetsMiniCategories";

export async function handle(request: Request) {
  try {
    const text = await request.text();
    const json = superjson.parse(text);
    const input = schema.parse(json);

    // 1. Fetch player's recent category history (last 5 games)
    // We fetch both base and mini categories to ensure variety
    const playerHistory = await getPlayerRecentCategories(input.playerId, 5);

    let selectedCategory: { id: string; name: string };
    let isBaseCategory = false;

    if (input.type === "base") {
      // 2. Select Base Category
      // Clear mini categories cache at game start so fresh data is fetched from Google Sheets
      clearMiniCategoriesCache();
      isBaseCategory = true;
      selectedCategory = await selectBaseCategoryForPlayers(playerHistory);
    } else {
      // 3. Select Mini Category
      isBaseCategory = false;
      selectedCategory = await selectMiniCategory({
        currentLetters: input.currentLetters,
        usedMiniCategories: input.usedMiniCategoryIds,
        failedMiniCategories: input.failedMiniCategoryIds,
        consecutiveFailures: input.consecutiveFailures,
        baseCategory: input.baseCategory,
        playerCategoryHistories: playerHistory,
        playerId: input.playerId,
      });

      // 3b. Track category + letter usage for future anti-repetition
      // Fire-and-forget for each letter
      input.currentLetters.forEach(letter => {
        trackCategoryLetterUsage(input.playerId, selectedCategory.name, letter).catch(err => 
          console.error("Failed to track category letter usage", err)
        );
      });
    }

    // 4. Track usage
    // We track it immediately so that if they refresh or start a new game quickly, 
    // this category is already marked as "seen".
    await trackCategoryUsage({
      playerId: input.playerId,
      playerName: input.playerName,
      categoryName: selectedCategory.name,
      isBaseCategory,
    });

    return new Response(
      superjson.stringify({
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
      } satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("Error selecting category:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 400 }
    );
  }
}