#!/usr/bin/env python3
"""Rebuilds public/emotes/*.webp from Google's Noto Animated Emoji (CC BY 4.0, https://googlefonts.github.io/noto-emoji-animation/).
The originals are 512 px and 250-600 KB each; the table shows them at about 56 px, so each is downscaled to 96 px, thinned to
about 10 fps and re-encoded lossy (roughly 20-70 KB). Needs Pillow:  python3 -m venv v && v/bin/pip install pillow && v/bin/python scripts/make-emotes.py
Keep the key -> codepoint map in step with src/engine/reactions.js (tests/engine/reactions.test.mjs checks every file exists)."""
import io, sys, urllib.request
from pathlib import Path
from PIL import Image

EMOTES = {  # key: Unicode codepoint (hex)
    'gg': '1f91d', 'clap': '1f44f', 'wow': '1f92f', 'lol': '1f602', 'gasp': '1f631', 'think': '1f9d0',
    'hurry': '23f0', 'fire': '1f525', 'salute': '1fae1', 'cry': '1f62d', 'trophy': '1f3c6', 'evil': '1f608',
    'popcorn': '1f37f', 'party': '1f973', 'oops': '1fae0',
}
SIZE, QUALITY = 96, 40
out = Path(__file__).resolve().parent.parent / 'public' / 'emotes'
out.mkdir(parents=True, exist_ok=True)
for key, cp in EMOTES.items():
    data = urllib.request.urlopen(f'https://fonts.gstatic.com/s/e/notoemoji/latest/{cp}/512.webp', timeout=30).read()
    im = Image.open(io.BytesIO(data))
    keep = 3 if im.n_frames <= 36 else 4  # keep every 3rd (long ones: 4th) frame
    frames, durs, acc = [], [], 0
    for i in range(im.n_frames):
        im.seek(i)
        acc += im.info.get('duration', 33) or 33
        if i % keep == 0:
            frames.append(im.convert('RGBA').resize((SIZE, SIZE), Image.LANCZOS))
            durs.append(acc)
            acc = 0
    frames[0].save(out / f'{key}.webp', save_all=True, append_images=frames[1:], duration=durs, loop=0,
                   quality=QUALITY, method=4, lossless=False, minimize_size=True)
    print(f'{key:9} {cp:6} {len(frames):3} frames {(out / f"{key}.webp").stat().st_size / 1024:6.1f} KB')
