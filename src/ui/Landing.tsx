import { FullscreenButton } from './FullscreenButton';

const FEATURES = ['Gap jumps', 'Side leaps', 'Trampolines', 'Black portals', 'Mirror portals'];

interface Props {
  best: number;
  onPlay: () => void;
  onHowTo: () => void;
  onSettings: () => void;
}

/** Full-screen (100vh) title screen over the live, idle game scene. */
export function Landing({ best, onPlay, onHowTo, onSettings }: Props) {
  return (
    <section className="landing" data-testid="ready" aria-labelledby="title">
      <div className="landing-grid" aria-hidden="true" />
      <div className="landing-shapes" aria-hidden="true">
        <span className="shape tri" />
        <span className="shape hex" />
        <span className="shape sq" />
      </div>

      <header className="landing-top">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true" />
          SHADOW SHIFT
        </span>
        <span className="landing-actions">
          {best > 0 && (
            <span className="chip" data-testid="landing-best">
              Best <strong>{best} m</strong>
            </span>
          )}
          <FullscreenButton />
        </span>
      </header>

      <div className="landing-hero">
        <p className="eyebrow">Endless neon runner</p>
        <h1 id="title" className="title">
          <span>SHADOW</span>
          <span className="accent">SHIFT</span>
        </h1>
        <p className="tagline">
          Leap between floating towers, slide under beams and outrun the shadow.
        </p>
        <div className="cta">
          <button
            className="btn primary big"
            data-testid="start-btn"
            data-main-action
            onClick={onPlay}
            autoFocus
          >
            <span aria-hidden="true">▶</span> Play
          </button>
          <button className="btn ghost" data-testid="howto-btn" onClick={onHowTo}>
            How to play
          </button>
          <button className="btn ghost" data-testid="settings-btn" onClick={onSettings}>
            Settings
          </button>
        </div>
        <ul className="features" aria-label="Features">
          {FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>

      <footer className="landing-foot">
        <span className="kbd">Space</span> or tap <strong>Play</strong> to start
      </footer>
    </section>
  );
}
