import { useCallback, useState, useSyncExternalStore } from 'react';
import type { GameApi } from '../app/GameController';
import { useFullscreenKey } from './fullscreen';
import { HintPill } from './HintPill';
import { HowToPlay } from './HowToPlay';
import { Hud } from './Hud';
import { Landing } from './Landing';
import { SettingsPanel } from './SettingsPanel';
import { GameOverPanel, PausePanel } from './Panels';

/** Picks the screen for the current phase. Re-renders only when the throttled store changes. */
export function Screens({ api }: { api: GameApi }) {
  const ui = useSyncExternalStore(api.store.subscribe, api.store.get);
  useFullscreenKey();
  const [howTo, setHowTo] = useState(false);
  const [settings, setSettings] = useState(false);
  // Hand focus back to the screen's main button, so Space starts/resumes instead of reopening.
  const closeHowTo = useCallback(() => {
    setHowTo(false);
    setSettings(false);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-main-action]')?.focus());
  }, []);
  const inRun = ui.phase === 'playing' || ui.phase === 'paused' || ui.phase === 'dying';

  return (
    <div className="screens">
      <div className={`vignette ${ui.effect}`} aria-hidden="true" />
      {ui.phase === 'ready' && (
        <Landing
          best={ui.best}
          onPlay={() => api.intent('primary')}
          onHowTo={() => setHowTo(true)}
          onSettings={() => setSettings(true)}
        />
      )}
      {inRun && <Hud ui={ui} onPause={() => api.intent('togglePause')} />}
      {ui.phase === 'playing' && ui.hint && <HintPill hint={ui.hint} />}
      {ui.phase === 'paused' && (
        <PausePanel
          onResume={() => api.intent('primary')}
          onRestart={() => api.intent('restart')}
          onMenu={() => api.intent('menu')}
          onHowTo={() => setHowTo(true)}
          onSettings={() => setSettings(true)}
        />
      )}
      {ui.phase === 'gameover' && (
        <GameOverPanel
          ui={ui}
          onAgain={() => api.intent('primary')}
          onMenu={() => api.intent('menu')}
        />
      )}
      {howTo && <HowToPlay onClose={closeHowTo} />}
      {settings && <SettingsPanel api={api} onClose={closeHowTo} />}
      {ui.notice && (
        <div className="notice" role="status">
          {ui.notice}
        </div>
      )}
    </div>
  );
}
