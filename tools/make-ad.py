"""Development-only: edits captured gameplay frames into a 10 s promo video (1280x720, 30 fps).

Input: a folder of frames f00000.jpg... captured one game frame at a time (tools/capture-ad.mjs)
and its log.json ([frame, score, phase, effect, move, sliding, grounded, mirrored, character]).
Shots are chosen from the log (a jump, a slide, a wall-run, the mirror portal, the darkness),
cut together with flash transitions and captions, between a title intro and an end card.

Usage: python tools/make-ad.py <frames-dir> <out.mp4>
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FRAMES, OUT = sys.argv[1], sys.argv[2]
FPS, W, H = 30, 1280, 720
URL = 'shadowshifter.wasmer.app'
CYAN, ORANGE, WHITE = (47, 216, 255), (255, 138, 42), (240, 248, 255)
FONTS = 'C:/Windows/Fonts/'
log = json.load(open(os.path.join(FRAMES, '..', 'log.json')))


def font(name, size):
    return ImageFont.truetype(FONTS + name, size)


TITLE = font('seguibl.ttf', 112)
CAPTION = font('bahnschrift.ttf', 64)
SMALL = font('bahnschrift.ttf', 30)


def frame(i):
    i = max(0, min(i, len(log) - 1))
    return Image.open(os.path.join(FRAMES, f'f{i:05d}.jpg')).convert('RGB').resize((W, H))


def first(cond, after=0):
    """First logged frame at or after `after` matching cond(row)."""
    for row in log[after:]:
        if cond(row):
            return row[0]
    return None


# ---------------------------------------------------------------- shot list (from the log)
jump = first(lambda r: r[6] == 0 and r[4] == 'none' and r[3] == 'none', 60)
slide = first(lambda r: r[5] == 1)
# In full light: a wall-run in the darkness is too dark to read on screen.
wall = first(lambda r: r[4] == 'wallrun' and r[3] == 'none')
mirror = first(lambda r: r[7] == 1)
dark = first(lambda r: r[3] == 'shadow')
# (start frame, length in output frames, speed, caption)
shots = [
    (jump - 10, 42, 1.2, 'LEAP THE GAPS'),
    (slide - 14, 40, 1.2, 'SLIDE UNDER'),
    (wall - 12, 44, 1.0, 'RUN THE WALLS'),
    (mirror - 20, 40, 1.2, 'BEND REALITY'),
    # Start on the black portal coming up, then plunge into the dark.
    (dark - 34, 44, 1.0, 'SURVIVE THE DARK'),
]
shots = [s for s in shots if s[0] is not None and s[0] >= 0]
print('shots', [(s[0], s[3]) for s in shots])


def text_center(d, y, txt, f, fill, shadow=True):
    w = d.textlength(txt, font=f)
    if shadow:
        d.text(((W - w) / 2 + 3, y + 4), txt, font=f, fill=(0, 0, 0, 160))
    d.text(((W - w) / 2, y), txt, font=f, fill=fill)


def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def caption(img, txt, t):
    """Lower-third caption sliding in from the left with a cyan accent bar."""
    o = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(o)
    x = -500 + 580 * ease(t * 3)
    y = H - 170
    tw = d.textlength(txt, font=CAPTION)
    d.rectangle([x - 20, y - 10, x + tw + 30, y + 78], fill=(3, 10, 22, 170))
    d.rectangle([x - 20, y - 10, x - 10, y + 78], fill=CYAN + (255,))
    d.text((x + 4, y + 3), txt, font=CAPTION, fill=(0, 0, 0, 150))
    d.text((x, y), txt, font=CAPTION, fill=WHITE + (255,))
    return Image.alpha_composite(img.convert('RGBA'), o).convert('RGB')


def punch(img, k):
    """Zoom punch: scale up by k and crop back to the frame (cut energy)."""
    if k <= 1.001:
        return img
    w, h = int(W * k), int(H * k)
    big = img.resize((w, h), Image.BICUBIC)
    return big.crop(((w - W) // 2, (h - H) // 2, (w - W) // 2 + W, (h - H) // 2 + H))


def flash(img, a):
    return Image.blend(img, Image.new('RGB', (W, H), (235, 248, 255)), a) if a > 0 else img


def grade(img):
    """Cinematic touch: slight contrast boost and a soft vignette."""
    a = np.asarray(img).astype(np.float32) / 255
    a = np.clip((a - 0.5) * 1.08 + 0.5, 0, 1)
    yy, xx = np.mgrid[0:H, 0:W]
    v = 1 - 0.35 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) ** 1.4
    a *= np.clip(v, 0.55, 1)[..., None]
    return Image.fromarray((a * 255).astype(np.uint8))


out = []

# ---------------------------------------------------------------- 1. title intro (48 frames)
src = first(lambda r: r[1] > 120) or 200
for k in range(48):
    t = k / 47
    bg = frame(src + int(k * 1.5)).filter(ImageFilter.GaussianBlur(6 * (1 - t) + 2))
    bg = Image.blend(bg, Image.new('RGB', (W, H), (2, 6, 16)), 0.45)
    o = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(o)
    s = ease(t * 2.2)
    f = font('seguibl.ttf', int(112 * (1.6 - 0.6 * s)))
    a = int(255 * min(1, t * 3))
    tw = d.textlength('SHADOW SHIFT', font=f)
    d.text(((W - tw) / 2 + 4, 250 + 5), 'SHADOW SHIFT', font=f, fill=(0, 0, 0, a // 2))
    d.text(((W - tw) / 2, 250), 'SHADOW SHIFT', font=f, fill=WHITE + (a,))
    # Cyan underline drawing itself in.
    lw = 520 * ease((t - 0.25) * 2.5)
    d.rectangle([W / 2 - lw / 2, 395, W / 2 + lw / 2, 401], fill=CYAN + (255,))
    if t > 0.45:
        sub = 'RUN.  LEAP.  SURVIVE THE DARK.'
        sa = int(255 * ease((t - 0.45) * 3))
        sw = d.textlength(sub, font=SMALL)
        d.text(((W - sw) / 2, 425), sub, font=SMALL, fill=CYAN + (sa,))
    img = Image.alpha_composite(bg.convert('RGBA'), o).convert('RGB')
    out.append(flash(img, max(0.0, 1 - k / 6)))

# ---------------------------------------------------------------- 2. gameplay montage
for start, n, speed, txt in shots:
    for k in range(n):
        img = grade(frame(start + int(k * speed)))
        img = caption(img, txt, k / n)
        img = punch(img, 1 + 0.08 * max(0.0, 1 - k / 5))  # zoom punch on each cut
        out.append(flash(img, max(0.0, 0.85 - k * 0.3)))  # white flash cut

# ---------------------------------------------------------------- 3. end card (to 300 frames)
last = shots[-1][0] + int(shots[-1][1] * shots[-1][2]) if shots else 0
n = 300 - len(out)
for k in range(n):
    t = k / max(1, n - 1)
    bg = frame(last + k).filter(ImageFilter.GaussianBlur(8))
    bg = Image.blend(bg, Image.new('RGB', (W, H), (2, 6, 16)), 0.6)
    o = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(o)
    a = int(255 * ease(t * 3))
    text_center(d, 200, 'SHADOW SHIFT', TITLE, WHITE + (a,))
    lw = 520 * ease(t * 3)
    d.rectangle([W / 2 - lw / 2, 345, W / 2 + lw / 2, 351], fill=CYAN + (a,))
    text_center(d, 380, 'PLAY FREE IN YOUR BROWSER', CAPTION, ORANGE + (a,))
    # URL pill, pulsing gently.
    pulse = 0.5 + 0.5 * np.sin(t * 12)
    uw = d.textlength(URL, font=SMALL)
    d.rounded_rectangle([(W - uw) / 2 - 28, 488, (W + uw) / 2 + 28, 540], radius=26,
                        outline=CYAN + (int(a * (0.6 + 0.4 * pulse)),), width=3,
                        fill=(3, 10, 22, int(a * 0.8)))
    d.text(((W - uw) / 2, 495), URL, font=SMALL, fill=WHITE + (a,))
    img = Image.alpha_composite(bg.convert('RGBA'), o).convert('RGB')
    out.append(flash(img, max(0.0, 0.85 - k * 0.3)))

# Fade the very end to black.
for k in range(8):
    out[-1 - k] = Image.blend(out[-1 - k], Image.new('RGB', (W, H)), (8 - k) / 8 * 0.9)

vw = cv2.VideoWriter(OUT, cv2.VideoWriter_fourcc(*'mp4v'), FPS, (W, H))
for img in out[:300]:
    vw.write(cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2BGR))
vw.release()
print('wrote', OUT, len(out[:300]), 'frames', f'{len(out[:300]) / FPS:.1f}s')
