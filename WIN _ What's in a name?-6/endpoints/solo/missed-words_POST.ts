import { schema, OutputType, MissedWordItem } from "./missed-words_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    let missedWords: MissedWordItem[] = [];
    const categories = input.categoriesPlayed.map((c) => c.category);

    // 1. Generate words for mini categories using OpenAI
    if (categories.length > 0) {
      const miniCategoryPrompt = `
I have a word game with multiple categories. For EACH category, I will provide the specific letters that were available when that category was played.

Here are the categories with their available letters:
${JSON.stringify(input.categoriesPlayed)}

For EACH category in the list, you MUST provide EXACTLY ONE entry in your response. For each category:
1. Find a single common English word that fits the category perfectly AND starts with one of that category's specific available letters (case-insensitive).
2. If NO valid word exists that both fits the category AND starts with one of that category's available letters, return "No word" as the exampleWord.
3. The word must be a common, recognizable word (no obscure words).

You MUST return EXACTLY ${categories.length} entries in your response - one for each category provided.

Return the result as a JSON object with a "words" key containing an array of objects with keys: "category", "exampleWord", "startingLetter".
- If you found a valid word: set "exampleWord" to the word and "startingLetter" to its first letter (which must be one of that category's available letters).
- If no valid word exists: set "exampleWord" to "No word" and "startingLetter" to "N/A".

Example format:
{
  "words": [
    { "category": "Animals", "exampleWord": "Cat", "startingLetter": "C" },
    { "category": "Vegetables", "exampleWord": "No word", "startingLetter": "N/A" }
  ]
}
`;

      const openaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful assistant for a word game. You output only valid JSON. You MUST provide exactly one entry per category requested.",
              },
              { role: "user", content: miniCategoryPrompt },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
          }),
        }
      );

      if (!openaiResponse.ok) {
        console.error("OpenAI API error:", await openaiResponse.text());
        // Fallback: create "No word" entries for all categories
        missedWords = categories.map((category) => ({
          category,
          exampleWord: "No word",
          startingLetter: "N/A",
        }));
      } else {
        const openaiData = await openaiResponse.json();
        const content = openaiData.choices?.[0]?.message?.content;

        if (!content) {
          missedWords = categories.map((category) => ({
            category,
            exampleWord: "No word",
            startingLetter: "N/A",
          }));
        } else {
          try {
            const parsed = JSON.parse(content);
            let parsedWords: MissedWordItem[] = [];

            if (Array.isArray(parsed)) {
              parsedWords = parsed;
            } else if (parsed.words && Array.isArray(parsed.words)) {
              parsedWords = parsed.words;
            } else if (parsed.result && Array.isArray(parsed.result)) {
              parsedWords = parsed.result;
            } else {
              // Try to find any array in the values
              const arrayValue = Object.values(parsed).find((v) =>
                Array.isArray(v)
              );
              if (arrayValue) {
                parsedWords = arrayValue as MissedWordItem[];
              }
            }

            // Validate the result structure
            const validMissedWords = parsedWords.filter(
              (item) =>
                item &&
                typeof item.category === "string" &&
                typeof item.exampleWord === "string" &&
                typeof item.startingLetter === "string"
            );

            // Ensure we have entries for all categories
            const returnedCategories = new Set(
              validMissedWords.map((w) => w.category)
            );
            missedWords = validMissedWords;

            for (const category of categories) {
              if (!returnedCategories.has(category)) {
                missedWords.push({
                  category,
                  exampleWord: "No word",
                  startingLetter: "N/A",
                });
              }
            }
          } catch (e) {
            console.error("Failed to parse OpenAI response:", e);
            missedWords = categories.map((category) => ({
              category,
              exampleWord: "No word",
              startingLetter: "N/A",
            }));
          }
        }
      }
    }

    // 2. Generate grand category suggestion
    let grandCategorySuggestion = { word: "No word" };

    if (input.baseCategory && input.collectedLetters.length > 0) {
      const grandCategoryPrompt = `
I have a word game where a player has collected the following letters: ${JSON.stringify(input.collectedLetters)}.

The grand category is: "${input.baseCategory}".

Please find ONE common English word that:
1. Can be formed using ONLY the letters from the collected letters (you can use each letter at most once, and you don't have to use all letters).
2. Fits the grand category "${input.baseCategory}" perfectly.
3. Is a common, recognizable word (no obscure words).

If NO valid word can be formed using ONLY these collected letters that fits the category, return "No word".

Return the result as a JSON object with a "word" key containing either the word or "No word".

Example format:
{ "word": "Cat" }
or
{ "word": "No word" }
`;

      const grandOpenaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful assistant for a word game. You output only valid JSON.",
              },
              { role: "user", content: grandCategoryPrompt },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
          }),
        }
      );

      if (grandOpenaiResponse.ok) {
        const grandOpenaiData = await grandOpenaiResponse.json();
        const grandContent = grandOpenaiData.choices?.[0]?.message?.content;

        if (grandContent) {
          try {
            const parsed = JSON.parse(grandContent);
            if (parsed.word && typeof parsed.word === "string") {
              grandCategorySuggestion = { word: parsed.word };
            }
          } catch (e) {
            console.error("Failed to parse grand category OpenAI response:", e);
          }
        }
      } else {
        console.error(
          "Grand category OpenAI API error:",
          await grandOpenaiResponse.text()
        );
      }
    }

    return new Response(
      superjson.stringify({
        missedWords,
        grandCategorySuggestion,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error in solo/missed-words endpoint:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    // Return appropriate status code
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}