import type { UiSnapshot } from '../app/store';
import { FullscreenButton } from './FullscreenButton';

/** In-run overlay: distance, best, pause, and banners for active effects. */
export function Hud({ ui, onPause }: { ui: UiSnapshot; onPause: () => void }) {
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="score-box">
          <div className="score" data-testid="score">
            {ui.score}
            <span>m</span>
          </div>
          {ui.best > 0 && <div className="hud-best">Best {ui.best} m</div>}
          <div className="hud-shards" data-testid="hud-shards" aria-label={`${ui.shards} shards`}>
            <span aria-hidden="true">◆</span> {ui.shards}
          </div>
        </div>
        <div className="hud-buttons">
          <FullscreenButton />
          {ui.phase === 'playing' && (
            <button
              className="btn icon"
              aria-label="Pause"
              data-testid="pause-btn"
              onClick={onPause}
            >
              ❚❚
            </button>
          )}
        </div>
      </div>
      <div className="banners">
        {ui.effect !== 'none' && (
          <div className="banner shadow" data-testid="effect">
            {ui.effect === 'shadow' ? 'DARKNESS' : 'AUTO RUN'} · {ui.effectLeft}s
          </div>
        )}
        {ui.mirrorLeft > 0 && (
          <div className="banner mirror" data-testid="mirror">
            MIRROR · {ui.mirrorLeft}s · all controls reversed
          </div>
        )}
      </div>
    </div>
  );
}
