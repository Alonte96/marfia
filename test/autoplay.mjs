// Headless engine verification: auto-plays many games with random-legal (stub)
// decisions and asserts the rules invariants hold. Run with `npm test`.
// nothing, just testing
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
  living,
  votePool,
  stubWolfKill,
  stubSeerCheck,
  stubVote,
  stubSpeech,
  roleHolder,
} from '../src/engine.js';

const GAMES = 500;
const MAX_STEPS = 2000;

function assert(cond, msg, state) {
  if (!cond) {
    console.error('ASSERTION FAILED:', msg);
    if (state) console.error(JSON.stringify(state, null, 2).slice(0, 4000));
    process.exit(1);
  }
}

// Random witch that exercises save/poison branches too.
function randomWitch(state) {
  const witch = roleHolder(state, 'witch');
  const r = Math.random();
  if (r < 0.35 && state.witch.save && state.night.kill != null) {
    return { action: 'save', targetId: null };
  }
  if (r < 0.55 && state.witch.poison) {
    const targets = living(state).filter((p) => p.id !== witch.id);
    return { action: 'poison', targetId: targets[Math.floor(Math.random() * targets.length)].id };
  }
  return { action: 'none', targetId: null };
}

const winners = { wolves: 0, village: 0 };
let totalDays = 0;
let revotes = 0;
let noLynch = 0;
let saves = 0;
let poisons = 0;

for (let g = 0; g < GAMES; g++) {
  let state = newGame();
  let steps = 0;
  let humanRole = state.players[0].role;

  while (!state.winner && steps++ < MAX_STEPS) {
    const need = pendingAction(state);
    assert(need, `no pending action in step ${state.step}`, state);

    // actors must be alive
    if (need.actorId != null) {
      assert(state.players[need.actorId].alive, `dead actor ${need.actorId} asked to act (${need.kind})`, state);
    }

    switch (need.kind) {
      case 'wolfKill': {
        assert(state.players[need.actorId].role === 'wolf', 'non-wolf choosing kill', state);
        const { targetId } = stubWolfKill(state, need.actorId);
        assert(state.players[targetId].alive, 'wolf kill target dead', state);
        state = applyWolfKill(state, targetId, 'stub');
        break;
      }
      case 'seerCheck': {
        assert(state.players[need.actorId].role === 'seer', 'non-seer checking', state);
        const { targetId } = stubSeerCheck(state, need.actorId);
        assert(targetId !== need.actorId, 'seer checked self', state);
        assert(state.players[targetId].alive, 'seer checked dead player', state);
        state = applySeerCheck(state, targetId, 'stub');
        break;
      }
      case 'skipSeer':
        assert(!roleHolder(state, 'seer').alive, 'seer skipped while alive', state);
        state = skipSeer(state);
        break;
      case 'witchAct': {
        const { action, targetId } = randomWitch(state);
        const hadSave = state.witch.save;
        const hadPoison = state.witch.poison;
        state = applyWitch(state, action, targetId, 'stub');
        if (action === 'save' && hadSave) saves++;
        if (action === 'poison' && hadPoison) poisons++;
        break;
      }
      case 'skipWitch':
        assert(!roleHolder(state, 'witch').alive, 'witch skipped while alive', state);
        state = skipWitch(state);
        break;
      case 'resolveNight':
        state = resolveNight(state);
        break;
      case 'speech': {
        const { text } = stubSpeech();
        state = applySpeech(state, need.actorId, text, 'stub');
        break;
      }
      case 'vote': {
        if (state.isRevote) revotes++;
        const pool = votePool(state, need.actorId);
        assert(pool.length > 0, 'empty vote pool', state);
        assert(!pool.includes(need.actorId), 'self in vote pool', state);
        for (const id of pool) assert(state.players[id].alive, 'dead player in vote pool', state);
        const { targetId } = stubVote(state, need.actorId);
        state = applyVote(state, need.actorId, targetId, 'stub');
        break;
      }
      case 'resolveLynch': {
        const before = living(state).length;
        state = resolveLynch(state);
        const after = living(state).length;
        if (state.step === 'n_wolf' && after === before) noLynch++;
        break;
      }
      default:
        assert(false, `unknown action kind ${need.kind}`, state);
    }
  }

  assert(state.winner === 'wolves' || state.winner === 'village', `game ${g} did not terminate`, state);

  // win-condition sanity
  const aliveWolves = state.players.filter((p) => p.alive && p.role === 'wolf').length;
  const aliveVill = state.players.filter((p) => p.alive && p.role === 'villager').length;
  const aliveGods = state.players.filter((p) => p.alive && (p.role === 'seer' || p.role === 'witch')).length;
  if (state.winner === 'village') assert(aliveWolves === 0, 'village won with wolves alive', state);
  if (state.winner === 'wolves') assert(aliveWolves > 0 && (aliveVill === 0 || aliveGods === 0), 'wolves won incorrectly', state);

  // secret log always includes the deal
  assert(state.secret[0].kind === 'deal', 'secret log missing role deal', state);
  // public log never contains a role word outside the game-over line
  const roleWords = ['Werewolf', 'Seer', 'Witch', 'Villager'];
  for (const entry of state.log) {
    if (entry.type === 'speech') continue; // stub speeches are '…'
    for (const w of roleWords) {
      assert(!entry.text.includes(w), `public log leaked a role: "${entry.text}"`, state);
    }
  }

  winners[state.winner]++;
  totalDays += state.day;
  void humanRole;
}

console.log(`Played ${GAMES} games with stub AI.`);
console.log(`  wolves won:  ${winners.wolves}`);
console.log(`  village won: ${winners.village}`);
console.log(`  avg length:  ${(totalDays / GAMES).toFixed(2)} days`);
console.log(`  revote votes cast: ${revotes}, deadlocked (no banish): ${noLynch}`);
console.log(`  witch saves: ${saves}, poisons: ${poisons}`);
console.log('All invariants held. ✔');
