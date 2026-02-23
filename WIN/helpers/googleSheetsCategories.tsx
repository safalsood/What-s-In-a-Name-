import { CategoryItem } from "./categoryPool";

export const GOOGLE_SHEET_ID = "1tEleNU1mI1CLiPqoiOA8OJZFyUtEgygySPCP580on0A";

/**
 * Parses a CSV string into a 2D array of strings.
 * Handles quoted strings with commas and escaped quotes.
 * Handles Windows/Unix line endings.
 */
const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = "";
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        // Handle escaped quote ("") inside a quoted string
        currentVal += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote state
        insideQuote = !insideQuote;
      }
    } else if (char === "," && !insideQuote) {
      // End of cell
      currentRow.push(currentVal);
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !insideQuote) {
      // End of row
      // Handle \r\n sequence
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      // Only push if the row has content or we have accumulated values
      if (currentRow.length > 0 || currentVal.length > 0) {
        currentRow.push(currentVal);
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  // Push the last row if there's any remaining data
  if (currentRow.length > 0 || currentVal.length > 0) {
    currentRow.push(currentVal);
    rows.push(currentRow);
  }

  return rows;
};

/**
 * Fetches Base Categories from the configured Google Sheet.
 * Expects data in Column B (index 1).
 * Column A contains row numbers, Column B contains category names.
 */
export const fetchBaseCategoriesFromSheet = async (): Promise<
  CategoryItem[]
> => {
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=0`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.statusText}`);
    }

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    const categories: CategoryItem[] = [];

    // Iterate through rows
    rows.forEach((row, index) => {
      // Column B is index 1 (Column A contains row numbers)
      const rawValue = row[1];

      if (!rawValue) return;

      const cleanedValue = rawValue.trim();

      // Filter out empty values
      if (!cleanedValue) return;

      // Filter out likely headers (simple heuristic: exact match or row 0 if it looks like a header)
      // The prompt says "skip 'Category', 'Base Category', etc."
      const lowerVal = cleanedValue.toLowerCase();
      if (
        lowerVal === "category" ||
        lowerVal === "base category" ||
        lowerVal === "base_category"
      ) {
        return;
      }

      categories.push({
        id: `gs_${index}`, // Auto-generated ID based on row index
        name: cleanedValue,
      });
    });

    return categories;
  } catch (error) {
    console.error("Error fetching categories from Google Sheet:", error);
    return [];
  }
};

/**
 * Tries to fetch categories from Google Sheets.
 * If successful and returns data, uses it.
 * Otherwise, falls back to the provided local pool.
 */
export const getBaseCategoriesWithFallback = async (
  fallbackCategories: CategoryItem[]
): Promise<CategoryItem[]> => {
  console.log("Attempting to fetch Base Categories from Google Sheet...");
  const sheetCategories = await fetchBaseCategoriesFromSheet();

  if (sheetCategories && sheetCategories.length > 0) {
    console.log(
      `Successfully fetched ${sheetCategories.length} categories from Google Sheet.`
    );
    return sheetCategories;
  }

  console.warn(
    "Google Sheet fetch failed or returned empty. Using fallback categories."
  );
  return fallbackCategories;
};

// Re-export CategoryItem for convenience if needed by consumers of this file
export type { CategoryItem };