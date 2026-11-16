// Blog articles for the static site (rendered by tools/build-pages.mjs). Each article must be
// genuinely useful on its own; claims about Shadow Shift must match the game's code.
// Fields: slug, title (<=60), description (<=160), h1, teaser (for related links), image
// (public/images/<name>.webp), imageAlt, published, updated?, minutes, related (article slugs),
// links ([href, label, why] to site pages), body (HTML).

export const ARTICLES = [
  {
    slug: 'beginners-guide-to-rooftop-parkour-games',
    title: "Beginner's Guide to Rooftop Parkour Games",
    description:
      'New to rooftop parkour games? How they work, the core moves, the mistakes beginners make and a practice plan to go from first fall to long runs.',
    h1: "A Beginner's Guide to Rooftop Parkour Games",
    teaser: 'how the genre works and where to start',
    image: 'shadow-shift-rooftop-run',
    imageAlt: 'A runner sprinting across a neon rooftop at night toward the next building',
    published: '2026-11-16',
    minutes: 6,
    related: ['improve-timing-in-endless-runner-games', 'parkour-movement-in-3d-games'],
    links: [['/how-to-play/', 'How to play Shadow Shift', 'controls and first steps']],
    body: `
<p class="lead">Rooftop parkour games put you on top of a city and ask one question again and again:
can you make the next jump? This guide explains how the genre works, which moves matter first and how
to practise so your runs get longer quickly.</p>

<h2>What is a rooftop parkour game?</h2>
<p>A rooftop parkour game is a movement game set on the roofs of buildings. The gaps between
buildings are the main challenge: misjudge one and you fall. Most games in the genre fall into two
groups:</p>
<ul>
  <li><strong>Free-roaming</strong> games let you choose your own path across the city, and are
  usually larger downloads for PC or console.</li>
  <li><strong>Runner</strong> games move you forward automatically. You only decide <em>when</em> to
  jump, slide and turn, which makes them quick to learn, ideal for short sessions and well suited to
  the browser and phones.</li>
</ul>
<p><a href="/">Shadow Shift</a> is a runner: the character sprints on their own and gets faster the
longer you survive, and your score is the distance you cover.</p>

<h2>The core moves</h2>
<p>Almost every rooftop game is built from the same handful of moves. Learn them in this order:</p>
<ol>
  <li><strong>Jump:</strong> crosses gaps and clears low obstacles. This is the move you will use most.</li>
  <li><strong>Slide:</strong> takes you under overhead obstacles such as pipes or beams.</li>
  <li><strong>Turn:</strong> follows the route when it changes direction at a corner.</li>
  <li><strong>Advanced moves:</strong> wall-runs across gaps too long to jump, climbs up taller
  buildings and vaults over waist-high objects.</li>
</ol>
<p>Do not try to master everything at once. Getting the jump right solves most early falls.</p>

<h2>The mistakes every beginner makes</h2>
<h3>Jumping too early</h3>
<p>The instinct is to jump as soon as you see a gap. In a well-designed game, a jump from the edge is the
strongest one, because you use the whole running surface. Early jumps are the number one reason for
falling short.</p>
<h3>Watching the runner instead of the route</h3>
<p>Your character is always in the same place on screen, so there is nothing to learn by looking at
them. Look ahead, to the next building and the next obstacle.</p>
<h3>Pressing twice</h3>
<p>When nervous, players tap a key twice. A second jump or a second turn can undo the first. One
deliberate press per decision is enough.</p>
<h3>Ignoring the signals</h3>
<p>Games use colour and shape to tell you what to do. In Shadow Shift, red obstacles are jumped and
pipes with cyan bands are slid under. Learn the signals and you stop thinking about each obstacle.</p>

<h2>A simple practice plan</h2>
<ol>
  <li><strong>Runs 1 to 5:</strong> only focus on jumping at the edge. Ignore the score.</li>
  <li><strong>Runs 6 to 10:</strong> add sliding. Say the action in your head as each obstacle appears.</li>
  <li><strong>After that:</strong> turn early at corners and try the special moves when they appear.</li>
</ol>
<p>Short sessions work better than long ones: ten focused minutes beat an hour of tired play.</p>

<h2>Why browser parkour games are a good place to start</h2>
<p>Browser games load in seconds and need no install, so a failed run costs you almost nothing. That
makes them ideal for learning by trying: you fall, you understand why, and you are running again a
moment later.</p>

<h2>Next steps</h2>
<p>Once the basics feel natural, read about <a href="/blog/improve-timing-in-endless-runner-games/">improving your timing</a>,
then try the moves yourself in <a href="/">Shadow Shift</a>.</p>`,
  },
  {
    slug: 'improve-timing-in-endless-runner-games',
    title: 'How to Improve Your Timing in Endless Runner Games',
    description:
      'Why runners get harder as they speed up, and practical drills to improve your timing: look ahead, use anchors, keep a rhythm and stay calm at speed.',
    h1: 'How to Improve Your Timing in Endless Runner Games',
    teaser: 'reaction, rhythm and reading ahead',
    image: 'shadow-shift-jumping-gap',
    imageAlt: 'A runner in mid-air over the gap between two buildings',
    published: '2026-11-16',
    minutes: 6,
    related: ['avoid-obstacles-in-running-games', 'beginners-guide-to-rooftop-parkour-games'],
    links: [['/gameplay-tips/', 'Shadow Shift gameplay tips', 'timing advice for this game']],
    body: `
<p class="lead">In an endless runner, almost every failure is a timing failure: the right move a
moment too early or too late. The good news is that timing is a skill you can train.</p>

<h2>Why runners get harder</h2>
<p>Endless runners speed up over time. The obstacles stay the same, but the time you have to react
shrinks. In <a href="/">Shadow Shift</a> the runner accelerates from 10 to 19 metres per second, so an
obstacle 20 metres away gives you two seconds at the start of a run and barely one second near top
speed. Good timing is mostly about winning back that lost time.</p>

<h2>1. Look further ahead</h2>
<p>The single biggest improvement is where you look. If your eyes are on the runner, every obstacle
arrives as a surprise. Look at the next building instead: you see obstacles earlier, so you decide
earlier, and the press itself becomes calm. As the speed rises, move your focus further ahead.</p>

<h2>2. Decide early, press on time</h2>
<p>Separate the decision from the action. Decide what to do the moment the obstacle appears, then
press when it reaches your trigger point. Players who decide late also press late.</p>

<h2>3. Use visual anchors</h2>
<p>An anchor is a fixed visual cue for when to press. For a gap, the edge of the building is the
anchor: press as it reaches the runner's feet. For a laser or pipe, pick a distance, such as the moment
the obstacle passes a point on the screen. Anchors turn timing from a guess into a habit.</p>

<h2>4. Know the game's helpers</h2>
<p>Many runners quietly help you. Common examples:</p>
<ul>
  <li><strong>Coyote time:</strong> a jump still works for a split second after you leave an edge.</li>
  <li><strong>Input buffering:</strong> a press made slightly early is remembered and performed at the
  right moment.</li>
  <li><strong>Held turns:</strong> in Shadow Shift a turn pressed early on a dead-end building is
  held until the corner.</li>
</ul>
<p>Knowing these tells you which way to err: when unsure, press slightly early rather than late.</p>

<h2>5. Find the rhythm</h2>
<p>Runners have a rhythm: run, jump, land, run. Tapping along, even mentally, helps you feel when the
next action is due. When the game speeds up, the rhythm gets faster but stays the same shape.</p>

<h2>6. Stay relaxed</h2>
<p>Tension makes you press early and twice. Relax your hands, breathe out on long straight sections,
and treat each obstacle as its own small task rather than thinking about your score.</p>

<h2>A ten-minute timing drill</h2>
<ol>
  <li>Play three runs focusing only on where you look: always the next building.</li>
  <li>Play three runs saying the action out loud ("jump", "slide") as each obstacle appears.</li>
  <li>Play three runs aiming for edge jumps: jump as late as you dare.</li>
</ol>
<p>Then play normally and compare your distance with your best.</p>

<h2>Next steps</h2>
<p>Timing gets you over obstacles; reading them gets you ready in time. Read
<a href="/blog/avoid-obstacles-in-running-games/">how to avoid obstacles in running games</a> next.</p>`,
  },
  {
    slug: 'parkour-movement-in-3d-games',
    title: 'Understanding Parkour Movement in 3D Games',
    description:
      'How 3D games turn parkour into play: jumps, slides, vaults, wall-runs and climbs, how momentum and animation sell them, and what makes movement feel fair.',
    h1: 'Understanding Parkour Movement in 3D Games',
    teaser: 'how real parkour becomes game moves',
    image: 'shadow-shift-wall-running',
    imageAlt: 'A runner running along a tall wall over a long gap between buildings',
    published: '2026-11-16',
    minutes: 7,
    related: ['beginners-guide-to-rooftop-parkour-games', 'avoid-obstacles-in-running-games'],
    links: [['/game-features/', 'Shadow Shift features', 'every move in the game']],
    body: `
<p class="lead">Real parkour is about moving through a space efficiently, using whatever is in the way.
Games borrow that idea and turn it into a small set of moves you can perform with a few buttons. Here
is how that translation works, and what separates movement that feels great from movement that feels
clumsy.</p>

<h2>From real parkour to game moves</h2>
<p>Traceurs (people who practise parkour) use dozens of techniques: precision jumps, vaults, wall-runs,
climb-ups, rolls. A game cannot give each one its own button, so it groups them into a few actions and
picks the right animation from context. Running into a waist-high object performs a vault; jumping
toward a wall performs a wall-run; hitting a tall face performs a climb.</p>

<h2>The standard move set</h2>
<h3>Jumps</h3>
<p>The foundation. In most games a jump has a fixed height and length, so players can learn exactly
what it clears.</p>
<h3>Slides</h3>
<p>A low move that takes you under obstacles while keeping your speed.</p>
<h3>Vaults</h3>
<p>Crossing a waist-high obstacle with your hands. Many games make vaults automatic so they never
interrupt the flow. In <a href="/">Shadow Shift</a>, rooftop AC units are vaulted automatically.</p>
<h3>Wall-runs</h3>
<p>Running along a vertical wall for a short distance, usually to cross a gap too long to jump. In
Shadow Shift you jump, then step toward the wall in mid-air; the runner holds their height along it and
kicks off onto the next building.</p>
<h3>Climbs</h3>
<p>Pulling up onto something taller. Games often trigger a climb when you run into a face that is
within reach, and treat taller faces as walls.</p>

<h2>Momentum: why movement feels heavy or light</h2>
<p>Good parkour movement respects momentum. Speed carries into jumps, landings absorb force, and
turns curve rather than snap. Shadow Shift, for example, carves a short arc into a turn instead of
rotating instantly, and the camera leans into it. Small details like this are what make movement feel
physical.</p>

<h2>Animation sells the move</h2>
<p>The same jump feels completely different depending on its animation. Anticipation before a jump,
a lean into speed and a compression on landing tell your eyes what the body is doing. Many games layer
procedural animation (lean, bank, head stabilisation) on top of recorded clips so the runner reacts to
every change in direction.</p>

<h2>What makes movement fair</h2>
<ul>
  <li><strong>Consistency:</strong> the same input always gives the same result.</li>
  <li><strong>Readability:</strong> you can tell what each obstacle asks for before you reach it.</li>
  <li><strong>Generous edges:</strong> small helpers such as a ledge catch after a jump that only
  just falls short.</li>
  <li><strong>Guaranteed solutions:</strong> in a generated world, every gap must be possible. Shadow
  Shift's route generator is tested so that a jump from any edge reaches the next building at every speed.</li>
</ul>

<h2>First-person versus third-person</h2>
<p>First-person parkour games feel immersive but make it hard to judge where your feet are.
Third-person games, including most runners, show the whole body, which makes distances and timing much
easier to read.</p>

<h2>Next steps</h2>
<p>See how these moves come together in <a href="/game-features/">Shadow Shift's features</a>, or
<a href="/">play</a> and try a wall-run yourself.</p>`,
  },
  {
    slug: 'avoid-obstacles-in-running-games',
    title: 'How to Avoid Obstacles in Running Games',
    description:
      'A practical method for avoiding obstacles in running games: read signals, decide early, use the right move, and recover after near misses at high speed.',
    h1: 'How to Avoid Obstacles in Running Games',
    teaser: 'reading hazards at speed',
    image: 'shadow-shift-laser-gate',
    imageAlt: 'A red laser gate stretched across a rooftop ahead of the runner',
    published: '2026-11-16',
    minutes: 6,
    related: ['improve-timing-in-endless-runner-games', 'parkour-movement-in-3d-games'],
    links: [['/how-to-play/#obstacles', 'Shadow Shift obstacles', 'what each one needs']],
    body: `
<p class="lead">Obstacles are what turn running into a game. Avoiding them is less about fast fingers
and more about reading early and choosing the right move. Here is a method that works in almost any
running game.</p>

<h2>Step 1: Learn the obstacle language</h2>
<p>Running games are designed to be readable. Each obstacle type has a look that tells you the
answer, usually through colour, height or shape:</p>
<ul>
  <li><strong>Low obstacles</strong> are jumped.</li>
  <li><strong>High obstacles</strong> with a gap underneath are slid under.</li>
  <li><strong>Obstacles in the middle</strong> often allow either.</li>
</ul>
<p>In <a href="/">Shadow Shift</a> the colour gives it away: red laser gates are jumped, pipe bundles
with cyan bands are slid under, and a single pipe with an amber valve can be either jumped or slid.
Once you know the language, you no longer study each obstacle; you just react to its colour.</p>

<h2>Step 2: Spot obstacles as early as possible</h2>
<p>Look ahead to the next building, not at your character. Good games help here: Shadow Shift raises
each building and its obstacles into place well ahead of you, so nothing appears at the last moment.
Use that time.</p>

<h2>Step 3: Decide, then wait</h2>
<p>Choose the move as soon as you see the obstacle, then wait for the right moment to press. The most
common mistake is pressing too early: a slide that starts too soon ends before the pipe, and a jump that
starts too soon comes down on the laser.</p>

<h2>Step 4: Match the timing to the move</h2>
<ul>
  <li><strong>Jumps</strong> peak in the middle, so start them a little before the obstacle.</li>
  <li><strong>Slides</strong> last a fixed time; start them just before the obstacle reaches you.</li>
  <li><strong>Automatic moves</strong> (such as vaults over rooftop units) need no input at all; do
  not press anything.</li>
</ul>

<h2>Step 5: Handle combinations</h2>
<p>Obstacles near a gap or a turn are harder because two decisions arrive together. Handle them in
order: what is closest first. If a jump leaves you in the air near a turn, many games, including Shadow
Shift, let you turn in mid-air.</p>

<h2>Step 6: Recover after a near miss</h2>
<p>A near miss is a good sign: your timing was close. Don't tense up. Breathe, look ahead again and
treat the next obstacle as new.</p>

<h2>Special hazards</h2>
<p>Many runners add hazards that change the rules for a while. Shadow Shift has two portals: a mirror
portal reverses your controls for 10 seconds, and a black portal brings 8 seconds of darkness where
only the glowing edges of the route are easy to see. The trick for both is the same: slow your thinking
down, follow what you can see, and press deliberately.</p>

<h2>Next steps</h2>
<p>Read the full <a href="/how-to-play/#obstacles">list of Shadow Shift obstacles</a>, sharpen your
<a href="/blog/improve-timing-in-endless-runner-games/">timing</a>, then <a href="/">put it into practice</a>.</p>`,
  },
];
