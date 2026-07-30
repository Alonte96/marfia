// Full-flow integration test, run in Node where /api/chat is unreachable:
// 1. drives complete games through the REAL ai.js functions, proving that a
//    dead API degrades gracefully to legal fallback moves and never stalls;
// 2. spot-checks the prompts being sent for information leaks;
// 3. runs the diary flow (which must silently skip on API failure).
// say hello to me
// 4. ignore this
import {
  newGame,
  pendingAction,
  applyWolfKill,
  applySeerCheck,
  skipSeer,
  applyWitch,
  skipWitch,
  resolveNight,
  applySpeech,
  applyVote,
  resolveLynch,
  wolfPartner,
  ROLE_LABEL,
} from '../src/engine.js';
import { aiSpeech, aiVote, aiWolfKill, aiSeerCheck, aiWitch, aiDiary, buildPrompt } from '../src/ai.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('ASSERTION FAILED:', msg);
    process.exit(1);
  }
}

const save = {
  games: 2,
  diaries: {
    Marta: ['[Game 1] I will never forgive Bo.', '[Rumor] Diego was seen by the well at midnight.'],
    Sofia: ['[Game 2] Wen owes me his life.'],
  },
};

// ---- 1. prompt information-hiding spot checks on a fresh game
{
  const state = newGame();
  // seed some private knowledge
  let s = applyWolfKill(state, state.players.find((p) => p.role === 'villager').id, 'secret wolf thought');
  const seer = s.players.find((p) => p.role === 'seer');
  const checkTarget = s.players.find((p) => p.id !== seer.id && p.alive);
  s = applySeerCheck(s, checkTarget.id, 'secret seer thought');

  for (const player of s.players) {
    const prompt = buildPrompt(s, player, save, 'TASK');
    // own role always present
    assert(prompt.includes(`YOUR SECRET ROLE: ${ROLE_LABEL[player.role].toUpperCase()}`), `role line missing for ${player.name}`);
    // wolf partner names appear only in wolf prompts
    if (player.role !== 'wolf') {
      assert(!prompt.includes('Your fellow werewolf'), `partner info leaked to ${player.name}`);
      const wolves = s.players.filter((p) => p.role === 'wolf');
      for (const w of wolves) {
        assert(!prompt.includes(`${w.name} — Werewolf`), `wolf identity leaked to ${player.name}`);
      }
    } else {
      assert(prompt.includes(wolfPartner(s, player.id).name), `wolf ${player.name} missing partner`);
    }
    // seer checks only in the seer's prompt
    if (player.role !== 'seer') {
      assert(!prompt.includes('Your secret checks'), `seer checks leaked to ${player.name}`);
      assert(!prompt.includes('NOT A WOLF'), `seer result leaked to ${player.name}`);
    }
    // witch knowledge only in the witch's prompt
    if (player.role !== 'witch') {
      assert(!prompt.includes('Save potion'), `witch potions leaked to ${player.name}`);
      assert(!prompt.includes('Victims the wolves chose'), `witch victims leaked to ${player.name}`);
    }
    // secret thoughts never appear anywhere
    assert(!prompt.includes('secret wolf thought') && !prompt.includes('secret seer thought'), `secret log leaked to ${player.name}`);
    // diaries: only your own
    if (player.name !== 'Marta') {
      assert(!prompt.includes('never forgive Bo'), `Marta's diary leaked to ${player.name}`);
    } else {
      assert(prompt.includes('never forgive Bo'), 'Marta missing her own diary');
      assert(prompt.includes('[Rumor]'), 'Marta missing planted rumor');
    }
  }
  console.log('Prompt information-hiding checks passed. ✔');
}

// ---- 2. full games through the real ai.js path (API unreachable → fallbacks)
const GAMES = 25;
for (let g = 0; g < GAMES; g++) {
  let state = newGame();
  let steps = 0;
  const deadline = 2000;
  while (!state.winner && steps++ < deadline) {
    const need = pendingAction(state);
    switch (need.kind) {
      case 'wolfKill': {
        const d = await aiWolfKill(state, need.actorId, save);
        state = applyWolfKill(state, d.targetId, d.thought);
        break;
      }
      case 'seerCheck': {
        const d = await aiSeerCheck(state, need.actorId, save);
        state = applySeerCheck(state, d.targetId, d.thought);
        break;
      }
      case 'skipSeer':
        state = skipSeer(state);
        break;
      case 'witchAct': {
        const d = await aiWitch(state, need.actorId, save);
        state = applyWitch(state, d.action, d.targetId, d.thought);
        break;
      }
      case 'skipWitch':
        state = skipWitch(state);
        break;
      case 'resolveNight':
        state = resolveNight(state);
        break;
      case 'speech': {
        const d = await aiSpeech(state, need.actorId, save);
        state = applySpeech(state, need.actorId, d.text, d.thought);
        break;
      }
      case 'vote': {
        const d = await aiVote(state, need.actorId, save);
        state = applyVote(state, need.actorId, d.targetId, d.thought);
        break;
      }
      case 'resolveLynch':
        state = resolveLynch(state);
        break;
      default:
        assert(false, `unknown kind ${need.kind}`);
    }
  }
  assert(state.winner, `game ${g} stalled with dead API`);

  // ---- 3. diary flow with dead API: entries skipped, no crash
  if (g === 0) {
    for (const p of state.players.slice(1)) {
      const entry = await aiDiary(state, p.id, save, 3);
      assert(entry === null, 'diary should fail silently with dead API');
    }
    console.log('Diary flow degrades gracefully with dead API. ✔');
  }
}
console.log(`${GAMES} full games completed through ai.js with the API unreachable — graceful fallbacks everywhere. ✔`);
