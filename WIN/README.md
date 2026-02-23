# WIN : What's in a name?
        
Build a multiplayer word game app 
GAME OVERVIEW 
This is a fast-paced competitive word game playable solo vs AI or multiplayer with friends 2–12 players 
CORE GAME SETUP 
Display 5 letters on screen at all times 
One of the 5 letters must always be a “tough letter” e.g. Q, X, Z 
A Base Category is revealed at the start of the match e.g. Animals, Colors, Adjectives 
Players must eventually form ONE final word using all collected letters that fits the Base Category 
ROUND LOGIC 
Each round has a 30-second timer 
A Round Category is revealed different from Base Category 
Players must submit a word that 
Fits the Round Category 
Starts with ONE of the 5 visible letters 
Is a valid English word 
The FIRST player to submit a valid word wins the round 
The starting letter used is added to the winner’s letter pile 
Once a valid word is accepted, the round immediately ends 
TOUGH LETTER BONUS 
If a player submits a valid word starting with a tough letter 
They receive +15 bonus seconds 
They may submit ONE additional word 
The bonus word must 
Be in the SAME round category 
Start with one of the remaining 4 letters 
If valid, the player earns an additional letter 
WORD VALIDATION RULES 
Words must exist in an English dictionary 
Words cannot be reused within the SAME category 
Words can be reused in different categories 
Prevent duplicate submissions per round 
NO-SUBMISSION LOGIC 
If no player submits a valid word within 30 seconds 
The Round Category changes letters stay the same 
This can happen up to 3 consecutive times 
If 3 failed rounds occur in a row 
Regenerate all 5 letters 
Change the Base Category 
Reset failure counter 
MATCH ENDING 
The first player who successfully submits a final word using ALL collected letters that fits the Base Category WINS immediately 
GAME MODES 
1 Solo vs AI multiple difficulty levels 
2 Private multiplayer rooms invite friends 
3 Optional public matchmaking 
AI BEHAVIOR 
AI difficulty controls response speed, word rarity, and tough-letter usage 
AI must follow exact same rules as humans 
FEATURES 
Real-time multiplayer 
Lobby creation + invite codes 
Player list with current collected letters 
Word history per category 
Basic animations and sound effects 
UI SCREENS 
Onboarding / Tutorial 
Home Play Solo / Play with Friends 
Lobby Screen 
Game Screen letters, timer, category, input 
Round Result Animation 
Winner Screen 
Settings 
Note that the game should use external dictionary API for word validation

Made with Floot.

# Instructions

For security reasons, the `env.json` file is not pre-populated — you will need to generate or retrieve the values yourself.  

For **JWT secrets**, generate a value with:  

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then paste the generated value into the appropriate field.  

For the **Floot Database**, download your database content as a pg_dump from the cog icon in the database view (right pane -> data -> floot data base -> cog icon on the left of the name), upload it to your own PostgreSQL database, and then fill in the connection string value.  

**Note:** Floot OAuth will not work in self-hosted environments.  

For other external services, retrieve your API keys and fill in the corresponding values.  

Once everything is configured, you can build and start the service with:  

```
npm install -g pnpm
pnpm install
pnpm vite build
pnpm tsx server.ts
```
