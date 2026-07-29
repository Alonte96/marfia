import React, { useEffect, useRef, useState } from 'react';
import { newGame, NAMES, HUMAN } from './engine.js';
import { aiDiary } from './ai.js';
import { loadSave, persistSave, appendDiary } from './storage.js';
import Lobby from './components/Lobby.jsx';
import Table from './components/Table.jsx';
import GameOver from './components/GameOver.jsx';
import DirectorsCut from './components/DirectorsCut.jsx';

export default function App() {
  const [screen, setScreen] = useState('lobby'); // lobby | table | over | cut
  const [save, setSave] = useState(loadSave);
  const [liveGame, setLiveGame] = useState(null); // initial state handed to Table
  const [finalGame, setFinalGame] = useState(null); // finished state for over/cut
  const [gameNonce, setGameNonce] = useState(0);
  const [diaryStatus, setDiaryStatus] = useState('idle'); // idle | writing | done
  const diaryRanRef = useRef(-1);

  function startGame() {
    setLiveGame(newGame());
    setFinalGame(null);
    setDiaryStatus('idle');
    setGameNonce((n) => n + 1);
    setScreen('table');
  }

  function handleOver(state) {
    setFinalGame(state);
    setScreen('over');
  }

  // After every game: one diary call per AI character, then bump the counter.
  useEffect(() => {
    if (screen !== 'over' || !finalGame) return;
    if (diaryRanRef.current === gameNonce) return;
    diaryRanRef.current = gameNonce;
    let cancelled = false;
    (async () => {
      setDiaryStatus('writing');
      const gameNumber = save.games + 1;
      let next = save;
      for (const name of NAMES) {
        const player = finalGame.players.find((p) => p.name === name);
        if (player.id === HUMAN) continue;
        const entry = await aiDiary(finalGame, player.id, save, gameNumber);
        if (entry) next = appendDiary(next, name, `[Game ${gameNumber}] ${entry}`);
      }
      next = { ...next, games: next.games + 1 };
      persistSave(next);
      if (!cancelled) {
        setSave(next);
        setDiaryStatus('done');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screen, finalGame, gameNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  if (screen === 'table' && liveGame) {
    return <Table key={gameNonce} initial={liveGame} save={save} onOver={handleOver} />;
  }
  if (screen === 'over' && finalGame) {
    return (
      <GameOver
        game={finalGame}
        diaryStatus={diaryStatus}
        onCut={() => setScreen('cut')}
        onAgain={startGame}
        onLobby={() => setScreen('lobby')}
      />
    );
  }
  if (screen === 'cut' && finalGame) {
    return <DirectorsCut game={finalGame} onBack={() => setScreen('over')} />;
  }
  return <Lobby save={save} setSave={setSave} onBegin={startGame} />;
}
