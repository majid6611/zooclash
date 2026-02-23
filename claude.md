# CLAUDE.md — ZooClash (Telegram Mini App + Bot)

## What this project is
**ZooClash** is a **Telegram Mini App game** that is tightly connected to a **Telegram Bot**.

- The **Mini App** is the main gameplay UI (cards, arranging, guessing, turn actions).
- The **Bot** is the notification + entry + lightweight control layer (start, alerts, “your turn”, results).
- The web domain for the Mini App is:
  - **http://zooclash.meerkscan.com/**

### Core fantasy
A fast 1v1 “zoo card duel”:
- Each player builds a secret “hand layout” (their card arrangement).
- The opponent tries to guess it.
- Both players do this (each sets a hand, each guesses the other).

---

## Key requirements
### 1) Telegram integration (must)
- Mini App must be opened from Telegram and authenticated via Telegram Mini App init data.
- Bot must be able to message users at important moments (turn changes, game finished, etc.)
- User identity must be based on Telegram user, but gameplay happens inside the Mini App.

### 2) Home / Lobby (must)
The Mini App needs a “home” screen with:
- A clear **Create Match** CTA
- A list of **Open Matches** (joinable)

### 3) Two-player turn-based gameplay (must)
A match is always between exactly **two players** (creator + joiner).

High-level flow:
1. Player A creates match
2. Player A sets their secret hand layout
3. Player B joins match
4. Player B sets their secret hand layout
5. Guessing phase starts:
   - Player A guesses B’s layout
   - Player B guesses A’s layout
6. Match ends and results are computed + announced

This can be asynchronous:
- One player may play now, the other later.
- We must support turn reminders through the bot.

---

## Temporary testing mode (MVP-only)
For testing during development only:
- Allow **single-player testing** where **one person can play as both sides** (simulate opponent).
- This mode must be clearly marked as **TEST ONLY**.
- Later (production) this must be disabled: **a real match requires two distinct Telegram users**.

---

## Bot notification rules (must)
The bot must send messages after **each meaningful action/turn** so players know what happened.

### When a player finishes their action, send:
- To both players:
  - “Player X made a move in Match #ID.”
- If now it’s the other player’s turn:
  - Send to that other player:
    - “It’s your turn now. Open the game: zooclash.meerkscan.com”
- If match is finished:
  - Send the final results summary to **both** players.

These bot messages are not optional — they are a core part of the user experience.

---

## Game turns / “hand” concept
Each player has a secret arrangement (“hand layout”).
The guessing system should feel like:
- Player sees their own hand.
- Player never sees opponent’s true hand until the match ends.
- Player makes guesses via Mini App UI.

After each guess:
- The UI should give minimal feedback suitable for a guessing game (e.g., “correct positions: N” / “matches: N” — exact design can vary, but it must enable progression).

---

## Guess attempts & scoring (must)
### Guess attempts per player
- Each player can guess the opponent’s hand **up to 10 times** per match.

### Points per guess attempt (per player)
- A player starts with **10 guess points**.
- Every time they submit a guess, their potential points decrease:
  - 1st guess: 10
  - 2nd guess: 9
  - 3rd guess: 8
  - ...
  - 10th guess: 1
  - If you allow a “final” exhausted attempt outcome, minimum should be **0** (but do not allow more than 10 guesses).
- In other words, the guess score is **10 → 0** depending on how many attempts it took.
  - Preferred simple formula:
    - `guessScore = max(0, 11 - attemptsUsed)`
    - where `attemptsUsed` starts at 1 for the first submitted guess.

### Match result points (win/draw/lose)
After both players have completed their guessing phase (or one side runs out of attempts / match finishes by rule), compute match outcome:

- **Win**: 3 match points
- **Draw**: 1 match point each
- **Lose**: 0 match points

### How to decide winner (required logic)
Use this priority order (simple and deterministic):
1) Compare players by who successfully guessed the opponent’s hand correctly.
   - If only one guessed correctly → that player wins.
2) If both guessed correctly → the one with higher `guessScore` wins (fewer attempts).
3) If neither guessed correctly within 10 attempts → draw (or decide by best partial score if you implement partial feedback; MVP can be draw).
4) If equal under the rules → draw.

Final score payload should include:
- attempts used by each player
- guessScore for each player
- match points (3/1/0)
- who won / draw

---

## Expected UX behavior
### The Mini App must:
- Make it obvious what phase the match is in:
  - waiting for opponent
  - opponent joined, set your hand
  - guess opponent hand (attempts left)
  - waiting for opponent’s guess
  - finished (show results)
- Show remaining attempts: `Attempts left: 7/10` etc.
- Prevent actions that are not allowed in the current phase.
- Be resilient to refresh/reopen (state must be restored when reopened).

### The Bot must:
- Act as “push notifications”
- Keep text short and clear
- Always include a “Open game” deep link to the mini app (domain above)

---

## Copy / message templates (suggested)
You can tweak wording, but keep intent.

### Action happened
- “🐾 Match #123: Majid played a move.”

### Your turn
- “⏳ Match #123: It’s your turn now! Open ZooClash: http://zooclash.meerkscan.com/”

### Finished
- “🏁 Match #123 finished!
Majid: GuessScore 7, MatchPoints 3
Opponent: GuessScore 4, MatchPoints 0
Winner: Majid”

---

## Non-negotiables
- This is a **Telegram Mini App connected to a Bot**.
- Home must show **Open Matches list**.
- **Bot messages after each turn** + “your turn” + results.
- **Up to 10 guesses** per player; points decrease **10 → 0**.
- **Win=3 / Draw=1 / Lose=0**.

---

## Notes for implementation agents
- Do not over-engineer the MVP.
- Build state transitions carefully (no invalid moves).
- Testing mode (single-person plays both sides) must be **temporary** and easy to remove/disable later.

this project must be impmeneted with docker compose file
we have setup prostgrsql database, ask for login
must be behind the nginx.