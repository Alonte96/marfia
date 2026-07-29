import React, { useEffect, useRef, useState } from 'react';
import {
  HUMAN,
  HUES,
  ROLE_LABEL,
  ROLE_COLOR,
  BLOOD,
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
  wolfPartner,
} from '../engine.js';
import { aiSpeech, aiVote, aiWolfKill, aiSeerCheck, aiWitch, apiDown } from '../ai.js';
import { NIGHT, DAY, SERIF, FADE, caps, panel } from '../theme.js';
import { Sky, Stars, Disc, Avatar, Btn, MuteButton } from './bits.jsx';
import { ensureAudio, setScene, deathKnell } from '../audio.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// How long the table should linger on what was just said or done, so speeches
// can actually be read before the next character talks. Public-log-based only,
// so it can never leak hidden information through timing.
function readPause(s) {
  const last = s.log[s.log.length - 1];
  if (!last) return 600;
  switch (last.type) {
    case 'speech':
      return Math.min(1400 + last.text.length * 32, 4200);
    case 'death':
      return 2200;
    case 'vote':
      return 800;
    case 'phase':
      return 1000;
    default:
      return 1200;
  }
}

// Fixed, role-blind atmosphere lines for night steps the human doesn't act in.
const NIGHT_LINES = {
  n_wolf: 'The wolves are choosing…',
  n_seer: 'An eye opens somewhere in the dark…',
  n_witch: 'A kettle hisses somewhere…',
};

export default function Table({ initial, save, onOver }) {
  const [state, setState] = useState(initial);
  const [thinking, setThinking] = useState(null);
  const [speechDraft, setSpeechDraft] = useState('');
  const busyRef = useRef(false);
  const overRef = useRef(false);
  const bottomRef = useRef(null);

  const night = state.step.startsWith('n');
  const T = night ? NIGHT : DAY;
  const me = state.players[HUMAN];
  const need = state.winner ? null : pendingAction(state);
  const humanTurn = need && need.actorId === HUMAN;

  // ------------------------------------------------------------ auto loop
  useEffect(() => {
    if (state.winner) {
      if (!overRef.current) {
        overRef.current = true;
        setTimeout(() => onOver(state), 2200);
      }
      return;
    }
    const act = pendingAction(state);
    if (!act || act.actorId === HUMAN) return; // human steps pause the loop
    if (busyRef.current) return;
    busyRef.current = true;
    runAuto(state, act).finally(() => {
      busyRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function runAuto(s, act) {
    // Night steps get uniform pacing regardless of which roles are alive, so
    // timing never leaks who holds which role. readPause is public-log-based,
    // so folding it in stays role-blind.
    const nightBudget = Math.max(1500 + Math.random() * 900, readPause(s));
    const started = Date.now();
    const finishNight = async () => {
      const left = nightBudget - (Date.now() - started);
      if (left > 0) await sleep(left);
    };

    switch (act.kind) {
      case 'wolfKill': {
        setThinking(NIGHT_LINES.n_wolf);
        const d = await aiWolfKill(s, act.actorId, save);
        await finishNight();
        setThinking(null);
        setState(applyWolfKill(s, d.targetId, d.thought));
        break;
      }
      case 'seerCheck': {
        setThinking(NIGHT_LINES.n_seer);
        const d = await aiSeerCheck(s, act.actorId, save);
        await finishNight();
        setThinking(null);
        setState(applySeerCheck(s, d.targetId, d.thought));
        break;
      }
      case 'skipSeer': {
        setThinking(NIGHT_LINES.n_seer);
        await finishNight();
        setThinking(null);
        setState(skipSeer(s));
        break;
      }
      case 'witchAct': {
        setThinking(NIGHT_LINES.n_witch);
        const d = await aiWitch(s, act.actorId, save);
        await finishNight();
        setThinking(null);
        setState(applyWitch(s, d.action, d.targetId, d.thought));
        break;
      }
      case 'skipWitch': {
        setThinking(NIGHT_LINES.n_witch);
        await finishNight();
        setThinking(null);
        setState(skipWitch(s));
        break;
      }
      case 'resolveNight': {
        setThinking('Dawn creeps over the rooftops…');
        await sleep(1400);
        setThinking(null);
        setState(resolveNight(s));
        break;
      }
      case 'speech': {
        const name = s.players[act.actorId].name;
        setThinking(`${name} is choosing words…`);
        // Let the previous speech be read while this character's words are
        // fetched — total wait is whichever takes longer.
        const [d] = await Promise.all([aiSpeech(s, act.actorId, save), sleep(readPause(s))]);
        setThinking(null);
        setState(applySpeech(s, act.actorId, d.text, d.thought));
        break;
      }
      case 'vote': {
        const name = s.players[act.actorId].name;
        setThinking(`${name} weighs the vote…`);
        const [d] = await Promise.all([aiVote(s, act.actorId, save), sleep(readPause(s))]);
        setThinking(null);
        setState(applyVote(s, act.actorId, d.targetId, d.thought));
        break;
      }
      case 'resolveLynch': {
        setThinking('The votes are counted…');
        await sleep(1200);
        setThinking(null);
        setState(resolveLynch(s));
        break;
      }
      default:
        break;
    }
  }

  // Auto-scroll the chronicle.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'end' });
  }, [state.log.length, thinking, humanTurn]);

  // Ambient soundtrack follows the world.
  useEffect(() => {
    setScene(night);
  }, [night]);

  // A knell for every new death in the chronicle.
  const deathCountRef = useRef(0);
  useEffect(() => {
    const deaths = state.log.filter((e) => e.type === 'death').length;
    if (deaths > deathCountRef.current) deathKnell();
    deathCountRef.current = deaths;
  }, [state.log.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------ human actions
  // Each click is also a user gesture — the moment audio is allowed to start.
  const doWolfKill = (id) => {
    ensureAudio();
    setState(applyWolfKill(state, id, null));
  };
  const doSeerCheck = (id) => {
    ensureAudio();
    setState(applySeerCheck(state, id, null));
  };
  const doWitch = (action, id) => {
    ensureAudio();
    setState(applyWitch(state, action, id, null));
  };
  const doVote = (id) => {
    ensureAudio();
    setState(applyVote(state, HUMAN, id, null));
  };
  const doSpeak = (text) => {
    ensureAudio();
    setSpeechDraft('');
    setState(applySpeech(state, HUMAN, text, null));
  };

  // ------------------------------------------------------------ render
  return (
    <div style={{ minHeight: '100vh', fontFamily: SERIF, color: T.ink, position: 'relative', transition: FADE }}>
      <Sky night={night} />
      <Stars visible={night} />
      <MuteButton T={T} />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 620, margin: '0 auto', padding: '40px 16px 250px' }}>
        <SkyBand T={T} night={night} state={state} me={me} />
        <TokenRow T={T} night={night} state={state} />
        <Banner T={T} text={state.banner} />
        {apiDown() && (
          <div style={{ textAlign: 'center', fontSize: 12.5, color: T.accent, fontStyle: 'italic', marginTop: 8 }}>
            ⚠ The characters have no voice — every AI call is being refused. Add API credits (or start the
            server) and they will speak, argue, and remember.
          </div>
        )}
        <Feed T={T} state={state} thinking={thinking} />
        <div ref={bottomRef} />
      </div>

      <Dock
        T={T}
        night={night}
        state={state}
        need={need}
        humanTurn={humanTurn}
        me={me}
        speechDraft={speechDraft}
        setSpeechDraft={setSpeechDraft}
        actions={{ doWolfKill, doSeerCheck, doWitch, doVote, doSpeak }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- sky band

function SkyBand({ T, night, state, me }) {
  const label = night ? `Night ${state.day}` : `Day ${state.day}`;
  const sub = night ? 'THE VILLAGE SLEEPS' : 'THE VILLAGE DEBATES';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <Disc night={night} size={62} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 26, transition: FADE }}>{label}</div>
        <div style={{ ...caps(T), marginTop: 3 }}>{sub}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={caps(T)}>YOU ARE</div>
        <div
          style={{
            fontSize: 17,
            marginTop: 3,
            color: me.alive ? ROLE_COLOR[me.role] : T.soft,
            transition: FADE,
          }}
        >
          {me.alive ? ROLE_LABEL[me.role] : 'A GHOST'}
        </div>
        {me.alive && me.role === 'wolf' && (
          <div style={{ fontSize: 11, color: T.soft, marginTop: 2, transition: FADE }}>
            your pack: {wolfPartner(state, HUMAN).name}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tokens

function TokenRow({ T, night, state }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22, gap: 4 }}>
      {state.players.map((p) => (
        <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Avatar player={p} night={night} size={42} />
          <div
            style={{
              fontSize: 12,
              color: p.alive ? T.ink : T.soft,
              textDecoration: p.alive ? 'none' : 'line-through',
              opacity: p.alive ? 1 : 0.6,
              transition: FADE,
            }}
          >
            {p.name}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- banner

function Banner({ T, text }) {
  return (
    <div
      key={text}
      className="ww-enter"
      style={{
        ...panel(T),
        marginTop: 18,
        padding: '10px 16px',
        textAlign: 'center',
        fontSize: 14,
        color: T.soft,
        fontStyle: 'italic',
      }}
    >
      {text}
    </div>
  );
}

// ---------------------------------------------------------------- feed

function Feed({ T, state, thinking }) {
  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {state.log.map((e, i) => (
        <div key={i} className="ww-enter">
          <FeedEntry T={T} state={state} entry={e} />
        </div>
      ))}
      {thinking && (
        <div
          className="ww-breathe"
          style={{ textAlign: 'center', fontStyle: 'italic', fontSize: 13, color: T.soft, transition: FADE }}
        >
          {thinking}
        </div>
      )}
    </div>
  );
}

function FeedEntry({ T, state, entry }) {
  switch (entry.type) {
    case 'phase':
      return (
        <div style={{ ...caps(T), textAlign: 'center', margin: '14px 0 4px' }}>— {entry.text} —</div>
      );
    case 'speech': {
      const p = state.players[entry.playerId];
      return (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Avatar player={{ ...p, alive: true }} night={false} size={30} />
          <div
            style={{
              background: T.bubble,
              border: `1px solid ${T.edge}`,
              borderRadius: '2px 10px 10px 10px',
              padding: '8px 12px',
              transition: FADE,
              flex: 1,
            }}
          >
            <div style={{ fontSize: 12, color: HUES[p.id], marginBottom: 3 }}>{p.name}</div>
            <div style={{ fontSize: 15, lineHeight: 1.5, transition: FADE }}>{entry.text}</div>
          </div>
        </div>
      );
    }
    case 'death':
      return (
        <div
          style={{
            border: `1px solid ${BLOOD}`,
            borderRadius: 8,
            padding: '10px 16px',
            textAlign: 'center',
            fontSize: 15,
            color: BLOOD,
            background: 'rgba(163,38,56,0.07)',
          }}
        >
          {entry.text}
        </div>
      );
    case 'vote':
      return (
        <div style={{ textAlign: 'center', fontSize: 13, color: T.soft, transition: FADE }}>{entry.text}</div>
      );
    default:
      return (
        <div style={{ textAlign: 'center', fontSize: 13, color: T.soft, fontStyle: 'italic', transition: FADE }}>
          {entry.text}
        </div>
      );
  }
}

// ---------------------------------------------------------------- action dock

function Dock({ T, night, state, need, humanTurn, me, speechDraft, setSpeechDraft, actions }) {
  const skyBase = night ? '#0C1418' : '#E4D6B8';
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 5 }}>
      {/* gradient fade into the sky */}
      <div
        style={{
          height: 34,
          background: `linear-gradient(to bottom, transparent, ${skyBase})`,
          opacity: 0.9,
          transition: FADE,
        }}
      />
      <div style={{ background: skyBase, transition: FADE }}>
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '0 16px 18px' }}>
          <div key={`${state.step}:${need ? need.kind : 'none'}`} className="ww-enter" style={{ ...panel(T), padding: '14px 16px' }}>
            <DockBody
              T={T}
              state={state}
              need={need}
              humanTurn={humanTurn}
              me={me}
              speechDraft={speechDraft}
              setSpeechDraft={setSpeechDraft}
              actions={actions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function NameButtons({ T, state, ids, onPick, color }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
      {ids.map((id) => (
        <Btn key={id} T={T} color={color} onClick={() => onPick(id)}>
          {state.players[id].name}
        </Btn>
      ))}
    </div>
  );
}

function DockBody({ T, state, need, humanTurn, me, speechDraft, setSpeechDraft, actions }) {
  if (state.winner) {
    return <div style={{ ...caps(T), textAlign: 'center' }}>THE CHRONICLE CLOSES…</div>;
  }

  if (!me.alive) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={caps(T)}>YOU ARE DEAD — WATCHING FROM THE TREELINE</div>
        <div style={{ fontSize: 13, color: T.soft, marginTop: 8, fontStyle: 'italic' }}>
          The living go on without you. Watch how they lie.
        </div>
      </div>
    );
  }

  if (!humanTurn) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={caps(T)}>{state.step.startsWith('n') ? 'THE NIGHT MOVES AROUND YOU' : 'LISTEN'}</div>
        <div style={{ fontSize: 13, color: T.soft, marginTop: 8, fontStyle: 'italic' }}>
          {state.step.startsWith('n') ? 'Keep still. Wait for morning.' : 'Your moment will come.'}
        </div>
      </div>
    );
  }

  switch (need.kind) {
    case 'wolfKill': {
      const targets = living(state).map((p) => p.id);
      return (
        <div>
          <div style={caps(T)}>🐺 YOUR PACK HUNTS — CHOOSE THE KILL</div>
          <NameButtons T={T} state={state} ids={targets} onPick={actions.doWolfKill} color={BLOOD} />
          <div style={{ fontSize: 12, color: T.soft, marginTop: 10, fontStyle: 'italic' }}>
            You may knife a wolf — even yourself. A self-knife can bait the witch's save and buy days of
            innocence.
          </div>
        </div>
      );
    }
    case 'seerCheck': {
      const targets = living(state)
        .filter((p) => p.id !== HUMAN)
        .map((p) => p.id);
      const known = state.seerChecks
        .map((c) => `${state.players[c.targetId].name}: ${c.isWolf ? 'wolf' : 'not wolf'}`)
        .join(' · ');
      return (
        <div>
          <div style={caps(T)}>◈ YOUR SIGHT OPENS — CHECK ONE SOUL</div>
          <NameButtons T={T} state={state} ids={targets} onPick={actions.doSeerCheck} />
          <div style={{ fontSize: 12, color: T.soft, marginTop: 10 }}>
            Known: {known || 'nothing yet.'}
          </div>
        </div>
      );
    }
    case 'witchAct': {
      const victim = state.players[state.night.kill];
      const poisonTargets = living(state).map((p) => p.id);
      return (
        <div>
          <div style={caps(T)}>
            ⚗ THE WOLVES TOOK {victim.name.toUpperCase()} — YOUR MOVE
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {state.witch.save && (
              <Btn T={T} color={T.accent} onClick={() => actions.doWitch('save', null)}>
                Use the save potion on {victim.name}
              </Btn>
            )}
            <Btn T={T} onClick={() => actions.doWitch('none', null)}>
              Do nothing
            </Btn>
          </div>
          {state.witch.poison && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: T.soft }}>Or spend the poison on:</div>
              <NameButtons T={T} state={state} ids={poisonTargets} onPick={(id) => actions.doWitch('poison', id)} color={BLOOD} />
            </div>
          )}
          {!state.witch.save && !state.witch.poison && (
            <div style={{ fontSize: 12, color: T.soft, marginTop: 10, fontStyle: 'italic' }}>
              Both potions are spent. The night is out of your hands.
            </div>
          )}
        </div>
      );
    }
    case 'speech':
      return (
        <div>
          <div style={caps(T)}>THE VILLAGE WAITS — SPEAK</div>
          <textarea
            value={speechDraft}
            onChange={(e) => setSpeechDraft(e.target.value)}
            maxLength={220}
            rows={2}
            placeholder="Accuse. Defend. Lie. Fake a claim. Or say nothing…"
            style={{
              width: '100%',
              marginTop: 10,
              background: T.bubble,
              color: T.ink,
              border: `1px solid ${T.edge}`,
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 15,
              resize: 'none',
              transition: FADE,
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
            <Btn T={T} onClick={() => actions.doSpeak('')}>
              Stay silent
            </Btn>
            <Btn T={T} color={T.accent} onClick={() => actions.doSpeak(speechDraft)} disabled={!speechDraft.trim()}>
              Speak
            </Btn>
          </div>
        </div>
      );
    case 'vote': {
      const pool = votePool(state, HUMAN);
      return (
        <div>
          <div style={caps(T)}>
            {state.isRevote ? 'REVOTE — BREAK THE TIE' : 'CAST YOUR VOTE — OPEN BALLOT'}
          </div>
          <NameButtons T={T} state={state} ids={pool} onPick={actions.doVote} color={T.accent} />
        </div>
      );
    }
    default:
      return null;
  }
}
