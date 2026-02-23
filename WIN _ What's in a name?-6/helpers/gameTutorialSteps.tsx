export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  mockGameState: "welcome" | "letters" | "miniCategory" | "typing" | "letterEarned" | "grandCategory" | "victory";
}

// Fixed demo scenario
export const DEMO_LETTERS = ["S", "H", "E", "P", "Z"];
export const DEMO_MINI_CATEGORY = "Cake Ingredients";
export const DEMO_MINI_ANSWER = "SUGAR";
export const DEMO_EARNED_LETTER = "S";
export const DEMO_GRAND_CATEGORY = "Animals";
export const DEMO_COLLECTED_LETTERS = ["S", "H", "E", "E", "P"];
export const DEMO_GRAND_ANSWER = "SHEEP";

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Word Challenge!",
    text: "Collect letters by submitting words in the mini category, then use them to form a word that falls in the Grand Category. Let's see how it works!",
    mockGameState: "welcome",
  },
  {
    id: "letters",
    title: "Available Letters",
    text: `Each round shows 5 letters. Your word must START with one of these letters. The ⚡ symbol marks "tough" letters like Z that earns you bonus time to submit more words.`,
    mockGameState: "letters",
  },
  {
    id: "miniCategory",
    title: "Mini Category",
    text: `Each round has a Mini Category. Your word must fit this category to win the round. In this example, the category is "${DEMO_MINI_CATEGORY}".`,
    mockGameState: "miniCategory",
  },
  {
    id: "typing",
    title: "Submit Your Word",
    text: `Type a word that starts with an available letter and fits the Mini Category, then tap Submit Mini. Here we're submitting "${DEMO_MINI_ANSWER}"!`,
    mockGameState: "typing",
  },
  {
    id: "letterEarned",
    title: "Collect the Letter!",
    text: `Success! You earned the letter "${DEMO_EARNED_LETTER}" (the first letter of your word). Collect more letters each round to build toward your final word.`,
    mockGameState: "letterEarned",
  },
  {
    id: "grandCategory",
    title: "The Grand Category",
    text: `Your ultimate goal! Once you've collected at least 4 letters, form a word using ONLY your collected letters that fits the Grand Category. Here it's "${DEMO_GRAND_CATEGORY}".`,
    mockGameState: "grandCategory",
  },
  {
    id: "victory",
    title: "Win the Game!",
    text: `With letters ${DEMO_COLLECTED_LETTERS.join(", ")}, we can form "${DEMO_GRAND_ANSWER}" which is an animal. Submit it with the Grand button to win!`,
    mockGameState: "victory",
  },
];