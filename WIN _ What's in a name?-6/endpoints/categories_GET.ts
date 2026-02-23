import { schema, OutputType } from "./categories_GET.schema";
import superjson from 'superjson';
import { BASE_CATEGORY_POOL } from "../helpers/categoryPool";
import { getBaseCategoriesWithFallback } from "../helpers/googleSheetsCategories";
import { db } from "../helpers/db";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const rawInput = {
      playerId: url.searchParams.get("playerId") ?? undefined
    };
    const { playerId } = schema.parse(rawInput);

    let categories = await getBaseCategoriesWithFallback(BASE_CATEGORY_POOL);

    // Filter out categories the player has recently seen
    if (playerId) {
      const usedCategories = await db
        .selectFrom("playerCategoryHistory")
        .select("categoryName")
        .where("playerId", "=", playerId)
        .orderBy("usedAt", "desc")
        .limit(50) // Approximately 5 games worth of categories
        .execute();

      const usedCategoryNames = new Set(usedCategories.map(c => c.categoryName));
      categories = categories.filter(cat => !usedCategoryNames.has(cat.name));
    }

    return new Response(
      superjson.stringify({ 
        categories: categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          description: `Category: ${cat.name}`
        }))
      } satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("Get categories error:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500 }
    );
  }
}