import { sql } from "kysely";
import { db } from "./db";

// Define a local type to avoid circular dependency with wordValidator
export interface CachedValidationResult {
  valid: boolean;
  word: string;
  definition?: string;
  fitsCategory?: boolean;
  rejectionReason?: string;
  error?: string;
}

export interface CacheValidationParams {
  word: string;
  normalizedWord: string;
  category: string;
  isValid: boolean;
  definition?: string;
  fitsCategory?: boolean;
  rejectionReason?: string;
  validationSource?: string;
}

/**
 * Retrieves a validation result from the cache if it exists and is fresh (within 24 hours).
 */
export async function getCachedValidation(
  normalizedWord: string,
  category: string
): Promise<CachedValidationResult | null> {
  try {
    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await db
      .selectFrom("wordValidationCache")
      .select([
        "word",
        "isValid",
        "definition",
        "fitsCategory",
        "rejectionReason",
        "updatedAt",
      ])
      .where("normalizedWord", "=", normalizedWord)
      .where("category", "=", category)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

        // Check if the cache is stale
    // The updatedAt field from DB might be a Date object or string depending on the driver configuration
    if (!result.updatedAt) {
      console.log(`[Cache] Cache hit but missing updatedAt for word "${normalizedWord}" in category "${category}"`);
      return null;
    }
    const updatedAt = result.updatedAt instanceof Date 
      ? result.updatedAt 
      : new Date(result.updatedAt as unknown as string);

    if (updatedAt < twentyFourHoursAgo) {
      console.log(`[Cache] Cache hit but stale for word "${normalizedWord}" in category "${category}"`);
      return null;
    }

    console.log(`[Cache] Cache hit for word "${normalizedWord}" in category "${category}"`);
    
    return {
      valid: result.isValid,
      word: result.word,
      definition: result.definition || undefined,
      fitsCategory: result.fitsCategory === null ? undefined : result.fitsCategory,
      rejectionReason: result.rejectionReason || undefined,
    };
  } catch (error) {
    console.error("Error retrieving cached validation:", error);
    return null; // Fail open (proceed to full validation) if cache check fails
  }
}

/**
 * Saves or updates a validation result in the cache.
 */
export async function setCachedValidation(params: CacheValidationParams): Promise<void> {
  try {
    const {
      word,
      normalizedWord,
      category,
      isValid,
      definition,
      fitsCategory,
      rejectionReason,
      validationSource,
    } = params;

    await db
      .insertInto("wordValidationCache")
      .values({
        word,
        normalizedWord,
        category,
        isValid,
        definition: definition || null,
        fitsCategory: fitsCategory === undefined ? null : fitsCategory,
        rejectionReason: rejectionReason || null,
        validationSource: validationSource || "system",
        updatedAt: new Date(), // Set explicit update time
        createdAt: new Date(), // Won't be used on update but needed for insert
      })
      .onConflict((oc) =>
        oc.columns(["normalizedWord", "category"]).doUpdateSet({
          isValid: (eb) => eb.ref("excluded.isValid"),
          definition: (eb) => eb.ref("excluded.definition"),
          fitsCategory: (eb) => eb.ref("excluded.fitsCategory"),
          rejectionReason: (eb) => eb.ref("excluded.rejectionReason"),
          validationSource: (eb) => eb.ref("excluded.validationSource"),
          updatedAt: new Date(), // Update timestamp
          word: (eb) => eb.ref("excluded.word"), // Update casing if changed
        })
      )
      .execute();

    console.log(`[Cache] Cached result for word "${word}" in category "${category}"`);
  } catch (error) {
    console.error("Error saving cached validation:", error);
    // Don't throw, just log error so we don't block the response
  }
}