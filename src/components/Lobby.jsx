import React, { useState } from 'react';
import { NIGHT, SERIF, FADE, caps, panel } from '../theme.js';
import { Sky, Stars, Disc, Btn, MuteButton } from './bits.jsx';
import { addRumor, resetSave } from '../storage.js';
import { ensureAudio, setScene } from '../audio.js';

const T = NIGHT;
const CHARACTERS = ['Marta', 'Diego', 'Wen', 'Bo', 'Sofia'];

export default function Lobby({ save, setSave, onBegin }) {
  const [rumorTarget, setRumorTarget] = useState('Marta');
  const [rumorText, setRumorText] = useState('');
  const [confirmBurn, setConfirmBurn] = useState(false);

  function plantRumor() {
    const text = rumorText.trim();
    if (!text) return;
    setSave(addRumor(save, rumorTarget, text));
    setRumorText('');
  }

  function burn() {
    if (!confirmBurn) {
      setConfirmBurn(true);
      return;
    }
    setSave(resetSave());
    setConfirmBurn(false);
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: SERIF, color: T.ink, position: 'relative' }}>
      <Sky night />
      <Stars visible />
      <MuteButton T={T} />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 620, margin: '0 auto', padding: '48px 16px 64px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Disc night size={84} />
          <h1 style={{ fontSize: 40, fontWeight: 'normal', letterSpacing: '0.12em', marginTop: 26 }}>
            WEREWOLF NIGHT
          </h1>
          <div style={{ ...caps(T), marginTop: 10 }}>A VILLAGE CHRONICLE · SIX SOULS · TWO LIARS</div>
          <p style={{ color: T.soft, marginTop: 18, maxWidth: 440, lineHeight: 1.6, fontSize: 15 }}>
            Five of them are played by a real AI. All of them remember what you did last game.
          </p>
          <Btn
            T={T}
            onClick={() => {
              ensureAudio(); // the click is the user gesture browsers require
              setScene(true);
              onBegin();
            }}
            color={T.accent}
            style={{ marginTop: 26, padding: '12px 34px', fontSize: 17, letterSpacing: '0.08em' }}
          >
            Begin
          </Btn>
        </div>

        {/* Memory panel */}
        <div style={{ ...panel(T), marginTop: 44, padding: '18px 20px' }}>
          <div style={caps(T)}>THE VILLAGE REMEMBERS · {save.games} GAME{save.games === 1 ? '' : 'S'} PLAYED</div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CHARACTERS.map((name) => {
              const entries = save.diaries[name] || [];
              const latest = entries[entries.length - 1];
              return (
                <div key={name} style={{ fontSize: 14, lineHeight: 1.5 }}>
                  <span style={{ color: T.gold }}>{name}</span>
                  <span style={{ color: T.soft }}>
                    {latest ? ` — “${latest}”` : ' — their diary is blank.'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Meddle */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.edge}`, transition: FADE }}>
            <div style={caps(T)}>MEDDLE · PLANT A RUMOR IN SOMEONE'S DIARY</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <select
                value={rumorTarget}
                onChange={(e) => setRumorTarget(e.target.value)}
                style={{
                  background: T.bubble,
                  color: T.ink,
                  border: `1px solid ${T.edge}`,
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 14,
                }}
              >
                {CHARACTERS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <input
                value={rumorText}
                onChange={(e) => setRumorText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && plantRumor()}
                maxLength={160}
                placeholder="e.g. Bo swore revenge on Diego at the well…"
                style={{
                  flex: 1,
                  minWidth: 180,
                  background: T.bubble,
                  color: T.ink,
                  border: `1px solid ${T.edge}`,
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 14,
                }}
              />
              <Btn T={T} onClick={plantRumor} disabled={!rumorText.trim()}>
                Plant it
              </Btn>
            </div>
            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <button
                onClick={burn}
                style={{ color: confirmBurn ? '#A32638' : T.soft, fontSize: 12, textDecoration: 'underline' }}
              >
                {confirmBurn ? 'Click again — this forgets everything' : 'Burn all diaries (reset memories)'}
              </button>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div style={{ ...panel(T), marginTop: 20, padding: '18px 20px' }}>
          <div style={caps(T)}>THE LAW OF THE VILLAGE</div>
          <p style={{ color: T.soft, fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>
            Six souls: two Werewolves, one Seer, one Witch, two Villagers — dealt in secret, you included. By
            night the wolves choose a kill, the seer peers into one soul, and the witch weighs her single save
            and single poison. By morning only names are spoken, never causes. By day everyone speaks once,
            then votes in the open; a tie is revoted once, and the banished keep their secrets. The village
            wins when both wolves are dead; the wolves win when both villagers — or both the seer and the
            witch — are gone. The dead may watch from the treeline, but they do not speak.
          </p>
        </div>
      </div>
    </div>
  );
}
