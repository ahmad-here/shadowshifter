import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameApi } from '../app/GameController';
import type { QualitySetting } from '../app/settings';

const QUALITIES: { value: QualitySetting; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/** Sound, graphics quality, reduced effects and best-score reset. Changes apply instantly. */
export function SettingsPanel({ api, onClose }: { api: GameApi; onClose: () => void }) {
  const s = useSyncExternalStore(api.settings.subscribe, api.settings.get);
  const best = useSyncExternalStore(api.store.subscribe, () => api.store.get().best);
  const [confirmReset, setConfirmReset] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      data-testid="settings"
    >
      <div className="panel settings">
        <div className="modal-head">
          <h2 id="settings-title">Settings</h2>
          <button
            ref={closeRef}
            className="btn icon"
            aria-label="Close"
            onClick={onClose}
            data-testid="settings-close"
          >
            ✕
          </button>
        </div>

        <label className="row">
          <span>Sound</span>
          <input
            type="checkbox"
            className="switch"
            checked={s.sound}
            onChange={(e) => api.settings.set({ sound: e.target.checked })}
            data-testid="setting-sound"
          />
        </label>

        <div className="row column">
          <span id="quality-label">Graphics quality</span>
          <div className="segmented" role="radiogroup" aria-labelledby="quality-label">
            {QUALITIES.map((q) => (
              <button
                key={q.value}
                role="radio"
                aria-checked={s.quality === q.value}
                className={s.quality === q.value ? 'on' : ''}
                onClick={() => api.settings.set({ quality: q.value })}
                data-testid={`quality-${q.value}`}
              >
                {q.label}
              </button>
            ))}
          </div>
          <small className="muted">
            Auto adjusts to your device. Quality never changes gameplay.
          </small>
        </div>

        <label className="row">
          <span>Reduced effects</span>
          <input
            type="checkbox"
            className="switch"
            checked={s.reducedEffects}
            onChange={(e) => api.settings.set({ reducedEffects: e.target.checked })}
            data-testid="setting-reduced"
          />
        </label>

        <div className="row">
          <span>Tips for new players</span>
          <button
            className="btn ghost"
            data-testid="reset-tips"
            onClick={() => api.resetTutorial()}
          >
            Show again
          </button>
        </div>

        <div className="row">
          <span>Best distance: {best} m</span>
          {confirmReset ? (
            <span className="confirm">
              <button
                className="btn danger"
                data-testid="reset-confirm"
                onClick={() => {
                  api.resetBest();
                  setConfirmReset(false);
                }}
              >
                Reset
              </button>
              <button className="btn link" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              className="btn ghost"
              disabled={best === 0}
              onClick={() => setConfirmReset(true)}
              data-testid="reset-best"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
