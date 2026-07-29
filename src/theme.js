// The two worlds. The whole UI crossfades between them over ~1.4s.
export const NIGHT = {
  skyA: '#101E24',
  skyB: '#0C1418',
  panel: '#14232A',
  edge: '#23404A',
  ink: '#C7D6D4',
  soft: '#7E979A',
  accent: '#D8843C',
  gold: '#9DB4B0',
  bubble: '#182B33',
};

export const DAY = {
  skyA: '#EFE6D0',
  skyB: '#E4D6B8',
  panel: '#F6EFDD',
  edge: '#D8C9A8',
  ink: '#2B2118',
  soft: '#6B5D4A',
  accent: '#B33A2B',
  gold: '#C9A227',
  bubble: '#FDF8EC',
};

export const BLOOD = '#A32638';

export const SERIF = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif";

export const FADE = 'background-color 1.4s ease, color 1.4s ease, border-color 1.4s ease, opacity 1.4s ease';

// Letterspaced small-caps label style.
export function caps(T, size = 11) {
  return {
    fontSize: size,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: T.soft,
    transition: FADE,
  };
}

export function panel(T) {
  return {
    background: T.panel,
    border: `1px solid ${T.edge}`,
    borderRadius: 8,
    transition: FADE,
  };
}
