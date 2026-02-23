import { schema, OutputType } from "./validate-word_POST.schema";
import superjson from 'superjson';
import { validateWordStrict } from "../helpers/wordValidator";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { word, category, categoryTags, allowedLetters, usedWords } = schema.parse(json);

    const result = await validateWordStrict({
      word,
      category,
      categoryTags,
      allowedLetters,
      usedWords,
    });

    return new Response(
      superjson.stringify(result satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("Word validation error:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500 }
    );
  }
}