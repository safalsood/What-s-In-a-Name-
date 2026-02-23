import { CATEGORIES as EXISTING_BASE_CATEGORIES } from "./gameLogic";

export interface CategoryItem {
  id: string;
  name: string;
}

// A subset of broad categories suitable for the "Base Category" (The final goal)
// We can reuse the ones from gameLogic or define a specific set here.
// To ensure consistency with the prompt's request for a "comprehensive pool", 
// we will define a robust list here.
export const BASE_CATEGORY_POOL: CategoryItem[] = [
  { id: "animals", name: "Animals" },
  { id: "foods", name: "Foods" },
  { id: "professions", name: "Professions" },
  { id: "countries", name: "Countries" },
  { id: "colors", name: "Colors" },
  { id: "sports", name: "Sports" },
  { id: "clothing", name: "Clothing" },
  { id: "emotions", name: "Emotions" },
  { id: "household_items", name: "Household Items" },
  { id: "nature", name: "Nature" },
  { id: "transportation", name: "Transportation" },
  { id: "body_parts", name: "Body Parts" },
  { id: "hobbies", name: "Hobbies" },
  { id: "music", name: "Music" },
  { id: "movies", name: "Movies" },
];

// The massive pool for "Round Categories" (Mini categories)
export const CATEGORY_POOL: CategoryItem[] = [
  // --- ANIMALS & NATURE (Easy/General) ---
  { id: "c1", name: "Animals found in a zoo" },
  { id: "c2", name: "Animals that swim" },
  { id: "c3", name: "Birds that can fly" },
  { id: "c4", name: "Insects with wings" },
  { id: "c5", name: "Farm animals" },
  { id: "c6", name: "Pets you can keep at home" },
  { id: "c7", name: "Animals with tails" },
  { id: "c8", name: "Animals that lay eggs" },
  { id: "c9", name: "Flowers found in a garden" },
  { id: "c10", name: "Trees that lose leaves" },
  { id: "c11", name: "Things found in a forest" },
  { id: "c12", name: "Things found at the beach" },
  { id: "c13", name: "Weather conditions" },
  { id: "c14", name: "Natural disasters" },
  { id: "c15", name: "Planets in our solar system" },
  { id: "c16", name: "Animals that are dangerous" },
  { id: "c17", name: "Animals that hibernate" },
  { id: "c18", name: "Sea creatures" },
  { id: "c19", name: "Jungle animals" },
  { id: "c20", name: "Arctic animals" },
  
  // --- FOOD & DRINK (Easy/General) ---
  { id: "c21", name: "Fruits that are red" },
  { id: "c22", name: "Vegetables that are green" },
  { id: "c23", name: "Breakfast foods" },
  { id: "c24", name: "Pizza toppings" },
  { id: "c25", name: "Ice cream flavors" },
  { id: "c26", name: "Sandwich ingredients" },
  { id: "c27", name: "Things you bake" },
  { id: "c28", name: "Spicy foods" },
  { id: "c29", name: "Sweet treats" },
  { id: "c30", name: "Salty snacks" },
  { id: "c31", name: "Drinks served hot" },
  { id: "c32", name: "Carbonated drinks" },
  { id: "c33", name: "Fried foods" },
  { id: "c34", name: "Foods you eat with a spoon" },
  { id: "c35", name: "Italian dishes" },
  { id: "c36", name: "Mexican dishes" },
  { id: "c37", name: "Fruits with seeds" },
  { id: "c38", name: "Dairy products" },
  { id: "c39", name: "Meat dishes" },
  { id: "c40", name: "Seafood dishes" },

  // --- HOUSE & HOME (Easy/General) ---
  { id: "c41", name: "Things in a kitchen" },
  { id: "c42", name: "Furniture in a living room" },
  { id: "c43", name: "Things in a bathroom" },
  { id: "c44", name: "Items in a bedroom" },
  { id: "c45", name: "Things found in a garage" },
  { id: "c46", name: "Kitchen appliances" },
  { id: "c47", name: "Things you find in a drawer" },
  { id: "c48", name: "Cleaning supplies" },
  { id: "c49", name: "Things on a wall" },
  { id: "c50", name: "Things on a desk" },
  { id: "c51", name: "Gardening tools" },
  { id: "c52", name: "Things made of wood" },
  { id: "c53", name: "Things made of glass" },
  { id: "c54", name: "Things made of plastic" },
  { id: "c55", name: "Things made of metal" },
  { id: "c56", name: "Sharp objects" },
  { id: "c57", name: "Soft objects" },
  { id: "c58", name: "Heavy objects" },
  { id: "c59", name: "Electronic devices" },
  { id: "c60", name: "Things with buttons" },

  // --- PEOPLE & PROFESSIONS (Easy/General) ---
  { id: "c61", name: "Jobs that require a uniform" },
  { id: "c62", name: "Medical professions" },
  { id: "c63", name: "Jobs that work outside" },
  { id: "c64", name: "Jobs involving animals" },
  { id: "c65", name: "Family members" },
  { id: "c66", name: "Words describing personality" },
  { id: "c67", name: "Positive traits" },
  { id: "c68", name: "Negative traits" },
  { id: "c69", name: "Famous male actors" },
  { id: "c70", name: "Famous female singers" },
  { id: "c71", name: "Superheroes" },
  { id: "c72", name: "Villains" },
  { id: "c73", name: "Historical figures" },
  { id: "c74", name: "Fictional characters" },
  { id: "c75", name: "Sports players" },
  { id: "c76", name: "Things a baby does" },
  { id: "c77", name: "Things a teacher uses" },
  { id: "c78", name: "Things a doctor uses" },
  { id: "c79", name: "Things a chef uses" },
  { id: "c80", name: "Things an artist uses" },

  // --- PLACES & TRAVEL (Easy/General) ---
  { id: "c81", name: "Countries in Europe" },
  { id: "c82", name: "Countries in Asia" },
  { id: "c83", name: "Cities in the USA" },
  { id: "c84", name: "Capital cities" },
  { id: "c85", name: "Places to go on vacation" },
  { id: "c86", name: "Things found at an airport" },
  { id: "c87", name: "Things found in a hotel" },
  { id: "c88", name: "Modes of transportation" },
  { id: "c89", name: "Things with wheels" },
  { id: "c90", name: "Things that fly" },
  { id: "c91", name: "Things that float" },
  { id: "c92", name: "Camping equipment" },
  { id: "c93", name: "Things you pack in a suitcase" },
  { id: "c94", name: "Places to swim" },
  { id: "c96", name: "Rooms in a house" },
  { id: "c97", name: "Shops in a mall" },
  { id: "c98", name: "Places to eat" },
  { id: "c99", name: "Tourist attractions" },
  { id: "c100", name: "Continents" },

  // --- CLOTHING & ACCESSORIES (Easy/General) ---
  { id: "c101", name: "Winter clothing" },
  { id: "c102", name: "Summer clothing" },
  { id: "c103", name: "Footwear" },
  { id: "c104", name: "Headwear" },
  { id: "c105", name: "Jewelry" },
  { id: "c106", name: "Things you wear on your hands" },
  { id: "c107", name: "Things with zippers" },
  { id: "c108", name: "Things with pockets" },
  { id: "c109", name: "Makeup items" },
  { id: "c110", name: "Hair accessories" },

  // --- SPORTS & HOBBIES (Medium) ---
  { id: "c111", name: "Team sports" },
  { id: "c112", name: "Water sports" },
  { id: "c113", name: "Winter sports" },
  { id: "c114", name: "Ball games" },
  { id: "c115", name: "Olympic events" },
  { id: "c116", name: "Board games" },
  { id: "c117", name: "Card games" },
  { id: "c118", name: "Musical instruments" },
  { id: "c119", name: "Types of dance" },
  { id: "c120", name: "Art supplies" },
  { id: "c121", name: "Outdoor activities" },
  { id: "c122", name: "Gym equipment" },
  { id: "c123", name: "Hobbies you do alone" },
  { id: "c124", name: "Hobbies you do in groups" },
  { id: "c125", name: "Things you collect" },

  // --- ABSTRACT & CONCEPTS (Medium/Hard) ---
  { id: "c126", name: "Words describing speed" },
  { id: "c127", name: "Words describing size" },
  { id: "c128", name: "Words describing sound" },
  { id: "c129", name: "Words describing smell" },
  { id: "c130", name: "Words describing texture" },
  { id: "c131", name: "Colors found in nature" },
  { id: "c132", name: "Shades of blue" },
  { id: "c133", name: "Shades of red" },
  { id: "c134", name: "Units of measurement" },
  { id: "c135", name: "Mathematical terms" },
  { id: "c136", name: "Scientific fields" },
  { id: "c137", name: "School subjects" },
  { id: "c138", name: "Languages" },
  { id: "c139", name: "Currencies" },
  { id: "c140", name: "Holidays" },

  // --- ACTIONS & VERBS (Medium) ---
  { id: "c141", name: "Things you do at a party" },
  { id: "c142", name: "Things you do in the morning" },
  { id: "c143", name: "Things you do before bed" },
  { id: "c144", name: "Things you do at school" },
  { id: "c145", name: "Things you do at work" },
  { id: "c146", name: "Ways to cook food" },
  { id: "c147", name: "Ways to move" },
  { id: "c148", name: "Ways to communicate" },
  { id: "c149", name: "Noises animals make" },
  { id: "c150", name: "Noises humans make" },

  // --- ENTERTAINMENT & MEDIA (Medium) ---
  { id: "c151", name: "Movie genres" },
  { id: "c152", name: "Music genres" },
  { id: "c153", name: "TV show genres" },
  { id: "c154", name: "Disney movies" },
  { id: "c155", name: "Pixar movies" },
  { id: "c156", name: "Video game genres" },
  { id: "c157", name: "Social media apps" },
  { id: "c158", name: "Computer parts" },
  { id: "c159", name: "Smartphone brands" },
  { id: "c160", name: "Car brands" },

  // --- MISCELLANEOUS (Mixed) ---
  { id: "c161", name: "Things that are sticky" },
  { id: "c162", name: "Things that are cold" },
  { id: "c163", name: "Things that are hot" },
  { id: "c164", name: "Things that are round" },
  { id: "c165", name: "Things that are square" },
  { id: "c166", name: "Things that are flat" },
  { id: "c167", name: "Things that smell good" },
  { id: "c168", name: "Things that smell bad" },
  { id: "c169", name: "Things that make noise" },
  { id: "c170", name: "Things that are silent" },
  { id: "c171", name: "Things you can recycle" },
  { id: "c172", name: "Things you throw away" },
  { id: "c173", name: "Things in a toolbox" },
  { id: "c174", name: "Things in a first aid kit" },
  { id: "c175", name: "Things in a purse" },
  { id: "c176", name: "Things in a wallet" },
  { id: "c177", name: "Things in a backpack" },
  { id: "c178", name: "Things in a glove compartment" },
  { id: "c179", name: "Things in a refrigerator" },
  { id: "c180", name: "Things in a pantry" },

  // --- SLIGHTLY CHALLENGING (Hard - 5%) ---
  { id: "c181", name: "Words ending in 'Y'" },
  { id: "c182", name: "Words with double letters" },
  { id: "c183", name: "Palindromes" },
  { id: "c184", name: "Compound words" },
  { id: "c185", name: "Rhyming words" },
  { id: "c186", name: "Three-letter words" },
  { id: "c187", name: "Five-letter words" },
  { id: "c188", name: "Words starting with vowels" },
  { id: "c189", name: "Constellations" },
  { id: "c190", name: "Chemical elements" },
  { id: "c191", name: "Bones in the body" },
  { id: "c192", name: "Internal organs" },
  { id: "c193", name: "Presidents/Leaders" },
  { id: "c194", name: "Capital cities in Europe" },
  { id: "c195", name: "Rivers" },
  { id: "c196", name: "Mountains" },
  { id: "c197", name: "Oceans and Seas" },
  { id: "c198", name: "Islands" },
  { id: "c199", name: "Deserts" },
  { id: "c200", name: "Gemstones" },
  { id: "c201", name: "Dog breeds" },
  { id: "c202", name: "Cat breeds" },
  { id: "c203", name: "Bird species" },
  { id: "c204", name: "Fish species" },
  { id: "c205", name: "Tree types" },
];

/**
 * Returns a list of random categories from the pool, excluding specified names.
 * @param excludeNames Array of category names to exclude (to prevent repeats)
 * @param count Number of categories to return
 */
export const getRandomCategories = (excludeNames: string[] = [], count: number = 1): CategoryItem[] => {
  // Filter out excluded categories
  const available = CATEGORY_POOL.filter(c => !excludeNames.includes(c.name));
  
  // If we ran out of categories (unlikely given the size), fallback to the full pool
  const pool = available.length < count ? CATEGORY_POOL : available;
  
  // Shuffle and slice
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

/**
 * Returns the pool of base categories (broad themes).
 */
export const getBaseCategoryPool = (): CategoryItem[] => {
  return BASE_CATEGORY_POOL;
};