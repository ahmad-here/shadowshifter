// Phase 4 articles (long-tail informational topics; see SEO_KEYWORD_MAP.md). Same fields as
// tools/articles.mjs. Claims about Shadow Shift must match the code.

export const MORE_ARTICLES = [
  {
    slug: 'what-is-an-endless-runner-game',
    title: 'What Is an Endless Runner Game? The Genre Explained',
    description:
      'What makes a game an endless runner: auto-running, rising speed, generated levels and distance scores. How the genre works and why it is so replayable.',
    h1: 'What Is an Endless Runner Game?',
    teaser: 'the genre in one read',
    image: 'shadow-shift-rooftop-run',
    imageAlt: 'A runner sprinting forward across rooftops in an endless runner game',
    published: '2026-11-16',
    minutes: 5,
    related: ['beginners-guide-to-rooftop-parkour-games', 'beat-your-high-score-endless-runner'],
    links: [['/game-features/', 'Shadow Shift features', 'an endless runner in 3D']],
    body: `
<p class="lead">An endless runner is a game where your character runs forward automatically and the
level never ends. You do not steer the speed; you only decide when to jump, slide or turn. The goal is
simply to last as long as you can.</p>

<h2>The four ingredients</h2>
<ol>
  <li><strong>Automatic running:</strong> the character always moves forward. Your input is about
  timing, not movement.</li>
  <li><strong>Rising speed:</strong> the run gets faster the longer you survive, so difficulty grows
  without new rules.</li>
  <li><strong>Generated levels:</strong> the route is built as you go, often randomly, so it cannot be
  memorised.</li>
  <li><strong>A distance or points score:</strong> every run ends in failure; the question is how far
  you got.</li>
</ol>

<h2>Why the genre works</h2>
<p>Runs are short, so a failure costs seconds, not minutes. The controls are few, so anyone can start.
And because the route is new every time, the hundredth run still asks for attention. That mix of
quick restarts and steady improvement is what keeps players coming back.</p>

<h2>2D, lane-based and free 3D runners</h2>
<ul>
  <li><strong>2D side-scrollers</strong> run left to right and are usually one-button jump games.</li>
  <li><strong>Lane runners</strong> run into the screen and let you switch between a few fixed lanes.</li>
  <li><strong>3D parkour runners</strong> add real geometry: gaps between buildings, height changes,
  corners and moves such as wall-runs and climbs.</li>
</ul>
<p><a href="/">Shadow Shift</a> belongs to the third group: it runs across separate floating rooftops,
speeds up from 10 to 19 metres per second, and scores you by distance.</p>

<h2>What makes a good one</h2>
<p>Fairness above all: every obstacle readable in advance and every gap possible. Then variety, so the
route keeps surprising you, and feel, so every jump and landing is satisfying on its own.</p>

<h2>Next steps</h2>
<p>New to the genre? Read the <a href="/blog/beginners-guide-to-rooftop-parkour-games/">beginner's
guide to rooftop parkour games</a>, then <a href="/">try a run</a>.</p>`,
  },
  {
    slug: 'how-to-wall-run-in-parkour-games',
    title: 'How to Wall-Run in Parkour Games: A Simple Guide',
    description:
      'How wall-running works in parkour games, how to time the jump and the step onto the wall, and the common reasons wall-runs fail, with Shadow Shift examples.',
    h1: 'How to Wall-Run in Parkour Games',
    teaser: 'timing the jump and the step to the wall',
    image: 'shadow-shift-wall-running',
    imageAlt: 'A runner running along a wall over a long gap between buildings',
    published: '2026-11-16',
    minutes: 5,
    related: ['parkour-movement-in-3d-games', 'parkour-game-terms-glossary'],
    links: [['/how-to-play/#moves', 'Shadow Shift wall-runs', 'the exact controls']],
    body: `
<p class="lead">A wall-run lets you cross a gap too long for any jump by running along a wall for a
few steps. It looks spectacular, but in most games it comes down to two inputs in the right order.</p>

<h2>How wall-running works in games</h2>
<p>Games usually start a wall-run when you are in the air, close to a wall, and moving along it. While
on the wall the character keeps their height (or sinks slowly) and keeps their speed. At the end they
kick off, either automatically or when you press jump.</p>

<h2>The two-step method</h2>
<ol>
  <li><strong>Jump first,</strong> from the edge, as you would for any gap.</li>
  <li><strong>Then move toward the wall</strong> while in the air.</li>
</ol>
<p>In <a href="/">Shadow Shift</a>, wall-run gaps are 15 to 17 metres long with a tall wall along one
side. Jump, then press left or right toward the wall: the runner plants their feet on it, holds their
height and kicks off onto the next building near the end.</p>

<h2>Why wall-runs fail</h2>
<ul>
  <li><strong>No jump:</strong> running off the edge without jumping is a fall; the wall-run only
  starts from the air.</li>
  <li><strong>Only a jump:</strong> the gap is too long, so a jump alone falls short.</li>
  <li><strong>Wrong direction:</strong> stepping away from the wall sends you into the gap.</li>
  <li><strong>Too late:</strong> if you wait too long in the air you are already falling below the wall.</li>
</ul>

<h2>How to spot a wall-run</h2>
<p>A gap that is clearly too long and a wall running alongside it are the signal. Decide which side
the wall is on before you reach the edge, so the second press is automatic.</p>

<h2>Practice tip</h2>
<p>Say "jump, wall" in your head as you approach. The rhythm of two quick presses is easier to
remember than the move itself.</p>

<h2>Next steps</h2>
<p>See every move in <a href="/game-features/">Shadow Shift's features</a>, or learn the vocabulary in
the <a href="/blog/parkour-game-terms-glossary/">parkour game glossary</a>.</p>`,
  },
  {
    slug: 'parkour-game-terms-glossary',
    title: 'Parkour Game Terms: A Glossary for Players',
    description:
      'Wall-run, vault, coyote time, input buffer, ledge catch and more: the parkour and runner game terms players meet, explained in plain words.',
    h1: 'Parkour Game Terms: A Glossary for Players',
    teaser: 'the vocabulary, explained',
    image: 'shadow-shift-climbing',
    imageAlt: 'A runner pulling up onto the roof of a taller building',
    published: '2026-11-16',
    minutes: 5,
    related: ['parkour-movement-in-3d-games', 'how-to-wall-run-in-parkour-games'],
    links: [['/how-to-play/', 'How to play Shadow Shift', 'the moves in practice']],
    body: `
<p class="lead">Parkour games borrow words from real parkour and from game design. Here are the terms
you will meet most, in plain words.</p>

<h2>Movement</h2>
<dl>
  <dt>Precision jump</dt><dd>A jump to a small, exact landing spot.</dd>
  <dt>Gap jump</dt><dd>A jump across the space between two surfaces, such as rooftops.</dd>
  <dt>Vault</dt><dd>Crossing a waist-high obstacle using your hands. Often automatic in games.</dd>
  <dt>Slide</dt><dd>Dropping low to pass under an obstacle while keeping speed.</dd>
  <dt>Wall-run</dt><dd>Running along a vertical wall for a few steps, usually to cross a long gap.</dd>
  <dt>Climb-up</dt><dd>Pulling yourself onto a higher surface.</dd>
  <dt>Ledge catch (ledge grab)</dt><dd>Grabbing an edge you only just failed to land on.</dd>
  <dt>Slam</dt><dd>Forcing a fast drop from the air, often into a slide.</dd>
  <dt>Flow</dt><dd>Chaining moves without losing speed.</dd>
</dl>

<h2>Game design terms</h2>
<dl>
  <dt>Coyote time</dt><dd>A short moment after leaving an edge when a jump still works.</dd>
  <dt>Input buffer</dt><dd>A press made slightly early that the game remembers and performs on time.</dd>
  <dt>Hit-stop</dt><dd>A tiny freeze on impact that makes a crash or hit feel heavier.</dd>
  <dt>Procedural generation</dt><dd>Levels built by rules at runtime instead of by hand.</dd>
  <dt>Near miss</dt><dd>Passing an obstacle by a very small margin; many games reward it.</dd>
  <dt>Telegraphing</dt><dd>Showing a hazard clearly in advance so the player can react.</dd>
</dl>

<h2>Runner terms</h2>
<dl>
  <dt>Auto-run</dt><dd>The character runs forward without input.</dd>
  <dt>Lane switch</dt><dd>Moving sideways between parallel paths.</dd>
  <dt>Run</dt><dd>One attempt, from start to fall.</dd>
</dl>
<p>Most of these appear in <a href="/">Shadow Shift</a>: it has vaults, slides, wall-runs, climbs, a
ledge catch, slams, coyote time, an input buffer and near-miss rewards.</p>

<h2>Next steps</h2>
<p>See how these moves are designed in <a href="/blog/parkour-movement-in-3d-games/">understanding
parkour movement in 3D games</a>.</p>`,
  },
  {
    slug: 'play-parkour-games-on-mobile',
    title: 'How to Play Parkour Games on Mobile: Swipe Tips',
    description:
      'Swipe controls for parkour and runner games on phones: how to swipe reliably, hold the phone, avoid missed inputs and get a smooth game in the browser.',
    h1: 'How to Play Parkour Games on Mobile',
    teaser: 'swipe controls that work',
    image: 'shadow-shift-slide-under-pipes',
    imageAlt: 'An overhead pipe bundle the runner must slide under',
    published: '2026-11-16',
    minutes: 4,
    related: ['play-3d-games-in-browser-no-download', 'improve-timing-in-endless-runner-games'],
    links: [['/how-to-play/#controls', 'Shadow Shift controls', 'keyboard and touch']],
    body: `
<p class="lead">Runner games are made for phones: short runs and four directions. A few habits make
swipe controls feel as precise as a keyboard.</p>

<h2>The usual swipe layout</h2>
<p>Swipe up to jump, down to slide, left or right to turn or change lane. <a href="/">Shadow Shift</a>
uses exactly this, and a swipe down in mid-air slams you to the ground.</p>

<h2>Swipe short and fast</h2>
<p>Games detect a swipe from a short, quick movement. Long, slow drags can register late or not at
all. Flick your thumb about a centimetre and lift it.</p>

<h2>One swipe per action</h2>
<p>Lift your thumb between swipes. Starting a new swipe before the last one ends can be read as one
diagonal movement.</p>

<h2>Hold the phone steady</h2>
<p>Use both hands in landscape or rest the phone on something in portrait, and swipe with one thumb
from the centre of the screen. Starting near the edge can trigger the system's back gesture.</p>

<h2>Get a smooth frame rate</h2>
<ul>
  <li>Close other tabs and apps.</li>
  <li>Use the game's quality setting if it stutters: Shadow Shift has Auto, Low, Medium and High, and
  Auto lowers quality when frames drop.</li>
  <li>Play fullscreen to avoid accidental browser gestures.</li>
</ul>

<h2>Next steps</h2>
<p>Read why <a href="/blog/play-3d-games-in-browser-no-download/">3D browser games need no
download</a>, then <a href="/">play on your phone</a>.</p>`,
  },
  {
    slug: 'play-3d-games-in-browser-no-download',
    title: 'Play 3D Games in Your Browser: No Download Needed',
    description:
      'How 3D games run in a web browser with WebGL2, which browsers and devices work, how to check your setup and what to do if a browser game runs slowly.',
    h1: 'How to Play 3D Games in Your Browser Without Downloading',
    teaser: 'WebGL2, browsers and performance',
    image: 'shadow-shift-mirror-portal',
    imageAlt: 'A glowing electric portal on a rooftop rendered in the browser',
    published: '2026-11-16',
    minutes: 5,
    related: ['play-parkour-games-on-mobile', 'what-is-an-endless-runner-game'],
    links: [['/about/', 'About Shadow Shift', 'how the game was built']],
    body: `
<p class="lead">Modern browsers can run real 3D games: no installer, no store, no account. Here is how
it works and how to get the best experience.</p>

<h2>How it works</h2>
<p>Browsers expose the graphics card through <strong>WebGL</strong>, a standard way for web pages to
draw 3D. WebGL2, supported by every current major browser, is enough for detailed scenes with lighting,
shaders and animated characters. The game is downloaded like a web page, so it starts in seconds.</p>

<h2>Which browsers work</h2>
<p>Current versions of Chrome, Edge, Firefox and Safari all support WebGL2, on desktop, Android and
iOS. <a href="/">Shadow Shift</a> supports all four.</p>

<h2>If it runs slowly</h2>
<ul>
  <li><strong>Hardware acceleration:</strong> make sure it is on in your browser settings.</li>
  <li><strong>Other tabs:</strong> close heavy tabs, especially other games and video.</li>
  <li><strong>Quality setting:</strong> lower it in the game's settings.</li>
  <li><strong>Laptop power:</strong> plug in, or choose a performance power mode.</li>
  <li><strong>Update:</strong> an up-to-date browser and graphics driver fix most problems.</li>
</ul>

<h2>Is it safe?</h2>
<p>Browser games run inside the browser's sandbox and cannot install anything on your device. Shadow
Shift has no accounts and no analytics; scores and settings stay in your browser (see the
<a href="/privacy-policy/">privacy policy</a>).</p>

<h2>Offline play</h2>
<p>Some browser games, including Shadow Shift, cache themselves after the first visit and keep working
without a connection.</p>

<h2>Next steps</h2>
<p>Playing on a phone? Read <a href="/blog/play-parkour-games-on-mobile/">how to play parkour games on
mobile</a>.</p>`,
  },
  {
    slug: 'handle-reversed-controls-in-games',
    title: 'How to Handle Reversed Controls in Games',
    description:
      'Reversed or mirrored controls trip up every player. Why they are so hard, and practical ways to stay alive while left is right and up is down.',
    h1: 'How to Handle Reversed Controls in Games',
    teaser: 'staying alive when left is right',
    image: 'shadow-shift-mirror-portal',
    imageAlt: 'The runner diving through a glowing blue mirror portal',
    published: '2026-11-16',
    minutes: 4,
    related: ['survive-low-visibility-in-games', 'avoid-obstacles-in-running-games'],
    links: [['/how-to-play/#portals', 'Shadow Shift portals', 'what the mirror portal does']],
    body: `
<p class="lead">Many games have a moment that swaps your controls: a curse, a status effect, a
portal. It feels impossible at first, because the problem is your habits, not your reactions.</p>

<h2>Why it is so hard</h2>
<p>With practice, controls become automatic: you see a gap and your thumb jumps before you think.
Reversed controls break that link. The automatic response is now wrong, and you have to override it on
every press.</p>

<h2>In Shadow Shift</h2>
<p>Running through a mirror portal in <a href="/">Shadow Shift</a> turns the runner around for 10
seconds and swaps every control: jump becomes slide and left becomes right.</p>

<h2>Five ways to cope</h2>
<ol>
  <li><strong>Think "opposite" first.</strong> Before every press, say the opposite word in your head.</li>
  <li><strong>Slow down your decisions.</strong> Decide earlier than usual to leave time for the
  translation.</li>
  <li><strong>Press less.</strong> Only act when you must. Fewer presses mean fewer mistakes.</li>
  <li><strong>Count it down.</strong> Effects like this are timed; knowing it lasts 10 seconds makes
  it easier to stay calm.</li>
  <li><strong>Practise on purpose.</strong> Treat the effect as a skill. After a few encounters the
  swap becomes its own habit.</li>
</ol>

<h2>Next steps</h2>
<p>The other portal brings darkness: read <a href="/blog/survive-low-visibility-in-games/">how to
survive low visibility in games</a>.</p>`,
  },
  {
    slug: 'survive-low-visibility-in-games',
    title: 'How to Survive Darkness and Low Visibility in Games',
    description:
      'Fog, darkness and low-visibility sections make games harder. How to read the few cues that stay visible and keep your timing when you cannot see far.',
    h1: 'How to Survive Darkness and Low Visibility in Games',
    teaser: 'reading the cues that stay visible',
    image: 'shadow-shift-darkness',
    imageAlt: 'The runner as a black silhouette in darkness with glowing route edges',
    published: '2026-11-16',
    minutes: 4,
    related: ['handle-reversed-controls-in-games', 'improve-timing-in-endless-runner-games'],
    links: [['/gameplay-tips/', 'Shadow Shift tips', 'surviving the darkness']],
    body: `
<p class="lead">Dark or foggy sections take away the thing runners depend on most: seeing ahead.
Surviving them is about knowing which cues remain and trusting them.</p>

<h2>Find the cues that stay lit</h2>
<p>Games rarely make the screen fully black; they keep a few cues visible so the section stays fair.
In <a href="/">Shadow Shift</a>, a black portal brings 8 seconds of darkness: buildings fade, fog
closes in and the runner turns black, but the neon edges of the route and the obstacle colours stay
lit. Follow those, not the buildings.</p>

<h2>Shorten your focus</h2>
<p>Normally you look far ahead. In the dark you cannot, so focus on the nearest visible cue and react
to it. Decisions come later, so make them simple.</p>

<h2>Trust the rhythm</h2>
<p>The route does not change because you cannot see it. Gaps arrive at the same rhythm as before, so
keep the jump timing you already have.</p>

<h2>Stay calm and count</h2>
<p>Low-visibility effects are usually short. Knowing the darkness ends in 8 seconds makes it easier to
take one obstacle at a time.</p>

<h2>Know the reward</h2>
<p>Some games reward surviving the dark. In Shadow Shift, getting through it earns 5 seconds of
auto-run, where the game plays for you.</p>

<h2>Next steps</h2>
<p>More strategies in the <a href="/gameplay-tips/">Shadow Shift gameplay tips</a>.</p>`,
  },
  {
    slug: 'beat-your-high-score-endless-runner',
    title: 'How to Beat Your High Score in Endless Runner Games',
    description:
      'Practical ways to beat your best run in endless runners: play for consistency, learn where you fall, warm up, rest, and handle the fast late game.',
    h1: 'How to Beat Your High Score in Endless Runner Games',
    teaser: 'consistency over risk',
    image: 'shadow-shift-jumping-gap',
    imageAlt: 'A runner jumping a gap between two rooftops at speed',
    published: '2026-11-16',
    minutes: 5,
    related: ['improve-timing-in-endless-runner-games', 'what-is-an-endless-runner-game'],
    links: [['/gameplay-tips/', 'Shadow Shift tips', 'game-specific strategies']],
    body: `
<p class="lead">Your high score is not beaten by one brilliant run. It is beaten by many runs that
avoid the same mistakes.</p>

<h2>Play for consistency, not records</h2>
<p>Chasing a record makes you tense and risky. Aim to play cleanly instead; long runs follow from
clean play.</p>

<h2>Find where you fall</h2>
<p>After each run, name what ended it: an early jump, a missed turn, a slide too soon. Most players
fall to the same two or three mistakes. Fix those first.</p>

<h2>Warm up</h2>
<p>Your first run is rarely your best. Treat the first two or three as warm-up and do not judge them.</p>

<h2>Prepare for the late game</h2>
<p>Runners speed up, so the late game is a different skill. In <a href="/">Shadow Shift</a> the run
reaches 19 metres per second; look further ahead and decide earlier as the speed rises.</p>

<h2>Take breaks</h2>
<p>After several short failed runs in a row, stop for a minute. Tired eyes react later, and frustration
leads to early presses.</p>

<h2>Use what the game gives you</h2>
<p>Learn every helper: Shadow Shift holds early turn presses on dead ends, lets you steer in mid-air,
and catches a ledge after a jump that only just falls short. Knowing these lets you play safer.</p>

<h2>Next steps</h2>
<p>Sharpen your <a href="/blog/improve-timing-in-endless-runner-games/">timing</a>, then
<a href="/">go for a new best</a>.</p>`,
  },
];
