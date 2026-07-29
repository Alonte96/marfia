import React from 'react';
import { ROLE_LABEL, ROLE_COLOR, HUES } from '../engine.js';
import { DAY, SERIF, caps, panel } from '../theme.js';
import { Sky, Btn } from './bits.jsx';

// The replay-the-lies payoff: a chronological ledger of everything secret,
// every actor tagged with their true role, every private thought exposed.
export default function DirectorsCut({ game, onBack }) {
  const T = DAY;

  return (
    <div style={{ minHeight: '100vh', fontFamily: SERIF, color: T.ink, position: 'relative' }}>
      <Sky night={false} />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 620, margin: '0 auto', padding: '44px 16px 64px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={caps(T)}>THE DIRECTOR'S CUT</div>
          <h1 style={{ fontSize: 26, fontWeight: 'normal', marginTop: 8 }}>Everything that was hidden</h1>
          <p style={{ fontSize: 14, color: T.soft, marginTop: 8, fontStyle: 'italic' }}>
            Read it back and watch the lies at work.
          </p>
        </div>

        <div style={{ ...panel(T), marginTop: 28, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {game.secret.map((e, i) => (
            <CutEntry key={i} T={T} game={game} entry={e} />
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 26 }}>
          <Btn T={T} onClick={onBack}>
            Close the ledger
          </Btn>
        </div>
      </div>
    </div>
  );
}

function RoleTag({ role }) {
  return (
    <span
      style={{
        fontSize: 10,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: ROLE_COLOR[role],
        border: `1px solid ${ROLE_COLOR[role]}`,
        borderRadius: 4,
        padding: '1px 6px',
        marginLeft: 8,
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
      }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function CutEntry({ T, game, entry }) {
  if (entry.kind === 'phase') {
    return <div style={{ ...caps(T), textAlign: 'center', margin: '10px 0 2px' }}>— {entry.text} —</div>;
  }

  if (entry.actorId == null) {
    // deal, deaths, banishments, results — narrator lines with roles exposed
    const strong = entry.kind === 'deal' || entry.kind === 'result';
    return (
      <div
        style={{
          fontSize: strong ? 14.5 : 13.5,
          color: strong ? T.ink : T.soft,
          textAlign: 'center',
          lineHeight: 1.6,
          borderTop: strong ? `1px solid ${T.edge}` : 'none',
          borderBottom: strong ? `1px solid ${T.edge}` : 'none',
          padding: strong ? '10px 0' : 0,
        }}
      >
        {entry.text}
      </div>
    );
  }

  const actor = game.players[entry.actorId];
  return (
    <div style={{ lineHeight: 1.55 }}>
      <div style={{ fontSize: 14.5 }}>
        <span style={{ color: HUES[actor.id] }}>{actor.name}</span>
        <RoleTag role={actor.role} />
        <span style={{ marginLeft: 8 }}>{entry.text}</span>
      </div>
      {entry.thought && (
        <div style={{ fontSize: 13, color: T.soft, fontStyle: 'italic', marginTop: 3, marginLeft: 14 }}>
          “{entry.thought}”
        </div>
      )}
    </div>
  );
}
