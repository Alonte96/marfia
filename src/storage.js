// Persistent memory: localStorage under a single key.
// Shape: { games: number, diaries: { [characterName]: string[] } }
const KEY = 'ww:save';
const MAX_ENTRIES = 4;

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s.games === 'number' && s.diaries && typeof s.diaries === 'object') {
        return s;
      }
    }
  } catch {
    /* corrupted save — start fresh */
  }
  return { games: 0, diaries: {} };
}

export function persistSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* storage unavailable — play on without memory */
  }
}

export function appendDiary(save, name, entry) {
  const diaries = { ...save.diaries };
  const list = [...(diaries[name] || []), entry];
  diaries[name] = list.slice(-MAX_ENTRIES);
  return { ...save, diaries };
}

export function addRumor(save, name, text) {
  const next = appendDiary(save, name, `[Rumor] ${text}`);
  persistSave(next);
  return next;
}

export function resetSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return { games: 0, diaries: {} };
}
