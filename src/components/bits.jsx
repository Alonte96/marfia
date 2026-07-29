import React, { useMemo, useState } from 'react';
import { HUES, BLOOD } from '../engine.js';
import { FADE } from '../theme.js';
import { ensureAudio, toggleMute, isMuted } from '../audio.js';

// Player avatar: colored circle with the initial. Dead players are greyscaled
// with a red X; at night, living avatars dim toward silhouettes.
export function Avatar({ player, night, size = 42 }) {
  const dead = !player.alive;
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        background: HUES[player.id],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#F4EFE2',
        fontSize: size * 0.42,
        flexShrink: 0,
        filter: dead ? 'grayscale(1)' : night ? 'brightness(0.55)' : 'none',
        opacity: dead ? 0.45 : 1,
        transition: 'filter 1.4s ease, opacity 1.4s ease',
        boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.25)',
      }}
    >
      {player.name[0]}
      {dead && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: BLOOD,
            fontSize: size * 0.62,
            fontWeight: 'bold',
            opacity: 0.95,
          }}
        >
          ✕
        </div>
      )}
    </div>
  );
}

// ~40 tiny stars in the upper sky, twinkling. Rendered always but faded out
// by day so the crossfade matches the rest of the world.
export function Stars({ visible }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 38,
        size: Math.random() < 0.25 ? 2.5 : 1.5,
        delay: Math.random() * 3.5,
      })),
    [],
  );
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 1.4s ease',
        zIndex: 1,
      }}
    >
      {stars.map((s) => (
        <div
          key={s.id}
          className="ww-star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// Sun/moon disc: two stacked spheres crossfading with the world.
export function Disc({ night, size = 64 }) {
  const common = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    transition: 'opacity 1.4s ease',
  };
  return (
    <div className="ww-drift" style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          ...common,
          opacity: night ? 1 : 0,
          background: 'radial-gradient(circle at 36% 32%, #D9E4E1, #9DB4B0 48%, #46605E 100%)',
          boxShadow: '0 0 34px 8px rgba(157,180,176,0.35)',
        }}
      />
      <div
        style={{
          ...common,
          opacity: night ? 0 : 1,
          background: 'radial-gradient(circle at 40% 36%, #F5E4A9, #C9A227 55%, #A9861B 100%)',
          boxShadow: '0 0 38px 10px rgba(201,162,39,0.4)',
        }}
      />
    </div>
  );
}

// The two full-viewport sky layers that everything sits on.
export function Sky({ night }) {
  const layer = (bgA, bgB, on) => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: `radial-gradient(120% 90% at 50% -10%, ${bgA} 0%, ${bgB} 72%)`,
        opacity: on ? 1 : 0,
        transition: 'opacity 1.4s ease',
        zIndex: 0,
      }}
    />
  );
  return (
    <>
      {layer('#101E24', '#0C1418', night)}
      {layer('#EFE6D0', '#E4D6B8', !night)}
    </>
  );
}

// Quiet corner toggle for the ambient soundtrack.
export function MuteButton({ T }) {
  const [m, setM] = useState(isMuted());
  return (
    <button
      onClick={() => {
        ensureAudio();
        setM(toggleMute());
      }}
      title={m ? 'Let the village be heard' : 'Silence the village'}
      aria-label={m ? 'Unmute ambient sound' : 'Mute ambient sound'}
      style={{
        position: 'fixed',
        top: 10,
        right: 12,
        zIndex: 20,
        fontSize: 15,
        opacity: 0.55,
        color: T.soft,
      }}
    >
      {m ? '🔇' : '🔊'}
    </button>
  );
}

// A simple themed button.
export function Btn({ T, children, onClick, color, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${color || T.edge}`,
        color: color || T.ink,
        background: 'transparent',
        borderRadius: 6,
        padding: '8px 14px',
        fontSize: 14,
        transition: FADE,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
