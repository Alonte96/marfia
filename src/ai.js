// AI player system. One model plays all five characters via separate,
// stateless calls. Information hiding is the core requirement: each call
// receives ONLY what that character legitimately knows.
//
// Every function here NEVER throws — on any failure (network down, bad JSON,
// illegal choice) it applies the documented fallback so the game continues.
import { CONFIG } from './config.js';
import {
  PERSONALITIES,
  ROLE_LABEL,
  living,
  byName,
  votePool,
  wolfPartner,
  stubWolfKill,
  stubSeerCheck,
  stubVote,
} from './engine.js';

// ---------------------------------------------------------------- transport

// Circuit breaker: when the API is unreachable (server stopped, key missing),
// stop probing it on every single action — retry at most every 25s. Keeps
// degraded games fast and the console quiet; recovers when the server returns.
let breakerUntil = 0;
const BREAKER_MS = 25000;

// UI hint: true while the breaker is open (API unreachable / no credits).
export function apiDown() {
  return Date.now() < breakerUntil;
}

async function callClaude(prompt) {
  if (Date.now() < breakerUntil) throw new Error('api circuit open');
  let res;
  try {
    res = await doFetch(prompt);
  } catch (err) {
    breakerUntil = Date.now() + BREAKER_MS;
    throw err;
  }
  breakerUntil = 0;
  return res;
}

async function doFetch(prompt) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.model,
      max_tokens: CONFIG.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`api ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : 'upstream error');
  const text = (data.content || []).find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('empty response');
  return text;
}

// Strip ``` fences and grab the first {...} object.
function parseJSON(text) {
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('no JSON object found');
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ---------------------------------------------------------------- prompt building

const RULES = `THE GAME — Werewolf Night, six players at one table: 2 Werewolves, 1 Seer, 1 Witch, 2 Villagers, dealt secretly at random. One player at this table is a human whose in-game name is literally "You" — treat "You" as an ordinary player name like any other.
Each night: the wolves secretly choose one player to kill (they may even pick a wolf as a bluff); the Seer secretly checks whether one player is a wolf; the Witch is shown the wolves' victim and may use her single save potion, or her single poison potion, or nothing.
Each morning, deaths are announced by NAME ONLY — never the cause, never the role. By day every living player speaks once, then everyone votes in the open to banish someone. A banished player's role stays HIDDEN.
The village wins when both Werewolves are dead. The wolves win when both Villagers are dead OR when both the Seer and the Witch are dead. Roles are only revealed when the game ends.`;

function roleSecrets(state, player) {
  const lines = [`YOUR SECRET ROLE: ${ROLE_LABEL[player.role].toUpperCase()}`];
  if (player.role === 'wolf') {
    const partner = wolfPartner(state, player.id);
    lines.push(
      `Your fellow werewolf is ${partner.name} (${partner.alive ? 'still alive' : 'dead'}).`,
      `You must lie, deflect suspicion, and you may fake-claim to be the Seer, the Witch, or a Villager. NEVER admit that you or ${partner.name} is a wolf, and never vote in a way that obviously protects each other.`,
    );
  } else if (player.role === 'seer') {
    if (state.seerChecks.length === 0) {
      lines.push('You have not checked anyone yet.');
    } else {
      lines.push(
        'Your secret checks so far: ' +
          state.seerChecks
            .map((c) => `night ${c.day}: ${state.players[c.targetId].name} — ${c.isWolf ? 'WOLF' : 'NOT A WOLF'}`)
            .join('; ') +
          '.',
      );
    }
  } else if (player.role === 'witch') {
    lines.push(
      `Save potion: ${state.witch.save ? 'still available' : 'ALREADY USED'}. Poison potion: ${state.witch.poison ? 'still available' : 'ALREADY USED'}.`,
    );
    if (state.witch.shown.length > 0) {
      lines.push(
        'Victims the wolves chose (shown only to you): ' +
          state.witch.shown.map((s) => `night ${s.day}: ${state.players[s.victimId].name}`).join('; ') +
          '.',
      );
    }
  } else {
    lines.push('You have no special power — only your wits, your memory, and your vote.');
  }
  return lines.join('\n');
}

function diarySection(save, name) {
  const entries = save?.diaries?.[name] || [];
  if (entries.length === 0) {
    return 'YOUR DIARY of past games with these same players (grudges and debts carry over):\n(blank — this is your first game with them)';
  }
  return (
    'YOUR DIARY of past games with these same players (grudges and debts carry over):\n' +
    entries.map((e) => `- ${e}`).join('\n')
  );
}

function chronicle(state) {
  const lines = state.log.slice(-45).map((e) => {
    switch (e.type) {
      case 'phase':
        return `— ${e.text} —`;
      case 'speech':
        return `${state.players[e.playerId].name}: "${e.text}"`;
      case 'vote':
        return `vote: ${e.text}`;
      default:
        return e.text;
    }
  });
  return 'THE PUBLIC CHRONICLE so far:\n' + (lines.length ? lines.join('\n') : '(nothing has happened yet)');
}

const JSON_ONLY = 'Respond with ONLY a raw JSON object. No markdown, no backticks, no extra text.';

export function buildPrompt(state, player, save, task) {
  return [
    `You are ${player.name}, ${PERSONALITIES[player.name]}. You are playing a live game of Werewolf against the five other players.`,
    RULES,
    roleSecrets(state, player),
    diarySection(save, player.name),
    'LIVING PLAYERS: ' + living(state).map((p) => p.name).join(', '),
    chronicle(state),
    task,
    JSON_ONLY,
  ].join('\n\n');
}

function namesOf(state, ids) {
  return ids.map((id) => state.players[id].name).join(', ');
}

function clip(text, max) {
  const t = String(text || '').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

// ---------------------------------------------------------------- decisions
// Each returns a validated, always-legal result.

// The speeches already made today, so a speaker can battle them directly.
function saidToday(state) {
  let lastPhase = -1;
  state.log.forEach((e, i) => {
    if (e.type === 'phase') lastPhase = i;
  });
  const speeches = state.log.slice(lastPhase + 1).filter((e) => e.type === 'speech');
  if (speeches.length === 0) {
    return 'You are the FIRST to speak today. Set the agenda: point a finger at someone by name and say why, plant a doubt, or stake a claim the others must respond to.';
  }
  return (
    'SAID TODAY SO FAR, IN ORDER — you are answering these people to their faces:\n' +
    speeches.map((e) => `${state.players[e.playerId].name}: "${e.text}"`).join('\n')
  );
}

export async function aiSpeech(state, playerId, save) {
  const player = state.players[playerId];
  const task = `It is day ${state.day} and it is YOUR turn to speak in the village debate.

${saidToday(state)}

In at most 45 words, fully in character, ENGAGE DIRECTLY with what was said before you: rebut any accusation aimed at you, challenge a claim that doesn't add up, back another speaker or turn on them — always naming names. Push the debate toward what helps YOUR side win. Lying and fake role claims are allowed and often wise. Never admit to being a wolf.
Schema: {"speech":"what you say aloud, max 45 words","thought":"your true hidden reasoning, max 20 words"}`;
  try {
    const raw = await callClaude(buildPrompt(state, player, save, task));
    const obj = parseJSON(raw);
    const speech = clip(obj.speech, 320);
    if (!speech) throw new Error('empty speech');
    return { text: speech, thought: clip(obj.thought, 200) || null };
  } catch {
    return { text: '…', thought: '(the words would not come)' };
  }
}

export async function aiVote(state, voterId, save) {
  const player = state.players[voterId];
  const pool = votePool(state, voterId);
  const task = `${state.isRevote ? `The vote TIED between ${namesOf(state, state.tiePool.filter((id) => state.players[id].alive))}. This is the revote — you must choose among the tied players only.` : 'It is time to vote, in the open, to banish one player.'} You may not vote for yourself. Choose exactly one of: ${namesOf(state, pool)}.
Schema: {"vote":"Name","thought":"your true hidden reasoning, max 20 words"}`;
  try {
    const raw = await callClaude(buildPrompt(state, player, save, task));
    const obj = parseJSON(raw);
    const target = byName(state, String(obj.vote || '').trim());
    if (!target || !pool.includes(target.id)) throw new Error('illegal vote');
    return { targetId: target.id, thought: clip(obj.thought, 200) || null };
  } catch {
    return stubVote(state, voterId);
  }
}

export async function aiWolfKill(state, actorId, save) {
  const player = state.players[actorId];
  const options = living(state);
  const task = `It is night ${state.day}. As a werewolf you now choose tonight's kill for the pack. You may target ANY living player — including your fellow wolf or even yourself: a "self-knife" is a real tactic that can bait the witch into wasting her save potion and make the wounded wolf look innocent for days. Choose exactly one of: ${options.map((p) => p.name).join(', ')}.
Schema: {"kill":"Name","thought":"your true hidden reasoning, max 20 words"}`;
  try {
    const raw = await callClaude(buildPrompt(state, player, save, task));
    const obj = parseJSON(raw);
    const target = byName(state, String(obj.kill || '').trim());
    if (!target || !target.alive) throw new Error('illegal kill');
    return { targetId: target.id, thought: clip(obj.thought, 200) || null };
  } catch {
    return stubWolfKill(state, actorId);
  }
}

export async function aiSeerCheck(state, actorId, save) {
  const player = state.players[actorId];
  const checked = new Set(state.seerChecks.map((c) => c.targetId));
  const options = living(state).filter((p) => p.id !== actorId);
  const fresh = options.filter((p) => !checked.has(p.id));
  const task = `It is night ${state.day}. Your sight opens: secretly check one living player and learn whether they are a wolf. You cannot check yourself. Prefer players you have not checked before${fresh.length ? ` (${fresh.map((p) => p.name).join(', ')})` : ''}. Choose exactly one of: ${options.map((p) => p.name).join(', ')}.
Schema: {"check":"Name","thought":"your true hidden reasoning, max 20 words"}`;
  try {
    const raw = await callClaude(buildPrompt(state, player, save, task));
    const obj = parseJSON(raw);
    const target = byName(state, String(obj.check || '').trim());
    if (!target || !target.alive || target.id === actorId) throw new Error('illegal check');
    return { targetId: target.id, thought: clip(obj.thought, 200) || null };
  } catch {
    return stubSeerCheck(state, actorId);
  }
}

export async function aiWitch(state, actorId, save) {
  const player = state.players[actorId];
  const victim = state.players[state.night.kill];
  const options = living(state);
  const actions = [];
  if (state.witch.save) actions.push(`"save" — use your one save potion to rescue ${victim.name}`);
  if (state.witch.poison) actions.push('"poison" — use your one poison potion to kill any living player (set "target")');
  actions.push('"none" — keep your potions and do nothing');
  const task = `It is night ${state.day}. The wolves' victim tonight is ${victim.name}${actorId === state.night.kill ? ' — that is YOU. You may save yourself.' : ''}. You may take AT MOST ONE action tonight: ${actions.join('; ')}. Each potion exists only once per game. Living players (poison targets): ${options.map((p) => p.name).join(', ')}.
Schema: {"action":"save"|"poison"|"none","target":"Name only if poisoning","thought":"your true hidden reasoning, max 20 words"}`;
  try {
    const raw = await callClaude(buildPrompt(state, player, save, task));
    const obj = parseJSON(raw);
    const action = String(obj.action || 'none').toLowerCase();
    if (action === 'save' && state.witch.save) {
      return { action: 'save', targetId: null, thought: clip(obj.thought, 200) || null };
    }
    if (action === 'poison' && state.witch.poison) {
      const target = byName(state, String(obj.target || '').trim());
      if (target && target.alive) {
        return { action: 'poison', targetId: target.id, thought: clip(obj.thought, 200) || null };
      }
    }
    return { action: 'none', targetId: null, thought: clip(obj.thought, 200) || null };
  } catch {
    return { action: 'none', targetId: null, thought: null };
  }
}

// ---------------------------------------------------------------- diaries

// One call per AI character after the game ends. Returns the entry text or
// null on failure (the character simply doesn't write that night).
export async function aiDiary(state, playerId, save, gameNumber) {
  const player = state.players[playerId];
  const won =
    (player.role === 'wolf' && state.winner === 'wolves') ||
    (player.role !== 'wolf' && state.winner === 'village');
  const ownActions = state.secret
    .filter((e) => e.actorId === playerId)
    .map((e) => `- ${e.text}${e.thought ? ` (thinking: ${e.thought})` : ''}`)
    .join('\n');
  const prompt = [
    `You are ${player.name}, ${PERSONALITIES[player.name]}. You just finished game ${gameNumber} of Werewolf with the same six players you always play with: You, Marta, Diego, Wen, Bo, Sofia ("You" is the human player's name).`,
    `YOUR SECRET ROLE was: ${ROLE_LABEL[player.role].toUpperCase()}. ${won ? 'Your side WON.' : 'Your side LOST.'} The ${state.winner === 'wolves' ? 'wolves' : 'village'} won. You ${player.alive ? 'survived' : 'did not survive'}.`,
    'YOUR OWN SECRET ACTIONS this game:\n' + (ownActions || '(none)'),
    chronicle(state),
    diarySection(save, player.name),
    `Write tonight's diary entry: max 2 sentences, first person, in your voice — what happened to you and whom you now DISTRUST, OWE, or want REVENGE on (choose among: You, Marta, Diego, Wen, Bo, Sofia). This entry will shape how you treat them next game.
Schema: {"entry":"your diary entry, max 2 sentences"}`,
    JSON_ONLY,
  ].join('\n\n');
  try {
    const raw = await callClaude(prompt);
    const obj = parseJSON(raw);
    const entry = clip(obj.entry, 400);
    if (!entry) throw new Error('empty entry');
    return entry;
  } catch {
    return null;
  }
}
