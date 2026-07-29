import React, { useEffect } from 'react';
import { ROLE_LABEL, ROLE_COLOR } from '../engine.js';
import { NIGHT, DAY, SERIF, caps, panel } from '../theme.js';
import { Sky, Stars, Disc, Avatar, Btn, MuteButton } from './bits.jsx';
import { setScene } from '../audio.js';

export default function GameOver({ game, diaryStatus, onCut, onAgain, onLobby }) {
  const wolvesWon = game.winner === 'wolves';
  const T = wolvesWon ? NIGHT : DAY;

  useEffect(() => {
    setScene(wolvesWon);
  }, [wolvesWon]);

  return (
    <div style={{ minHeight: '100vh', fontFamily: SERIF, color: T.ink, position: 'relative' }}>
      <Sky night={wolvesWon} />
      <Stars visible={wolvesWon} />
      <MuteButton T={T} />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 620, margin: '0 auto', padding: '54px 16px 64px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Disc night={wolvesWon} size={72} />
        </div>
        <div style={{ ...caps(T), marginTop: 24 }}>THE CHRONICLE ENDS · {game.day} {game.day === 1 ? 'DAY' : 'DAYS'}</div>
        <h1 style={{ fontSize: 30, fontWeight: 'normal', marginTop: 12, lineHeight: 1.3 }}>
          {wolvesWon ? 'The wolves have taken the village.' : 'The village stands — both wolves are gone.'}
        </h1>

        {/* Full cast, every role revealed */}
        <div style={{ ...panel(T), marginTop: 32, padding: '18px 14px' }}>
          <div style={caps(T)}>EVERY MASK COMES OFF</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 4, flexWrap: 'wrap' }}>
            {game.players.map((p) => (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, minWidth: 72 }}>
                <Avatar player={p} night={false} size={40} />
                <div style={{ fontSize: 12, textDecoration: p.alive ? 'none' : 'line-through', opacity: p.alive ? 1 : 0.65 }}>
                  {p.name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#F4EFE2',
                    background: ROLE_COLOR[p.role],
                    borderRadius: 4,
                    padding: '2px 7px',
                  }}
                >
                  {ROLE_LABEL[p.role]}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 22, fontSize: 14, fontStyle: 'italic', color: T.soft }}>
          {diaryStatus === 'done'
            ? 'Diaries written. They will remember.'
            : 'The characters are writing their diaries…'}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' }}>
          <Btn T={T} onClick={onCut}>
            Open the Director's Cut
          </Btn>
          <Btn T={T} color={T.accent} onClick={onAgain} disabled={diaryStatus !== 'done'}>
            Play again — they remember
          </Btn>
        </div>
        <div style={{ marginTop: 18 }}>
          <button onClick={onLobby} style={{ color: T.soft, fontSize: 13, textDecoration: 'underline' }}>
            back to the lobby
          </button>
        </div>
      </div>
    </div>
  );
}
