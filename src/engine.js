// Werewolf Night — pure game engine.
// No React, no timers, no network. Every apply* function clones the incoming
// state and returns a new one, so the UI can use them directly in setState.

export const NAMES = ['You', 'Marta', 'Diego', 'Wen', 'Bo', 'Sofia'];
export const HUES = ['#7A5C3E', '#3E5C7A', '#5C7A3E', '#7A3E5C', '#8A6A2B', '#4A6A6A'];
export const HUMAN = 0;

export const PERSONALITIES = {
  Marta: 'a paranoid retired schoolteacher; sharp, accusatory, keeps receipts on everyone',
  Diego: 'a smooth charmer; deflects with jokes, flatters, never sounds worried',
  Wen: 'a quiet analyst; speaks little, pure logic, counts votes out loud',
  Bo: 'hot-headed and loud; accuses first, thinks later, hates silence',
  Sofia: 'a sweet-seeming grandmother; gentle words hiding real cunning',
};

export const ROLE_LABEL = { wolf: 'Werewolf', seer: 'Seer', witch: 'Witch', villager: 'Villager' };
export const ROLE_COLOR = { wolf: '#A32638', seer: '#3E5C7A', witch: '#5C3E7A', villager: '#5C7A3E' };
export const BLOOD = '#A32638';

// ---------------------------------------------------------------- helpers

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clone(state) {
  return structuredClone(state);
}

export function living(state) {
  return state.players.filter((p) => p.alive);
}

export function byName(state, name) {
  return state.players.find((p) => p.name === name);
}

// Speaking/voting order: seat order rotated by (day - 1), living only.
export function rotatedLiving(state) {
  const start = (state.day - 1) % 6;
  const ids = [];
  for (let i = 0; i < 6; i++) ids.push((start + i) % 6);
  return ids.filter((id) => state.players[id].alive);
}

// Legal banishment targets for a voter right now.
export function votePool(state, voterId) {
  const base =
    state.isRevote && state.tiePool
      ? state.tiePool.filter((id) => state.players[id].alive)
      : living(state).map((p) => p.id);
  return base.filter((id) => id !== voterId);
}

export function livingWolves(state) {
  return living(state).filter((p) => p.role === 'wolf');
}

export function wolfPartner(state, wolfId) {
  return state.players.find((p) => p.role === 'wolf' && p.id !== wolfId) || null;
}

// Which wolf picks tonight's kill: the human if they are a living wolf,
// otherwise the first living AI wolf.
export function wolfDecider(state) {
  const wolves = livingWolves(state);
  const humanWolf = wolves.find((p) => p.id === HUMAN);
  return humanWolf || wolves[0] || null;
}

export function roleHolder(state, role) {
  return state.players.find((p) => p.role === role) || null;
}

function pushLog(state, entry) {
  state.log.push(entry);
}

function pushSecret(state, entry) {
  state.secret.push(entry);
}

function phaseMarker(state, text) {
  pushLog(state, { type: 'phase', text });
  pushSecret(state, { kind: 'phase', actorId: null, text });
}

// ---------------------------------------------------------------- new game

export function newGame() {
  const roles = shuffle(['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager']);
  const players = NAMES.map((name, i) => ({ id: i, name, role: roles[i], alive: true }));
  const state = {
    players,
    day: 1,
    step: 'n_wolf', // n_wolf → n_seer → n_witch → n_resolve → d_speech → d_vote → d_lynch → [d_revote → d_lynch] → …
    log: [],
    secret: [],
    seerChecks: [], // { day, targetId, isWolf }
    witch: { save: true, poison: true, shown: [] }, // shown: { day, victimId }
    night: { kill: null, saved: false, poison: null },
    speechQueue: [],
    voteQueue: [],
    votes: [], // { voterId, targetId }
    tiePool: null,
    isRevote: false,
    winner: null, // 'wolves' | 'village'
    banner: 'Night falls on the village.',
  };
  pushSecret(state, {
    kind: 'deal',
    actorId: null,
    text: 'The roles are dealt: ' + players.map((p) => `${p.name} — ${ROLE_LABEL[p.role]}`).join(' · '),
  });
  phaseMarker(state, 'NIGHT 1 FALLS ON THE VILLAGE');
  return state;
}

// ---------------------------------------------------------------- win check

function checkWin(state) {
  const alive = living(state);
  const wolves = alive.filter((p) => p.role === 'wolf').length;
  const villagers = alive.filter((p) => p.role === 'villager').length;
  const gods = alive.filter((p) => p.role === 'seer' || p.role === 'witch').length;
  if (wolves === 0) return 'village';
  if (villagers === 0 || gods === 0) return 'wolves';
  return null;
}

function maybeEnd(state) {
  const winner = checkWin(state);
  if (!winner) return false;
  state.winner = winner;
  state.step = 'over';
  const line =
    winner === 'wolves'
      ? 'The wolves have taken the village.'
      : 'The village stands — both wolves are gone.';
  pushLog(state, { type: 'system', text: line });
  pushSecret(state, { kind: 'result', actorId: null, text: `GAME OVER — ${line}` });
  state.banner = line;
  return true;
}

// ---------------------------------------------------------------- pending action

// Describes what must happen next. `actorId` is set for player decisions.
export function pendingAction(state) {
  switch (state.step) {
    case 'n_wolf': {
      const decider = wolfDecider(state);
      return { kind: 'wolfKill', actorId: decider.id };
    }
    case 'n_seer': {
      const seer = roleHolder(state, 'seer');
      if (seer && seer.alive) return { kind: 'seerCheck', actorId: seer.id };
      return { kind: 'skipSeer', actorId: null };
    }
    case 'n_witch': {
      const witch = roleHolder(state, 'witch');
      if (witch && witch.alive) return { kind: 'witchAct', actorId: witch.id };
      return { kind: 'skipWitch', actorId: null };
    }
    case 'n_resolve':
      return { kind: 'resolveNight', actorId: null };
    case 'd_speech':
      return { kind: 'speech', actorId: state.speechQueue[0] };
    case 'd_vote':
    case 'd_revote':
      return { kind: 'vote', actorId: state.voteQueue[0] };
    case 'd_lynch':
      return { kind: 'resolveLynch', actorId: null };
    default:
      return null;
  }
}

// ---------------------------------------------------------------- night steps

export function applyWolfKill(prev, targetId, thought) {
  if (prev.step !== 'n_wolf') return prev; // idempotency guard (double-click / double-fire)
  const state = clone(prev);
  const decider = wolfDecider(state);
  state.night.kill = targetId;
  pushSecret(state, {
    kind: 'night',
    actorId: decider ? decider.id : null,
    text: `chose the wolves' kill: ${state.players[targetId].name}`,
    thought: thought || null,
  });
  state.step = 'n_seer';
  return state;
}

export function applySeerCheck(prev, targetId, thought) {
  if (prev.step !== 'n_seer') return prev;
  const state = clone(prev);
  const seer = roleHolder(state, 'seer');
  const target = state.players[targetId];
  const isWolf = target.role === 'wolf';
  state.seerChecks.push({ day: state.day, targetId, isWolf });
  pushSecret(state, {
    kind: 'night',
    actorId: seer.id,
    text: `checked ${target.name} → ${isWolf ? 'WOLF' : 'NOT A WOLF'}`,
    thought: thought || null,
  });
  if (seer.id === HUMAN) {
    state.banner = `Your sight opens: ${target.name} is ${isWolf ? 'A WOLF' : 'not a wolf'}.`;
  }
  state.step = 'n_witch';
  return state;
}

export function skipSeer(prev) {
  if (prev.step !== 'n_seer') return prev;
  const state = clone(prev);
  state.step = 'n_witch';
  return state;
}

// action: 'save' | 'poison' | 'none'; targetId only for poison.
export function applyWitch(prev, action, targetId, thought) {
  if (prev.step !== 'n_witch') return prev;
  const state = clone(prev);
  const witch = roleHolder(state, 'witch');
  const victimId = state.night.kill;
  state.witch.shown.push({ day: state.day, victimId });

  let act = action;
  if (act === 'save' && (!state.witch.save || victimId == null)) act = 'none';
  if (act === 'poison' && (!state.witch.poison || targetId == null || !state.players[targetId]?.alive)) act = 'none';

  if (act === 'save') {
    state.night.saved = true;
    state.witch.save = false;
    pushSecret(state, {
      kind: 'night',
      actorId: witch.id,
      text: `was shown the victim (${state.players[victimId].name}) and used the SAVE potion on ${state.players[victimId].name}`,
      thought: thought || null,
    });
    if (witch.id === HUMAN) state.banner = `You pour the save potion. ${state.players[victimId].name} will wake.`;
  } else if (act === 'poison') {
    state.night.poison = targetId;
    state.witch.poison = false;
    pushSecret(state, {
      kind: 'night',
      actorId: witch.id,
      text: `was shown the victim (${state.players[victimId].name}) and used the POISON potion on ${state.players[targetId].name}`,
      thought: thought || null,
    });
    if (witch.id === HUMAN) state.banner = `You uncork the poison. ${state.players[targetId].name} will not wake.`;
  } else {
    pushSecret(state, {
      kind: 'night',
      actorId: witch.id,
      text: `was shown the victim (${state.players[victimId].name}) and did nothing`,
      thought: thought || null,
    });
    if (witch.id === HUMAN) state.banner = 'You keep your potions corked.';
  }
  state.step = 'n_resolve';
  return state;
}

export function skipWitch(prev) {
  if (prev.step !== 'n_witch') return prev;
  const state = clone(prev);
  state.step = 'n_resolve';
  return state;
}

export function resolveNight(prev) {
  if (prev.step !== 'n_resolve') return prev;
  const state = clone(prev);
  const deaths = [];
  if (state.night.kill != null && !state.night.saved) {
    const victim = state.players[state.night.kill];
    if (victim.alive) {
      victim.alive = false;
      deaths.push(victim);
    }
  }
  if (state.night.poison != null) {
    const victim = state.players[state.night.poison];
    if (victim.alive) {
      victim.alive = false;
      deaths.push(victim);
    }
  }
  deaths.sort((a, b) => a.id - b.id);

  phaseMarker(state, `DAY ${state.day} — THE VILLAGE WAKES`);
  if (deaths.length === 0) {
    pushLog(state, { type: 'system', text: 'A peaceful night. Nobody died.' });
    pushSecret(state, { kind: 'death', actorId: null, text: 'Morning: nobody died.' });
  } else {
    for (const d of deaths) {
      pushLog(state, { type: 'death', text: `${d.name} was found dead.` });
      pushSecret(state, {
        kind: 'death',
        actorId: null,
        text: `Morning: ${d.name} (${ROLE_LABEL[d.role]}) was found dead.`,
      });
    }
  }

  if (maybeEnd(state)) return state;

  state.speechQueue = rotatedLiving(state);
  state.step = 'd_speech';
  state.banner =
    deaths.length === 0
      ? `Day ${state.day} — the village wakes. A peaceful night.`
      : `Day ${state.day} — the village wakes. ${deaths.map((d) => d.name).join(' and ')} ${deaths.length > 1 ? 'were' : 'was'} found dead.`;
  return state;
}

// ---------------------------------------------------------------- day steps

export function applySpeech(prev, playerId, text, thought) {
  if (prev.step !== 'd_speech' || !prev.speechQueue.includes(playerId)) return prev;
  const state = clone(prev);
  state.speechQueue = state.speechQueue.filter((id) => id !== playerId);
  const speaker = state.players[playerId];
  const trimmed = (text || '').trim();
  if (trimmed) {
    pushLog(state, { type: 'speech', playerId, text: trimmed });
    pushSecret(state, {
      kind: 'speech',
      actorId: playerId,
      text: `said: "${trimmed}"`,
      thought: thought || null,
    });
  } else {
    const line = playerId === HUMAN ? 'You say nothing.' : `${speaker.name} says nothing.`;
    pushLog(state, { type: 'system', text: line });
    pushSecret(state, { kind: 'speech', actorId: playerId, text: 'said nothing', thought: thought || null });
  }
  if (state.speechQueue.length === 0) startVote(state, false);
  return state;
}

function startVote(state, revote) {
  state.voteQueue = rotatedLiving(state);
  state.votes = [];
  state.isRevote = revote;
  if (!revote) state.tiePool = null;
  state.step = revote ? 'd_revote' : 'd_vote';
  state.banner = revote ? 'REVOTE — the tie must break.' : 'The vote begins. Open ballots.';
  pushLog(state, {
    type: 'system',
    text: revote ? 'The village votes again to break the tie.' : 'The village votes. Open ballots.',
  });
}

export function applyVote(prev, voterId, targetId, thought) {
  if ((prev.step !== 'd_vote' && prev.step !== 'd_revote') || !prev.voteQueue.includes(voterId)) return prev;
  const state = clone(prev);
  state.voteQueue = state.voteQueue.filter((id) => id !== voterId);
  state.votes.push({ voterId, targetId });
  pushLog(state, { type: 'vote', text: `${state.players[voterId].name} → ${state.players[targetId].name}` });
  pushSecret(state, {
    kind: 'vote',
    actorId: voterId,
    text: `voted to banish ${state.players[targetId].name}${state.isRevote ? ' (revote)' : ''}`,
    thought: thought || null,
  });
  if (state.voteQueue.length === 0) state.step = 'd_lynch';
  return state;
}

export function resolveLynch(prev) {
  if (prev.step !== 'd_lynch') return prev;
  const state = clone(prev);
  const tally = new Map();
  for (const v of state.votes) tally.set(v.targetId, (tally.get(v.targetId) || 0) + 1);
  let max = 0;
  for (const count of tally.values()) if (count > max) max = count;
  const top = [...tally.entries()].filter(([, c]) => c === max).map(([id]) => id);

  if (top.length === 1) {
    const banished = state.players[top[0]];
    banished.alive = false;
    pushLog(state, { type: 'death', text: `The village has banished ${banished.name}. Their role stays hidden.` });
    pushSecret(state, {
      kind: 'banish',
      actorId: null,
      text: `${banished.name} (${ROLE_LABEL[banished.role]}) was banished by vote.`,
    });
    if (maybeEnd(state)) return state;
    return fallToNight(state);
  }

  if (!state.isRevote) {
    const names = top.map((id) => state.players[id].name).join(' and ');
    pushLog(state, { type: 'system', text: `The vote is tied between ${names}.` });
    state.tiePool = top;
    startVote(state, true);
    return state;
  }

  pushLog(state, { type: 'system', text: 'Still tied. The village cannot decide — no one is banished.' });
  pushSecret(state, { kind: 'banish', actorId: null, text: 'The revote tied again; no one was banished.' });
  return fallToNight(state);
}

function fallToNight(state) {
  state.day += 1;
  state.night = { kill: null, saved: false, poison: null };
  state.tiePool = null;
  state.isRevote = false;
  state.step = 'n_wolf';
  state.banner = 'Night falls on the village.';
  phaseMarker(state, `NIGHT ${state.day} FALLS ON THE VILLAGE`);
  return state;
}

// ---------------------------------------------------------------- stub decisions
// Random but legal choices. Used by the autoplay test and as fallbacks when
// an API call fails, so a dead network can never crash or stall the game.

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function stubWolfKill(state, actorId) {
  const targets = living(state).filter((p) => p.id !== actorId);
  return { targetId: pick(targets).id, thought: null };
}

export function stubSeerCheck(state, actorId) {
  const checked = new Set(state.seerChecks.map((c) => c.targetId));
  const alive = living(state).filter((p) => p.id !== actorId);
  const fresh = alive.filter((p) => !checked.has(p.id));
  const targets = fresh.length ? fresh : alive;
  return { targetId: pick(targets).id, thought: null };
}

export function stubWitch() {
  return { action: 'none', targetId: null, thought: null };
}

export function stubVote(state, voterId) {
  return { targetId: pick(votePool(state, voterId)), thought: null };
}

export function stubSpeech() {
  return { text: '…', thought: null };
}
