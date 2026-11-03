import type { UiSnapshot } from '../app/store';

interface PauseProps {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onHowTo: () => void;
  onSettings: () => void;
}

export function PausePanel({ onResume, onRestart, onMenu, onHowTo, onSettings }: PauseProps) {
  return (
    <div className="modal" data-testid="paused">
      <div className="panel" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <h2 id="pause-title">Paused</h2>
        <button
          className="btn primary"
          data-testid="resume-btn"
          data-main-action
          onClick={onResume}
          autoFocus
        >
          Resume
        </button>
        <button className="btn ghost" data-testid="restart-btn" onClick={onRestart}>
          Restart
        </button>
        <button className="btn ghost" onClick={onHowTo}>
          How to play
        </button>
        <button className="btn ghost" data-testid="pause-settings-btn" onClick={onSettings}>
          Settings
        </button>
        <button className="btn link" data-testid="menu-btn" onClick={onMenu}>
          Main menu
        </button>
      </div>
    </div>
  );
}

interface OverProps {
  ui: UiSnapshot;
  onAgain: () => void;
  onMenu: () => void;
}

export function GameOverPanel({ ui, onAgain, onMenu }: OverProps) {
  return (
    <div className="modal" data-testid="gameover">
      <div className="panel" role="dialog" aria-modal="true" aria-labelledby="over-title">
        <h2 id="over-title">
          {ui.cause === 'fell'
            ? 'You fell'
            : ui.cause === 'burn'
              ? 'Burned by a laser'
              : 'You crashed'}
        </h2>
        {ui.newBest && (
          <p className="badge" data-testid="new-best">
            New best!
          </p>
        )}
        <p className="final" data-testid="final-score">
          {ui.score} m
        </p>
        <p className="muted">Best {ui.best} m</p>
        <p className="shards-line" data-testid="over-shards">
          <span aria-hidden="true">◆</span> {ui.shards} shards · {ui.totalShards} in total
        </p>
        <button className="btn primary" data-testid="again-btn" onClick={onAgain} autoFocus>
          Run again
        </button>
        <button className="btn link" data-testid="over-menu-btn" onClick={onMenu}>
          Main menu
        </button>
      </div>
    </div>
  );
}
