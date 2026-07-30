# 🐺 Werewolf Night. 

A 6-player social-deduction game (Chinese-style 狼人杀 6-board). Five of the players are
AI characters played by Claude. One is you. The AI characters keep persistent diaries
between games — grudges, debts and reputations carry over. 

## Setup

1. **Get an Anthropic API key** at [console.anthropic.com](https://console.anthropic.com).
2. **Create your `.env`:**

   ```sh
   cp .env.example .env
   # then open .env and paste your key
   ``` 

3. **Install & run:**

   ```sh
   npm install
   npm run dev
   ```

   This starts both the Express proxy (port 8787) and the Vite dev server, and opens
   the game at **http://localhost:5173**.

## Notes

- The API key lives only in `.env` on the server side; it is never sent to the browser.
- The default model is `claude-sonnet-4-6`. To play cheaper games, change the model in
  [`src/config.js`](src/config.js) to `claude-haiku-4-5-20251001`.
- Diaries and the game counter persist in your browser's `localStorage` under the key
  `ww:save`. Use "Burn all diaries" in the lobby to reset the characters' memories.
- If the server is stopped or the key is missing, the game degrades gracefully:
  AI characters fall back to random (but legal) moves and the game continues.

## Scripts

| Command        | What it does                                            |
| -------------- | ------------------------------------------------------- |
| `npm run dev`  | Run server + client together                            |
| `npm test`     | Auto-play 500 headless games with stub AI (engine test) |
| `npm run build`| Production build of the client                          |

## The law of the village

Six souls, two liars. Each game deals 2 Werewolves, 1 Seer, 1 Witch and 2 Villagers at
random — you get a random role too. By night the wolves kill, the seer peers, and the
witch weighs her two potions. By morning only names are spoken, never causes. By day
everyone speaks once, then votes openly. Banished players keep their secrets. The
village wins when both wolves hang; the wolves win when both villagers — or both the
seer and the witch — are gone. And when the game ends, the characters write their
diaries. They will remember.

## About

This is a JavaScript project created for learning and experimentation.
