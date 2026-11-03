import { FullscreenButton } from './FullscreenButton';

interface Props {
  best: number;
  totalShards: number;
  onPlay: () => void;
  onHowTo: () => void;
  onSettings: () => void;
}

/** Skills shown as tiles, with the same line glyphs as the how-to-play cards. */
const SKILLS: { name: string; path: string }[] = [
  { name: 'Jump', path: 'M4 19h5M15 19h5M12 15V5M8 9l4-4 4 4' },
  { name: 'Slide', path: 'M4 6h16M12 10v9M8 15l4 4 4-4' },
  { name: 'Wall-run', path: 'M5 3v18M9 18c3-2 5-6 6-12M15 6l-3 1M15 6l1 3' },
  { name: 'Portals', path: 'M5 9a7 7 0 0 1 13-2M19 15a7 7 0 0 1-13 2M18 3v4h-4M6 21v-4h4' },
];

/** Top speed (m/s) the runner reaches, for the stats panel. */
const TOP_SPEED = 19;

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/**
 * Title screen: a light, premium character-select style panel over the live game scene. Menu
 * cards on the left, the runner in the middle, and the runner's record (best distance, stats,
 * skills) with the start button on the right.
 */
export function Landing({ best, totalShards, onPlay, onHowTo, onSettings }: Props) {
  const stats = [
    { label: 'Best run', value: `${best} m`, k: Math.min(1, best / 3000) },
    { label: 'Shards', value: String(totalShards), k: Math.min(1, totalShards / 500) },
    { label: 'Top speed', value: `${TOP_SPEED} m/s`, k: 1 },
    { label: 'Moves', value: '8', k: 0.8 },
  ];
  return (
    <section className="home" data-testid="ready" aria-labelledby="title">
      <div className="home-panel">
        <header className="home-top">
          <span className="home-tab" aria-hidden="true">
            <span className="brand-mark" />
          </span>
          <h1 id="title" className="home-title">
            Shadow Shift
          </h1>
          <span className="home-actions">
            <span className="home-pill" title="Energy shards collected">
              <span className="shard-icon" aria-hidden="true" />
              {totalShards}
            </span>
            <FullscreenButton />
          </span>
        </header>

        <nav className="home-menu" aria-label="Menu">
          <p className="home-label">
            Modes <span>—</span> Endless
          </p>
          <button className="home-card active" onClick={onPlay}>
            <span className="home-thumb run" aria-hidden="true">
              <Glyph d="M13 4a2 2 0 1 0 0 .1M9 21l3-6-3-3 4-4 3 3h4M6 12l3-3" />
            </span>
            <span>
              <strong>Endless Run</strong>
              <small>Rooftop parkour</small>
            </span>
          </button>
          <button className="home-card" data-testid="howto-btn" onClick={onHowTo}>
            <span className="home-thumb" aria-hidden="true">
              <Glyph d="M12 17h.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7" />
            </span>
            <span>
              <strong>How to Play</strong>
              <small>Every move explained</small>
            </span>
          </button>
          <button className="home-card" data-testid="settings-btn" onClick={onSettings}>
            <span className="home-thumb" aria-hidden="true">
              <Glyph d="M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4" />
            </span>
            <span>
              <strong>Settings</strong>
              <small>Sound, quality, effects</small>
            </span>
          </button>
          <div className="home-card static" aria-label="Controls">
            <span className="home-thumb" aria-hidden="true">
              <Glyph d="M3 8h18v10H3zM7 12h.01M11 12h.01M15 12h.01M8 15h8" />
            </span>
            <span>
              <strong>Controls</strong>
              <small>Arrows · WASD · Swipe</small>
            </span>
          </div>
        </nav>

        <figure className="home-hero" aria-hidden="true">
          <img src="./hero-runner.webp" alt="" width="384" height="906" />
        </figure>

        <aside className="home-side">
          <div className="home-level" data-testid="landing-best">
            <span className="home-big">{best}</span>
            <span className="home-unit">Best · metres</span>
          </div>
          <div className="home-name">
            <strong>Runner</strong>
            <small>
              Class <b>S</b>
            </small>
          </div>
          <ul className="home-stats">
            {stats.map((s) => (
              <li key={s.label}>
                <span>{s.label}</span>
                <span>{s.value}</span>
                <i style={{ ['--k' as string]: s.k }} />
              </li>
            ))}
          </ul>
          <p className="home-label">Skills</p>
          <ul className="home-skills">
            {SKILLS.map((s) => (
              <li key={s.name} title={s.name}>
                <Glyph d={s.path} />
              </li>
            ))}
          </ul>
          <button
            className="home-start"
            data-testid="start-btn"
            data-main-action
            onClick={onPlay}
            autoFocus
          >
            Start run
          </button>
          <p className="home-hint">
            <span className="kbd">Space</span> to start
          </p>
        </aside>
      </div>
    </section>
  );
}
