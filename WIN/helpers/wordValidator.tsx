import { z } from "zod";
import { checkManualOverride } from "./googleSheetsRoundData";
import { getCachedValidation, setCachedValidation } from "./wordValidationCache";

// Define the result type locally to avoid importing from endpoints
export interface WordValidationResult {
  valid: boolean;
  word: string;
  definition?: string;
  fitsCategory?: boolean;
  rejectionReason?: string;
  error?: string;
}

export interface ValidateWordOptions {
  word: string;
  category?: string;
  categoryTags?: string[];
  allowedLetters?: string[];
  usedWords?: string[];
}

/**
 * Normalizes accents in a string (e.g., "São" -> "Sao")
 */
export function normalizeAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Calls OpenAI with exponential backoff retry logic
 */
export async function callOpenAIWithRetry(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  word: string,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`OpenAI attempt ${attempt}/${maxRetries} for word "${word}"`);

      const openaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            temperature: 0,
            max_tokens: 100,
          }),
        }
      );

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error(`OpenAI API error (attempt ${attempt}):`, errorText);

        // Check if it's a rate limit error (429)
        if (openaiResponse.status === 429 && attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          console.log(`Rate limited. Retrying in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
      }

      const openaiData = await openaiResponse.json();
      console.log(
        `OpenAI raw response for "${word}":`,
        JSON.stringify(openaiData)
      );

      const answer = openaiData.choices?.[0]?.message?.content?.trim() || "";
      return answer;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`OpenAI attempt ${attempt} failed:`, lastError.message);

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // If all retries failed
  throw lastError || new Error("OpenAI validation failed after all retries");
}

/**
 * Strict word validation logic shared between endpoints.
 * Implements competitive integrity rules.
 */
export async function validateWordStrict({
  word,
  category,
  categoryTags,
  allowedLetters,
  usedWords,
}: ValidateWordOptions): Promise<WordValidationResult> {
  const cleanWord = word.trim().toLowerCase();
  const normalizedWord = normalizeAccents(cleanWord);

  if (!cleanWord) {
    return {
      valid: false,
      word: cleanWord,
      rejectionReason: "Word cannot be empty",
    };
  }

  // 0. CACHE CHECK
  // Only check cache if we have a category, as the cache key includes category.
  // If no category is provided, we can't use this specific cache effectively (or would need to adjust logic).
  if (category) {
    const cachedResult = await getCachedValidation(normalizedWord, category);
    if (cachedResult) {
      // We still need to check context-dependent rules like allowedLetters and usedWords
      // because the cache only stores if the word is valid for the category generally.

      let isContextValid = true;
      let contextRejectionReason: string | undefined;

      // Check allowed letters
      if (allowedLetters && allowedLetters.length > 0) {
        const firstChar = cleanWord[0];
        const normalizedFirstChar = normalizeAccents(firstChar).toLowerCase();
        const normalizedAllowedLetters = allowedLetters.map((l) =>
          normalizeAccents(l).toLowerCase()
        );

        if (!normalizedAllowedLetters.includes(normalizedFirstChar)) {
          console.log(
            `[Cache Hit] But rejected due to allowed letters: Word "${cleanWord}"`
          );
          isContextValid = false;
          contextRejectionReason = "Must start with one of the allowed letters";
        }
      }

      // Check used words
      if (isContextValid && usedWords && usedWords.length > 0) {
        const normalizedUsedWords = usedWords.map((w) =>
          normalizeAccents(w.trim().toLowerCase())
        );
        if (normalizedUsedWords.includes(normalizedWord)) {
           console.log(
            `[Cache Hit] But rejected due to used words: Word "${cleanWord}"`
          );
          isContextValid = false;
          contextRejectionReason = "Word already used in this category";
        }
      }

      if (isContextValid) {
        return cachedResult;
      } else {
        return {
          valid: false,
          word: cleanWord,
          rejectionReason: contextRejectionReason,
        };
      }
    }
  }

  // 1. STARTING LETTER RULE (ABSOLUTE)
  if (allowedLetters && allowedLetters.length > 0) {
    const firstChar = cleanWord[0];
    const normalizedFirstChar = normalizeAccents(firstChar).toLowerCase();
    const normalizedAllowedLetters = allowedLetters.map((l) =>
      normalizeAccents(l).toLowerCase()
    );

    if (!normalizedAllowedLetters.includes(normalizedFirstChar)) {
      console.log(
        `Word "${cleanWord}" rejected: first character "${firstChar}" not in allowed letters:`,
        allowedLetters
      );
      return {
        valid: false,
        word: cleanWord,
        rejectionReason: "Must start with one of the allowed letters",
      };
    }
  }

  // 2. STRUCTURAL RULES

  // Only alphabetic characters and spaces allowed
  if (!/^[a-z\s]+$/.test(normalizedWord)) {
    console.log(`Word "${cleanWord}" rejected: contains invalid characters`);
    return {
      valid: false,
      word: cleanWord,
      rejectionReason:
        "Contains invalid characters (only letters and spaces allowed)",
    };
  }

  // Minimum 3 characters
  if (cleanWord.length < 3) {
    console.log(`Word "${cleanWord}" rejected: too short`);
    return {
      valid: false,
      word: cleanWord,
      rejectionReason: "Word is too short (minimum 3 characters)",
    };
  }

  // Check against usedWords array (case-insensitive)
  if (usedWords && usedWords.length > 0) {
    const normalizedUsedWords = usedWords.map((w) =>
      normalizeAccents(w.trim().toLowerCase())
    );
    if (normalizedUsedWords.includes(normalizedWord)) {
      console.log(`Word "${cleanWord}" rejected: already used`);
      return {
        valid: false,
        word: cleanWord,
        rejectionReason: "Word already used in this category",
      };
    }
  }

  // Call Free Dictionary API
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`
  );

  if (response.status === 404) {
    // Word not found in dictionary
    console.log(`Word "${cleanWord}" not found in dictionary`);

    // Use OpenAI for strict validation
    if (category) {
      // Check for manual override first
      try {
        const override = await checkManualOverride(cleanWord, category);
        if (override.hasOverride) {
          console.log(
            `[WordValidator] Manual override found for "${cleanWord}" in category "${category}": ${override.isValid ? "VALID" : "INVALID"}`
          );
          
          if (override.isValid) {
            return {
              valid: true,
              word: cleanWord,
              fitsCategory: true,
              definition: `Validated answer for category: ${category} (manual override)`,
            };
          } else {
            return {
              valid: false,
              word: cleanWord,
              fitsCategory: false,
              rejectionReason: "Marked invalid by manual review",
            };
          }
        }
      } catch (error) {
        console.error(
          `[WordValidator] Failed to check manual override for "${cleanWord}", falling back to AI validation:`,
          error
        );
        // Continue with AI validation
      }

      console.log(
        `Using OpenAI strict validation for "${cleanWord}" in category "${category}"`
      );

      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }

      try {
        const tagsInfo =
          categoryTags && categoryTags.length > 0
            ? `\nCategory Tags: ${categoryTags.join(", ")}`
            : "";

        const answer = await callOpenAIWithRetry(
          openaiApiKey,
          [
            {
              role: "system",
              content: `You are a strict validation engine for a competitive multiplayer word game.
Your job is to decide whether a submitted answer is ACCEPTED or REJECTED.
You must prioritize FAIRNESS, CONSISTENCY, and COMPETITIVE INTEGRITY.
When uncertain, you must REJECT rather than accept.

CORE RULES:

1) STARTING LETTER
Already validated before this step.

2) STRUCTURE
Already validated before this step.

3) SPELLING ACCURACY (VERY STRICT)
Accept ONLY:
- Correct standard spellings
- Widely accepted alternative spellings from authoritative sources
DO NOT accept: phonetic guesses, slang spellings, extra/missing letters, typos

4) WORD RECOGNITION REQUIREMENT
The word must exist in at least ONE recognized source AND be commonly recognizable.
Allowed sources: dictionaries, well-known places, widely known figures, real brands (if category allows), fictional entities (ONLY if category explicitly allows)
Reject if: extremely obscure, Wikipedia-stub-level obscurity, highly specialized jargon

5) CATEGORY FIT (STRICT, NON-METAPHORICAL)
- Must clearly and DIRECTLY fit the category
- Metaphorical, poetic, or stretched associations → REJECT
- If reasonable players could debate it → REJECT
- The connection must be obvious and unambiguous

6) FICTIONAL CONTENT RULE
Fictional characters/places/brands/entities ONLY allowed if:
- Category tags include 'fictional', OR
- Category explicitly mentions fiction (e.g., "Superheroes", "Disney Characters", "Fantasy Creatures")
Otherwise → REJECT all fictional content

7) INDIAN TRANSLITERATED WORDS RULE
Indian food/cultural words (e.g., "gulab jamun", "samosa", "pani puri", "dosa", "biryani") are allowed ONLY if:
- Category tags include 'indian', OR
- Category explicitly mentions Indian context
Otherwise → REJECT

8) INDIAN-ENGLISH / HINGLISH RULE
Indian-English words (e.g., "chai", "tiffin", "jugaad", "prepone", "lakh") are allowed ONLY if:
- Category tags include 'indian', OR
- Category explicitly mentions Indian context
Otherwise → REJECT

9) TRANSLITERATION RULE
For non-English origin words:
- Prefer modern, commonly used English spellings (e.g., "Beijing" not "Peking")
- Accept only widely recognized transliterations
- Reject archaic, rare, or overly academic transliterations

10) FINAL CONFIDENCE RULE
If your confidence is NOT HIGH → REJECT.
Always favor false negatives over false positives.
Fairness to all players is paramount.

11) VAGUENESS/AMBIGUITY REJECTION (VERY STRICT)
- Generic or multi-meaning words require the MOST COMMON interpretation to fit the category
- If the word only fits the category through an uncommon interpretation → REJECT
- Example: "leaf" for "Healthy Food" → REJECT (most leaves aren't food)
- Example: "spinach" for "Healthy Food" → ACCEPT (it IS a healthy food)
- If the word requires qualifier context to fit → REJECT
- Example: "plant" for "Things that smell good" → REJECT (only some plants smell good)
- When in doubt, ask: "Is this word PRIMARILY known for fitting this category?"
- If the answer is no → REJECT

RESPONSE FORMAT:
Respond with ONLY a single word: "ACCEPT" or "REJECT"
Do not include any explanation, punctuation, or additional text.`,
            },
            {
              role: "user",
              content: `Category: "${category}"${tagsInfo}
Submitted word: "${cleanWord}"

Is this word ACCEPTED or REJECTED?`,
            },
          ],
          cleanWord
        );

        console.log(
          `OpenAI strict validation response for "${cleanWord}":`,
          answer
        );

        // Parse single word response
        const normalizedAnswer = answer.trim().toUpperCase();
        const accepted = normalizedAnswer === "ACCEPT";
        const reason = accepted
          ? undefined
          : "Not a recognized word or does not fit the category";

        console.log(
          `Strict validation result for "${cleanWord}": accepted=${accepted}`
        );

        if (accepted) {
          const result = {
            valid: true,
            word: cleanWord,
            fitsCategory: true,
            definition: `Validated answer for category: ${category}`,
          };
          
          await setCachedValidation({
            word: cleanWord,
            normalizedWord,
            category,
            isValid: true,
            fitsCategory: true,
            definition: result.definition,
            validationSource: "openai-strict",
          });
          
          return result;
        } else {
          await setCachedValidation({
            word: cleanWord,
            normalizedWord,
            category,
            isValid: false,
            fitsCategory: false,
            rejectionReason: reason,
            validationSource: "openai-strict",
          });

          return {
            valid: false,
            word: cleanWord,
            fitsCategory: false,
            rejectionReason: reason,
          };
        }
      } catch (error) {
        console.error(
          "OpenAI validation failed after all retries. Failing closed.",
          error
        );
        // Fail closed - return invalid
        return {
          valid: false,
          word: cleanWord,
          fitsCategory: false,
          rejectionReason: "Validation service unavailable",
        };
      }
    } else {
      // No category provided and not in dictionary - return invalid
      return {
        valid: false,
        word: cleanWord,
        rejectionReason: "Not a recognized word",
      };
    }
  }

  if (!response.ok) {
    throw new Error(`Dictionary API error: ${response.statusText}`);
  }

  const data = await response.json();

  // The API returns an array of entries. We just need to know if it exists and maybe get a definition.
  // Example response: [{ word: "hello", meanings: [...] }]

  let definition: string | undefined;
  if (Array.isArray(data) && data.length > 0 && data[0].meanings?.length > 0) {
    const firstMeaning = data[0].meanings[0];
    if (firstMeaning.definitions?.length > 0) {
      definition = firstMeaning.definitions[0].definition;
    }
  }

  // If category is provided, validate if the word fits the category using OpenAI with strict rules
  let fitsCategory: boolean | undefined;
  let rejectionReason: string | undefined;

  if (category) {
    // Check for manual override first
    try {
      const override = await checkManualOverride(cleanWord, category);
      if (override.hasOverride) {
        console.log(
          `[WordValidator] Manual override found for "${cleanWord}" in category "${category}": ${override.isValid ? "VALID" : "INVALID"}`
        );
        
        if (override.isValid) {
          const result = {
            valid: true,
            word: cleanWord,
            definition,
            fitsCategory: true,
          };
          
          await setCachedValidation({
            word: cleanWord,
            normalizedWord,
            category,
            isValid: true,
            fitsCategory: true,
            definition,
            validationSource: "manual-override",
          });

          return result;
        } else {
          // Note: Invalid manual overrides are also cached
          await setCachedValidation({
            word: cleanWord,
            normalizedWord,
            category,
            isValid: false,
            fitsCategory: false,
            rejectionReason: "Marked invalid by manual review",
            validationSource: "manual-override",
          });

          return {
            valid: false,
            word: cleanWord,
            fitsCategory: false,
            rejectionReason: "Marked invalid by manual review",
          };
        }
      }
    } catch (error) {
      console.error(
        `[WordValidator] Failed to check manual override for "${cleanWord}", falling back to AI validation:`,
        error
      );
      // Continue with AI validation
    }

    console.log(
      `Validating if dictionary word "${cleanWord}" fits category "${category}" using OpenAI strict validation`
    );

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    try {
      const tagsInfo =
        categoryTags && categoryTags.length > 0
          ? `\nCategory Tags: ${categoryTags.join(", ")}`
          : "";

      const answer = await callOpenAIWithRetry(
        openaiApiKey,
        [
          {
            role: "system",
            content: `You are a strict validation engine for a competitive multiplayer word game.
Your job is to decide whether a submitted answer is ACCEPTED or REJECTED.
You must prioritize FAIRNESS, CONSISTENCY, and COMPETITIVE INTEGRITY.
When uncertain, you must REJECT rather than accept.

CORE RULES:

1) STARTING LETTER
Already validated before this step.

2) STRUCTURE
Already validated before this step.

3) SPELLING ACCURACY (VERY STRICT)
Accept ONLY:
- Correct standard spellings
- Widely accepted alternative spellings from authoritative sources
DO NOT accept: phonetic guesses, slang spellings, extra/missing letters, typos

4) WORD RECOGNITION REQUIREMENT
The word must exist in at least ONE recognized source AND be commonly recognizable.
Allowed sources: dictionaries, well-known places, widely known figures, real brands (if category allows), fictional entities (ONLY if category explicitly allows)
Reject if: extremely obscure, Wikipedia-stub-level obscurity, highly specialized jargon

5) CATEGORY FIT (STRICT, NON-METAPHORICAL)
- Must clearly and DIRECTLY fit the category
- Metaphorical, poetic, or stretched associations → REJECT
- If reasonable players could debate it → REJECT
- The connection must be obvious and unambiguous

6) FICTIONAL CONTENT RULE
Fictional characters/places/brands/entities ONLY allowed if:
- Category tags include 'fictional', OR
- Category explicitly mentions fiction (e.g., "Superheroes", "Disney Characters", "Fantasy Creatures")
Otherwise → REJECT all fictional content

7) INDIAN TRANSLITERATED WORDS RULE
Indian food/cultural words (e.g., "gulab jamun", "samosa", "pani puri", "dosa", "biryani") are allowed ONLY if:
- Category tags include 'indian', OR
- Category explicitly mentions Indian context
Otherwise → REJECT

8) INDIAN-ENGLISH / HINGLISH RULE
Indian-English words (e.g., "chai", "tiffin", "jugaad", "prepone", "lakh") are allowed ONLY if:
- Category tags include 'indian', OR
- Category explicitly mentions Indian context
Otherwise → REJECT

9) TRANSLITERATION RULE
For non-English origin words:
- Prefer modern, commonly used English spellings (e.g., "Beijing" not "Peking")
- Accept only widely recognized transliterations
- Reject archaic, rare, or overly academic transliterations

10) FINAL CONFIDENCE RULE
If your confidence is NOT HIGH → REJECT.
Always favor false negatives over false positives.
Fairness to all players is paramount.

11) VAGUENESS/AMBIGUITY REJECTION (VERY STRICT)
- Generic or multi-meaning words require the MOST COMMON interpretation to fit the category
- If the word only fits the category through an uncommon interpretation → REJECT
- Example: "leaf" for "Healthy Food" → REJECT (most leaves aren't food)
- Example: "spinach" for "Healthy Food" → ACCEPT (it IS a healthy food)
- If the word requires qualifier context to fit → REJECT
- Example: "plant" for "Things that smell good" → REJECT (only some plants smell good)
- When in doubt, ask: "Is this word PRIMARILY known for fitting this category?"
- If the answer is no → REJECT

RESPONSE FORMAT:
Respond with ONLY a single word: "ACCEPT" or "REJECT"
Do not include any explanation, punctuation, or additional text.`,
          },
          {
            role: "user",
            content: `Category: "${category}"${tagsInfo}
Submitted word: "${cleanWord}"

Is this word ACCEPTED or REJECTED?`,
          },
        ],
        cleanWord
      );

      console.log(
        `OpenAI strict validation response for dictionary word "${cleanWord}":`,
        answer
      );

      // Parse single word response
      const normalizedAnswer = answer.trim().toUpperCase();
      fitsCategory = normalizedAnswer === "ACCEPT";
      if (!fitsCategory) {
        rejectionReason = "Does not fit the category";
      }
    } catch (error) {
      console.error(
        "OpenAI validation failed after all retries. Failing closed.",
        error
      );
      // Fail closed - return fitsCategory as false
      fitsCategory = false;
      rejectionReason = "Validation service unavailable";
    }

    // If category validation failed, return invalid
    if (fitsCategory === false) {
      const reason = rejectionReason || "Does not fit the category";
      await setCachedValidation({
        word: cleanWord,
        normalizedWord,
        category,
        isValid: false,
        fitsCategory: false,
        rejectionReason: reason,
        definition, // We might have a definition even if it doesn't fit
        validationSource: "openai-strict",
      });

      return {
        valid: false,
        word: cleanWord,
        fitsCategory: false,
        rejectionReason: reason,
      };
    }
  }

  // Success case
  await setCachedValidation({
    word: cleanWord,
    normalizedWord,
    category: category || "", // Should be present if we got here with fitsCategory logic, but handle potential empty
    isValid: true,
    fitsCategory: fitsCategory, // Could be undefined if no category
    definition,
    validationSource: "dictionary+openai",
  });

  return {
    valid: true,
    word: cleanWord,
    definition,
    fitsCategory,
  };
}