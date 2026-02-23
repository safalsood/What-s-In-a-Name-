import { useState, useEffect } from "react";
import styles from "./LoadingQuotes.module.css";

const QUOTES = [
  { text: "The pen is mightier than the sword.", author: "Edward Bulwer-Lytton" },
  { text: "Words are, of course, the most powerful drug used by mankind.", author: "Rudyard Kipling" },
  { text: "To be, or not to be, that is the question.", author: "Shakespeare" },
  { text: "I have a dream...", author: "Martin Luther King Jr." },
  { text: "The only thing we have to fear is fear itself.", author: "FDR" },
  { text: "May the Force be with you.", author: "Star Wars" },
  { text: "Here's looking at you, kid.", author: "Casablanca" },
  { text: "We shall fight on the beaches...", author: "Winston Churchill" },
  { text: "A word after a word after a word is power.", author: "Margaret Atwood" },
  { text: "Language is the dress of thought.", author: "Samuel Johnson" },
];

export function LoadingQuotes() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % QUOTES.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const quote = QUOTES[index];

  return (
    <div className={styles.container}>
      <div key={index} className={styles.fadeWrapper}>
        <p className={styles.quote}>"{quote.text}"</p>
        <p className={styles.author}>— {quote.author}</p>
      </div>
    </div>
  );
}