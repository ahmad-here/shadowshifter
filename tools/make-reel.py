"""Development-only: directs portrait gameplay frames into a cinematic trailer for Reels/TikTok/Shorts.

Source: frames captured one game frame at a time by tools/capture-ad.mjs
(AD_SIZE=540x960x2 -> 1080x1920, 30 fps) and its log.json
([frame, score, phase, effect, move, sliding, grounded, mirrored, character]).
Every image is real Shadow Shift gameplay; "cutscenes" are slow, letterboxed camera moves on it.

Usage:
  python tools/make-reel.py <frames-dir> <out-prefix> [main|short]
main  -> <prefix>.mp4 (≈40 s, text + sound), <prefix>-clean.mp4 (no text), <prefix>-cover.jpg
short -> <prefix>-15s.mp4
Output: 1080x1920 H.264 (High, CRF 17) + AAC 192k, 30 fps (the source rate).
Needs: pip install pillow numpy imageio-ffmpeg
"""
import json
import os
import subprocess
import sys
import wave

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FRAMES, PREFIX = sys.argv[1], sys.argv[2]
MODE = sys.argv[3] if len(sys.argv) > 3 else 'main'
FPS, W, H = 30, 1080, 1920
BPM = 120
BEAT = FPS * 60 // BPM  # 15 frames
URL = 'shadowshifter.wasmer.app'
CYAN, ORANGE, WHITE = (47, 216, 255), (255, 138, 42), (240, 248, 255)
F = 'C:/Windows/Fonts/'
log = json.load(open(os.path.join(FRAMES, '..', 'log.json')))
N = len(log)
rng = np.random.default_rng(7)
FF = imageio_ffmpeg.get_ffmpeg_exe()


def font(name, size):
    return ImageFont.truetype(F + name, size)


TITLE = font('seguibl.ttf', 150)
BIG = font('seguibl.ttf', 120)
MID = font('bahnschrift.ttf', 64)
SMALL = font('bahnschrift.ttf', 46)

# ------------------------------------------------------------------ footage index
_cache = {}


def raw(i):
    i = int(max(0, min(i, N - 1)))
    if i not in _cache:
        if len(_cache) > 60:
            _cache.clear()
        im = Image.open(os.path.join(FRAMES, f'f{i:05d}.jpg')).convert('RGB')
        if im.size != (W, H):
            im = im.resize((W, H), Image.BICUBIC)
        _cache[i] = np.asarray(im).astype(np.float32)
    return _cache[i]


def at(t, blur=0.0):
    """Frame at fractional source time t; `blur` > 0 averages a short trail (motion blur)."""
    def one(t):
        a, f = int(np.floor(t)), t - np.floor(t)
        return raw(a) if f < 0.05 else raw(a) * (1 - f) + raw(a + 1) * f
    if blur <= 0:
        return one(t)
    return (one(t) * 2 + one(t - blur) + one(t - blur * 2)) / 4


def starts(cond, gap=40, after=0):
    """Frames where cond becomes true, at least `gap` apart."""
    out, prev, last = [], False, -999
    for r in log[after:]:
        c = cond(r)
        if c and not prev and r[0] - last >= gap:
            out.append(r[0])
            last = r[0]
        prev = c
    return out


light = lambda r: r[3] == 'none' and r[7] == 0
jumps = starts(lambda r: r[6] == 0 and r[4] == 'none' and light(r), 45, 60)
slides = starts(lambda r: r[5] == 1 and light(r))
walls = starts(lambda r: r[4] == 'wallrun' and light(r))
climbs = starts(lambda r: r[4] in ('climb', 'flip') and light(r))
vaults = starts(lambda r: r[4] == 'vault' and light(r))
landings = [r[0] for i, r in enumerate(log[1:], 1) if r[6] == 1 and log[i - 1][6] == 0]
mirror = (starts(lambda r: r[7] == 1) or [None])[0]
dark = (starts(lambda r: r[3] == 'shadow') or [None])[0]
print('jumps', jumps[:12], 'slides', slides, 'walls', walls, 'climbs', climbs, 'vaults', vaults,
      'mirror', mirror, 'dark', dark)


def pick(lst, i, fallback):
    return lst[i] if len(lst) > i else (lst[-1] if lst else fallback)


# ------------------------------------------------------------------ shot model
class Shot:
    """A piece of the timeline. src: source frame of the action; lead: frames before it."""

    def __init__(self, n, src, lead=0, speed=1.0, slow=None, z=(1.0, 1.0), c=(0.5, 0.5), box=0.0,
                 text=None, dim=0.0, blur=False, fade_in=0, fade_out=0, whip=False, shake=0,
                 fog=0.0, sfx=(), lights=None):
        self.__dict__.update(locals())
        del self.__dict__['self']

    def times(self):
        """Source time per output frame: base speed, slow-motion (`slow` factor) near the action."""
        ts, t = [], float(self.src - self.lead)
        for _ in range(self.n):
            ts.append(t)
            v = self.speed
            if self.slow and abs(t - self.src) < 10:
                v = self.slow
            t += v
        return ts


def text_fn(kind, *args):
    return (kind, args)


# ------------------------------------------------------------------ the edit
J = lambda i: pick(jumps, i, 120)
if MODE == 'main':
    tl = [
        # SCENE 1 – THE AWAKENING (0–5 s): black, then the city through fog, slow push-in.
        Shot(150, J(0) - 50, 0, speed=0.25, z=(1.35, 1.15), c=(0.5, 0.35), box=0.12, dim=0.55,
             fade_in=50, fog=0.55, text=text_fn('line', 'THE CITY NEVER SLEEPS.', 45, 140, 760),
             sfx=('drone', 'riser_long')),
        # SCENE 2 – ENTER SHADOW SHIFT (5–10 s): the runner, slow motion, title reveal.
        Shot(150, J(0), 40, speed=0.3, slow=0.18, z=(1.25, 1.05), c=(0.5, 0.62), box=0.1, dim=0.25,
             fog=0.25, text=text_fn('title', 20), sfx=('impact', 'sub')),
        # SCENE 3 – THE PARKOUR BEGINS (10–18 s).
        Shot(45, J(1), 30, speed=1.0, z=(1.02, 1.08), whip=True, blur=True,
             text=text_fn('word', 'RUN.'), sfx=('drop',)),
        Shot(60, J(2), 14, speed=1.0, slow=0.25, z=(1.05, 1.12), c=(0.5, 0.55),
             text=text_fn('word', 'JUMP.'), sfx=('whoosh',)),
        Shot(60, pick(walls, 0, J(3)), 12, speed=1.0, slow=0.45, z=(1.04, 1.1), whip=True,
             text=text_fn('word', 'DEFY THE LIMITS.'), sfx=('whoosh',)),
        Shot(45, pick(climbs, 0, J(4)), 12, speed=1.1, z=(1.05, 1.1), shake=6, sfx=('impact',)),
        Shot(30, pick(slides, 0, J(5)), 10, speed=1.2, blur=True, whip=True, sfx=('slide',)),
        # SCENE 4 – THE DANGER (18–25 s): obstacle close-up, faster cuts, one hero slow-mo.
        Shot(45, pick(slides, 1, J(6)), 40, speed=0.4, z=(1.5, 1.7), c=(0.5, 0.42), box=0.1,
             dim=0.1, sfx=('tension', 'mech')),
        Shot(15, J(6), 8, speed=1.3, blur=True, whip=True, shake=4, sfx=('laser',)),
        Shot(15, pick(vaults, 0, J(7)), 6, speed=1.3, blur=True, shake=4, sfx=('whoosh',)),
        Shot(15, J(8), 8, speed=1.3, blur=True, whip=True, shake=4, sfx=('laser',)),
        Shot(75, J(9), 16, speed=1.0, slow=0.15, z=(1.08, 1.2), c=(0.5, 0.55), sfx=('slowmo',)),
        Shot(60, J(9) + 60, 0, speed=0.0, dim=0.92, box=0.12,
             text=text_fn('line', 'ONE WRONG MOVE...', 5, 55, 860), sfx=('silence',)),
        # SCENE 5 – THE ACTION CLIMAX (25–34 s).
        Shot(45, mirror or J(10), 22, speed=1.0, slow=0.35, z=(1.0, 1.1), shake=8, sfx=('impact', 'drop')),
        Shot(60, (dark or J(11)) - 10, 26, speed=1.0, z=(1.04, 1.12), sfx=('impact', 'dark')),
        Shot(15, J(11), 8, speed=1.4, blur=True, whip=True, sfx=('whoosh',)),
        Shot(15, pick(walls, 1, J(12)), 8, speed=1.4, blur=True, sfx=('whoosh',)),
        Shot(15, J(12), 8, speed=1.4, blur=True, whip=True, sfx=('whoosh',)),
        Shot(15, pick(climbs, 1, J(13)), 8, speed=1.4, blur=True, shake=5, sfx=('impact',)),
        Shot(105, J(13), 12, speed=1.0, slow=0.2, z=(1.04, 1.14), c=(0.5, 0.55), sfx=('slowmo', 'land')),
        # SCENE 6 – THE FINAL REVEAL (34–40 s).
        Shot(45, J(14), 0, speed=0.35, z=(1.0, 1.18), box=0.12, dim=0.3, fog=0.35, fade_out=45),
        Shot(150, J(14) + 30, 0, speed=0.2, z=(1.2, 1.25), dim=0.82, fog=0.5, blur=False,
             text=text_fn('end'), sfx=('logo',)),
    ]
else:  # 15 s promotional cut
    tl = [
        Shot(45, J(0), 30, speed=0.35, slow=0.2, z=(1.2, 1.05), c=(0.5, 0.6), box=0.1, dim=0.3,
             fade_in=12, text=text_fn('title', 6), sfx=('impact', 'sub')),
        Shot(30, J(2), 12, speed=1.0, slow=0.3, z=(1.04, 1.1), whip=True, text=text_fn('word', 'JUMP.'), sfx=('drop',)),
        Shot(30, pick(walls, 0, J(3)), 10, speed=1.1, whip=True, text=text_fn('word', 'WALL-RUN.'), sfx=('whoosh',)),
        Shot(30, pick(slides, 0, J(4)), 12, speed=1.1, blur=True, text=text_fn('word', 'SLIDE.'), sfx=('slide',)),
        Shot(30, pick(climbs, 0, J(5)), 10, speed=1.1, shake=6, text=text_fn('word', 'CLIMB.'), sfx=('impact',)),
        Shot(30, mirror or J(6), 18, speed=1.0, shake=6, text=text_fn('word', 'BEND REALITY.'), sfx=('impact',)),
        Shot(45, (dark or J(7)) - 10, 22, speed=1.0, text=text_fn('word', 'SURVIVE THE DARK.'), sfx=('dark',)),
        Shot(15, J(9), 8, speed=1.4, blur=True, whip=True, sfx=('whoosh',)),
        Shot(15, J(10), 8, speed=1.4, blur=True, whip=True, sfx=('whoosh',)),
        Shot(180, J(11), 0, speed=0.2, z=(1.2, 1.25), dim=0.82, fog=0.5, text=text_fn('end'), sfx=('logo',)),
    ]
TOTAL = sum(s.n for s in tl)
print(MODE, 'frames', TOTAL, f'{TOTAL / FPS:.1f}s')

# ------------------------------------------------------------------ look
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIG = np.clip(1 - 0.4 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) ** 1.3, 0.5, 1)[..., None]
# Fog: a soft noise field, drifted per frame.
_fog = np.asarray(Image.fromarray((rng.random((60, 34)) * 255).astype(np.uint8)).resize((W, H * 2), Image.BICUBIC)
                  .filter(ImageFilter.GaussianBlur(60))).astype(np.float32)[..., None] / 255
FOG_TINT = np.array([40, 90, 140], np.float32)


def grade(a):
    """Cool shadows, warm highlights, lifted (not crushed) blacks, gentle contrast, vignette."""
    a = a / 255
    lum = a.mean(axis=2, keepdims=True)
    a = a + np.array([-0.025, 0.0, 0.045]) * (1 - lum) + np.array([0.035, 0.012, -0.02]) * lum
    a = np.clip((a - 0.5) * 1.1 + 0.5, 0, 1)
    a = 0.02 + a * 0.98  # lifted floor: dark scenes keep detail
    a = a * VIG
    # Bloom: blurred highlights added back.
    hi = np.clip(a - 0.7, 0, 1)
    small = Image.fromarray((hi * 255).astype(np.uint8)).resize((W // 8, H // 8), Image.BILINEAR)
    bloom = np.asarray(small.filter(ImageFilter.GaussianBlur(6)).resize((W, H), Image.BILINEAR)).astype(np.float32) / 255
    a = a + bloom * 0.6
    return np.clip(a * 255, 0, 255)


def grain(a, k):
    g = rng.normal(0, 4.5, (H // 3, W // 3, 1)).astype(np.float32).repeat(3, 0).repeat(3, 1)
    return a + g


def zoom(a, k, cx, cy, dx=0.0, dy=0.0):
    if k <= 1.002 and not dx and not dy:
        return a
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    w, h = int(W * k), int(H * k)
    big = img.resize((w, h), Image.BICUBIC) if k > 1.002 else img
    x = int(np.clip((w - W) * cx + dx, 0, w - W))
    y = int(np.clip((h - H) * cy + dy, 0, h - H))
    return np.asarray(big.crop((x, y, x + W, y + H))).astype(np.float32)


def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def draw_text(arr, spec, k, n):
    kind, args = spec
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert('RGBA')
    o = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(o)

    def centered(y, txt, f, col, al, track=0):
        w = sum(d.textlength(ch, font=f) for ch in txt) + track * (len(txt) - 1)
        if w > W - 140:  # shrink to fit inside the side margins
            k = (W - 140) / w
            f = ImageFont.truetype(f.path, int(f.size * k))
            track = int(track * k)
            w = sum(d.textlength(ch, font=f) for ch in txt) + track * (len(txt) - 1)
        x = (W - w) / 2
        for ch in txt:
            d.text((x + 3, y + 5), ch, font=f, fill=(0, 0, 0, int(al * 0.5)))
            d.text((x, y), ch, font=f, fill=col + (int(al),))
            x += d.textlength(ch, font=f) + track

    if kind == 'line':  # elegant tracked line, fades in and out
        txt, a0, a1, y = args
        t = (k - a0) / max(1, a1 - a0)
        if 0 <= t <= 1.2:
            al = 255 * min(smooth(t * 3), smooth((1.2 - t) * 4))
            centered(y, txt, MID, WHITE, al, track=int(18 - 8 * smooth(t)))
    elif kind == 'title':  # SHADOW / SHIFT: tracking closes in, orange rule draws, tagline
        (a0,) = args
        t = (k - a0) / max(1, n - a0)
        if t >= 0:
            al = 255 * min(ease(t * 2.5), smooth((1 - t) * 8))
            tr = int(60 * (1 - ease(t * 1.6))) + 10
            centered(720, 'SHADOW', TITLE, WHITE, al, tr)
            centered(880, 'SHIFT', TITLE, CYAN, al, tr)
            lw = 600 * ease((t - 0.2) * 2.5)
            d.rectangle([W / 2 - lw / 2, 1068, W / 2 + lw / 2, 1076], fill=ORANGE + (int(al),))
            if t > 0.4:
                centered(1110, '3D ROOFTOP PARKOUR', SMALL, WHITE, al * ease((t - 0.4) * 3), 8)
    elif kind == 'word':  # short punchy word, upper safe zone
        (txt,) = args
        t = k / n
        al = 255 * min(ease(t * 6), smooth((1 - t) * 6))
        centered(300 - 30 * (1 - ease(t * 4)), txt, BIG, WHITE, al, 8)
    elif kind == 'end':
        t = k / max(1, n - 1)
        al = 255 * ease(t * 2.5)
        tr = int(40 * (1 - ease(t * 2))) + 10
        centered(600, 'SHADOW', TITLE, WHITE, al, tr)
        centered(760, 'SHIFT', TITLE, CYAN, al, tr)
        lw = 600 * ease(t * 2.5)
        d.rectangle([W / 2 - lw / 2, 948, W / 2 + lw / 2, 956], fill=ORANGE + (int(al),))
        a2 = 255 * ease((t - 0.15) * 3)
        centered(990, 'RUN. JUMP. SURVIVE.', MID, WHITE, a2, 10)
        a3 = 255 * ease((t - 0.3) * 3)
        uw = d.textlength(URL, font=SMALL)
        pulse = 0.65 + 0.35 * np.sin(k * 0.25)
        d.rounded_rectangle([(W - uw) / 2 - 40, 1150, (W + uw) / 2 + 40, 1236], radius=43,
                            outline=CYAN + (int(a3 * pulse),), width=4, fill=(3, 10, 22, int(a3 * 0.85)))
        d.text(((W - uw) / 2, 1168), URL, font=SMALL, fill=WHITE + (int(a3),))
        centered(1290, 'PLAY FREE. NO DOWNLOAD.', SMALL, ORANGE, a3, 6)
    return np.asarray(Image.alpha_composite(img, o).convert('RGB')).astype(np.float32)


# ------------------------------------------------------------------ render (parallel, one shot per worker)
def encoder(path):
    """GPU (NVENC) H.264, quality-targeted with a bitrate cap. REEL_CPU=1 uses x264 instead."""
    args = [FF, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
            '-r', str(FPS), '-i', '-']
    if os.environ.get('REEL_CPU'):
        args += ['-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-maxrate', '20M', '-bufsize', '40M', '-threads', '2']
    else:
        args += ['-c:v', 'h264_nvenc', '-preset', 'p6', '-tune', 'hq', '-rc', 'vbr', '-cq', '21', '-b:v', '0',
                 '-maxrate', '20M', '-bufsize', '40M']
    return subprocess.Popen(args + ['-pix_fmt', 'yuv420p', '-profile:v', 'high', path], stdin=subprocess.PIPE)


STARTS = np.cumsum([0] + [s.n for s in tl]).tolist()


def look(s, si, k, t):
    """The clean (text-free) graded frame k of shot s. Deterministic per frame."""
    global rng
    rng = np.random.default_rng(si * 100003 + k)
    u = k / max(1, s.n - 1)
    fast = s.blur and s.speed > 1.05
    a = grade(at(t, 0.5 if fast else 0))
    if s.fog:
        off = int((STARTS[si] + k) * 3) % H
        f = _fog[off:off + H]
        a = a * (1 - s.fog * f * 0.8) + FOG_TINT * s.fog * f * 0.8
    z = s.z[0] + (s.z[1] - s.z[0]) * smooth(u)
    dx = dy = 0.0
    if s.shake and k < 10:
        amp = s.shake * (1 - k / 10) * 3
        dx, dy = rng.normal(0, amp), rng.normal(0, amp)
        z = max(z, 1.03)
    if s.whip and k < 6:  # whip-in: directional smear settling into the shot
        sh = int((6 - k) * 70)
        a = (a + np.roll(a, sh, 1) + np.roll(a, sh // 2, 1)) / 3
    a = zoom(a, z, s.c[0], s.c[1], dx, dy)
    if s.dim:
        a = a * (1 - s.dim)
    if s.fade_in and k < s.fade_in:
        a = a * smooth(k / s.fade_in)
    if s.fade_out and k >= s.n - s.fade_out:
        a = a * smooth((s.n - k) / s.fade_out)
    if si > 0 and k < 2 and not s.fade_in and s.dim < 0.5:  # soft impact flash on the cut
        a = a + (255 - a) * (0.22 if k == 0 else 0.08)
    if s.box:  # cinematic letterbox, eased in
        bh = int(H * s.box * min(1.0, ease(k / 12) if si else 1))
        a[:bh] = 0
        a[H - bh:] = 0
    return np.clip(grain(a, k), 0, 255)


def render_shot(si):
    s = tl[si]
    clean = encoder(f'{PREFIX}.seg{si:02d}.clean.mp4') if MODE == 'main' else None
    text = encoder(f'{PREFIX}.seg{si:02d}.mp4')
    for k, t in enumerate(s.times()):
        a = look(s, si, k, t)
        if clean:
            clean.stdin.write(a.astype(np.uint8).tobytes())
        txt = draw_text(a, s.text, k, s.n) if s.text else a
        text.stdin.write(np.clip(txt, 0, 255).astype(np.uint8).tobytes())
    for e in (clean, text):
        if e:
            e.stdin.close()
            e.wait()
    return si


def concat(paths, out):
    lst = out + '.txt'
    with open(lst, 'w') as f:
        for q in paths:
            f.write("file '" + os.path.abspath(q).replace(chr(92), '/') + "'" + chr(10))
    subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', out],
                   check=True)
    os.remove(lst)
    for q in paths:
        os.remove(q)


def build_events():
    ev = []
    for si, s in enumerate(tl):
        ts = s.times()
        ev += [(STARTS[si] / FPS, sf) for sf in s.sfx]
        for k, t in enumerate(ts):
            if int(t) in landings and (k == 0 or int(ts[k - 1]) != int(t)):
                ev.append(((STARTS[si] + k) / FPS, 'step'))
    return ev


# ------------------------------------------------------------------ soundtrack (synthesized, royalty-free)
def soundtrack(events, wav):
    global rng
    rng = np.random.default_rng(11)
    SR = 44100
    dur = TOTAL / FPS
    tt = np.arange(int(SR * dur)) / SR
    mix = np.zeros_like(tt)
    beat = 60 / BPM


    def env(n, a, d):
        x = np.arange(n) / SR
        return np.minimum(1, x / a) * np.exp(-x / d)


    def place(sig, t, g=1.0):
        i = int(t * SR)
        j = min(len(mix), i + len(sig))
        if 0 <= i < len(mix):
            mix[i:j] += sig[: j - i] * g


    def noise(n):
        return rng.normal(0, 1, n)


    def lowpass(x, k):
        return np.convolve(x, np.ones(k) / k, mode='same')


    kn = int(0.4 * SR)
    kx = np.arange(kn) / SR
    KICK = np.sin(2 * np.pi * (42 + 120 * np.exp(-kx * 28)) * kx) * env(kn, 0.002, 0.13)
    SNARE = lowpass(noise(int(0.22 * SR)), 3) * env(int(0.22 * SR), 0.001, 0.07)
    HAT = noise(int(0.05 * SR)) * env(int(0.05 * SR), 0.001, 0.01)
    wn = int(0.45 * SR)
    wx = np.arange(wn) / SR
    WHOOSH = lowpass(noise(wn), 6) * np.sin(np.pi * wx / 0.45) ** 2
    IMPACT = (np.sin(2 * np.pi * 50 * np.arange(SR) / SR) * env(SR, 0.003, 0.35)
              + lowpass(noise(SR), 4) * env(SR, 0.001, 0.08) * 0.6)
    STEP = lowpass(noise(int(0.08 * SR)), 12) * env(int(0.08 * SR), 0.001, 0.02)
    ln = int(0.35 * SR)
    lx = np.arange(ln) / SR
    LASER = np.sin(2 * np.pi * (1800 * np.exp(-lx * 8) + 300) * lx) * env(ln, 0.002, 0.12)
    MECH = sum(np.sin(2 * np.pi * f * np.arange(int(1.2 * SR)) / SR) for f in (73, 146, 219)) * env(int(1.2 * SR), 0.05, 0.5) * \
        (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 9 * np.arange(int(1.2 * SR)) / SR)))

    drop_t = next((t for t, e in events if e == 'drop'), 0)
    silence = [t for t, e in events if e == 'silence']
    logo_t = next((t for t, e in events if e == 'logo'), dur - 5)

    # Ambience: dark drone (A minor) throughout, swelling at the end.
    for f, g in ((55, 0.06), (110, 0.05), (130.81, 0.035), (164.81, 0.03)):
        mix += g * np.sin(2 * np.pi * f * tt + 0.6 * np.sin(2 * np.pi * 0.13 * tt)) * np.minimum(1, tt / 3)
    # City ambience: filtered noise bed.
    mix += lowpass(noise(len(tt)), 40) * 0.05 * np.minimum(1, tt / 2)
    # Riser into the drop.
    if drop_t > 1:
        n = int(drop_t * SR)
        x = np.arange(n) / SR
        rise = lowpass(noise(n), 3) * (x / drop_t) ** 3 * 0.35
        place(rise, 0)
    # Beat: from the drop to the logo, muted during the "ONE WRONG MOVE" pause.
    t, b = drop_t, 0
    while t < logo_t - 0.05:
        quiet = any(s <= t < s + 2.0 for s in silence)
        if not quiet:
            place(KICK, t, 0.85)
            place(HAT, t + beat / 2, 0.15)
            if b % 2:
                place(SNARE, t, 0.38)
            if b % 4 == 3:
                place(HAT, t + beat * 0.75, 0.1)
            bn = int(beat * SR)
            bx = np.arange(bn) / SR
            fq = (55, 55, 65.41, 49)[(b // 4) % 4]
            place(lowpass(np.sign(np.sin(2 * np.pi * fq * bx)), 20) * env(bn, 0.004, 0.22), t, 0.32)
            # Arp line an octave up: synthwave pulse.
            for q in range(4):
                an = int(beat / 4 * SR)
                ax = np.arange(an) / SR
                af = fq * (4, 6, 8, 6)[q]
                place(np.sin(2 * np.pi * af * ax) * env(an, 0.002, 0.06), t + q * beat / 4, 0.05)
        t += beat
        b += 1
    # Event sound effects.
    for t, e in events:
        if e == 'impact':
            place(IMPACT, t, 0.7)
        elif e == 'sub':
            place(np.sin(2 * np.pi * 36 * np.arange(2 * SR) / SR) * env(2 * SR, 0.01, 0.9), t, 0.8)
        elif e == 'drop':
            place(IMPACT, t, 0.9)
        elif e in ('whoosh', 'slide'):
            place(WHOOSH, max(0, t - 0.3), 0.35)
        elif e == 'laser':
            place(LASER, t, 0.25)
        elif e == 'mech':
            place(MECH, t, 0.12)
        elif e == 'tension':
            n = int(1.5 * SR)
            x = np.arange(n) / SR
            place(np.sin(2 * np.pi * (220 + 220 * x / 1.5) * x) * 0.08 * x / 1.5, t)
        elif e == 'slowmo':  # reversed whoosh into slow motion
            place(WHOOSH[::-1], t, 0.4)
        elif e == 'step':
            place(STEP, t, 0.3)
        elif e == 'land':
            place(IMPACT, t + 1.0, 0.5)
        elif e == 'dark':
            place(np.sin(2 * np.pi * 30 * np.arange(3 * SR) / SR) * env(3 * SR, 0.05, 1.2), t, 0.5)
        elif e == 'logo':
            place(IMPACT, t + 0.1, 1.0)
            place(np.sin(2 * np.pi * 32 * np.arange(4 * SR) / SR) * env(4 * SR, 0.01, 1.6), t + 0.1, 0.9)
    mix *= np.minimum(1, (dur - tt) / 0.8)
    peak = np.max(np.abs(mix)) or 1
    mix = np.tanh(mix / peak * 1.6) * 0.89  # soft limit, peaks ≈ -1 dBFS: no clipping
    pcm = (np.repeat(mix[:, None], 2, 1) * 32767).astype(np.int16)
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == '__main__':
    from multiprocessing import Pool

    with Pool(min(12, os.cpu_count() or 4)) as pool:
        for si in pool.imap_unordered(render_shot, range(len(tl))):
            print('shot', si, 'done', flush=True)
    name = PREFIX + ('' if MODE == 'main' else '-15s')
    wav = PREFIX + '.wav'
    soundtrack(build_events(), wav)
    variants = [('', name)] + ([('.clean', PREFIX + '-clean')] if MODE == 'main' else [])
    for tag, out in variants:
        concat([f'{PREFIX}.seg{si:02d}{tag}.mp4' for si in range(len(tl))], out + '.video.mp4')
        subprocess.run([FF, '-y', '-loglevel', 'error', '-i', out + '.video.mp4', '-i', wav, '-c:v', 'copy',
                        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', out + '.mp4'],
                       check=True)
        os.remove(out + '.video.mp4')
        print('wrote', out + '.mp4')
    os.remove(wav)
    if MODE == 'main':  # cover: the wall-run shot, mid-move, with the title
        si = next(i for i, s in enumerate(tl) if s.text and s.text[1] == ('DEFY THE LIMITS.',))
        s = tl[si]
        k = s.n // 2
        a = look(s, si, k, s.times()[k]) * 0.8
        img = draw_text(a, ('title', (0,)), 40, 41)
        Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(PREFIX + '-cover.jpg', quality=94)
        print('wrote', PREFIX + '-cover.jpg')
