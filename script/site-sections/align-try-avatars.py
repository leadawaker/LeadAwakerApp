#!/usr/bin/env python3
"""Cuts the #try-sara avatars so every phone screen lands on the same spot.

The avatars (uploads/demo-avatars/*.png) are generated one by one, so the phone
sits a little differently in each. This finds the black screen in every picture,
straightens it and warps the picture (a few percent at most) until the screen is
exactly SCREEN inside a CANVAS-sized cut, then writes
client/public/site/img/try-avatar-<key>.webp. The .ts-screen overlay in
try-sara.html is placed on SCREEN, so a new avatar only needs a line in AVATARS.

The cut is taller than the renders: the wall above each head is grown upwards
(see extend_top), so the page can show the whole avatar small, with room above
it, and never needs to fade the top of the picture out.

The "ready" picture (one hand, close-up) keeps its own screen position. The
script prints both sets of --sx/--sy/--sw/--sh as they stand in try-sara.html.

Usage: python3 script/site-sections/align-try-avatars.py [--check]
  --check  measure and report only, write nothing
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
SRC = os.path.join(ROOT, "uploads/demo-avatars")
OUT = os.path.join(ROOT, "client/public/site/img")

CANVAS = (1065, 1238)
# x, y, w, h of the black glass inside CANVAS. x leaves the hand clear of the page's fade on the left edge.
SCREEN = (150, 535, 304, 606)

AVATARS = {
    "builder": "file_00000000b88c82108b751ebc9b678a81.png",
    "salon": "file_0000000015e081f4b39a9131d34e44e4.png",
    "car": "file_00000000fa0481f4863e081a22c32d04.png",
    "doctor": "file_000000005c5881f49ea9290577e30934.png",
    "events": "file_00000000b64c81f49627a8ba38d260ae.png",
    "gym": "file_000000002e788210a4b2ecabf7e45c60.png",
    "hotel": "file_000000002ee881f8b965f46be56059f4.png",
    "lawyer": "file_00000000df3881f4ad742acd88a57314.png",
}
# Patches painted over in the cut picture (x, y, w, h inside CANVAS), in the colour around them.
COVER = {
    "car": [(926, 1169, 48, 40)],  # a real car maker's emblem on the name badge
}
READY = "homepage images/file_00000000a63481f4b7d4c9fcdf82dacc.png"

BEZEL = 6  # px of black glass left visible around the overlay
READY_SCREEN_H = 0.536  # height of the phone glass in the "ready" picture, as a share of the cut

# How far a picture may be off before it is reported as "really not aligned".
MAX_TILT = 1.5      # degrees
MAX_STRETCH = 0.04  # difference between the x and y scale
MAX_SCALE = 0.12    # distance of either scale from 1


def find_screen(img):
    """The black glass of the phone: x0, y0, x1, y1 and its lean in degrees."""
    px = np.asarray(img.convert("RGB")).astype(int)
    dark = px.max(axis=2) < 30
    h, w = dark.shape
    # Seed: the leftmost 160x360 window that is black all over (hair and jackets are never that even).
    ii = np.zeros((h + 1, w + 1), dtype=np.int64)
    ii[1:, 1:] = dark.cumsum(0).cumsum(1)
    ww, hh = 160, 360
    full = ii[hh:, ww:] - ii[:-hh, ww:] - ii[hh:, :-ww] + ii[:-hh, :-ww]
    ys, xs = np.where(full >= ww * hh * 0.995)
    if not len(xs):
        raise ValueError("no black phone screen found")
    k = np.argmin(xs)
    seed = (int(xs[k] + ww // 2), int(np.median(ys[xs == xs[k]]) + hh // 2))
    mask = Image.fromarray((dark * 255).astype("uint8")).copy()
    ImageDraw.floodfill(mask, seed, 128)
    glass = np.asarray(mask) == 128
    rows = np.where(glass.sum(axis=1) > 100)[0]
    cols = np.where(glass.sum(axis=0) > 200)[0]
    x0, x1, y0, y1 = cols[0], cols[-1] + 1, rows[0], rows[-1] + 1

    ys_mid = np.arange(int(y0 + (y1 - y0) * 0.2), int(y0 + (y1 - y0) * 0.8), 4)
    edges = np.array([[np.where(glass[y])[0][0], np.where(glass[y])[0][-1] + 1] for y in ys_mid], float)

    def slope(v):  # line fit that ignores the rows where a finger covers the edge
        a_mat = np.vstack([ys_mid, np.ones(len(ys_mid))]).T
        keep = np.ones(len(v), bool)
        for _ in range(3):
            a, b = np.linalg.lstsq(a_mat[keep], v[keep], rcond=None)[0]
            res = np.abs(v - (a * ys_mid + b))
            keep = res <= max(1.5, np.percentile(res[keep], 80))
        return a

    tilt = float(np.degrees(np.arctan((slope(edges[:, 0]) + slope(edges[:, 1])) / 2)))
    return int(x0), int(y0), int(x1), int(y1), tilt


def straighten(img):
    x0, y0, x1, y1, tilt = find_screen(img)
    if abs(tilt) < 0.1:
        return img, (x0, y0, x1, y1), tilt
    # Turned on a copy with its edges repeated outwards, so the corners do not come back empty.
    pad = 32
    big = Image.fromarray(np.pad(np.asarray(img), ((pad, pad), (pad, pad), (0, 0)), mode="edge"))
    best = None
    for angle in (tilt, -tilt):
        turned = big.rotate(angle, resample=Image.BICUBIC, center=((x0 + x1) / 2 + pad, (y0 + y1) / 2 + pad))
        turned = turned.crop((pad, pad, pad + img.width, pad + img.height))
        m = find_screen(turned)
        if best is None or abs(m[4]) < abs(best[1][4]):
            best = (turned, m)
    return best[0], best[1][:4], tilt


def cut_avatar(key, name, write):
    img = Image.open(os.path.join(SRC, name)).convert("RGB")
    img, (x0, y0, x1, y1), tilt = straighten(img)
    cw, ch = CANVAS
    tx, ty, tw, th = SCREEN
    sx, sy = tw / (x1 - x0), th / (y1 - y0)
    # Canvas pixel (X, Y) reads source pixel (x0 + (X - tx) / sx, y0 + (Y - ty) / sy).
    left, top = x0 - tx / sx, y0 - ty / sy
    right, bottom = left + cw / sx, top + ch / sy
    grow = max(0, int(np.ceil(-top)) + 2)  # rows of wall to build above the render
    problems = []
    if left < 0 or right > img.width or bottom > img.height:
        problems.append("the picture does not cover the cut (phone too close to an edge)")
    if abs(tilt) > MAX_TILT:
        problems.append("phone leans %.1f degrees" % tilt)
    if abs(sx - sy) > MAX_STRETCH:
        problems.append("phone has a different shape (stretch %.1f%%)" % (abs(sx - sy) * 100))
    if max(abs(sx - 1), abs(sy - 1)) > MAX_SCALE:
        problems.append("phone is a different size (scale %.2f)" % max(sx, sy, key=lambda s: abs(s - 1)))
    print("%-8s lean %+.2f deg | scale x %.3f y %.3f | wall built above %3d px | %s"
          % (key, tilt, sx, sy, grow, "; ".join(problems) or "ok"))
    if write and not problems:
        img = extend_top(img, grow)
        out = img.transform(CANVAS, Image.AFFINE, (1 / sx, 0, left, 0, 1 / sy, top + grow), resample=Image.BICUBIC)
        for box in COVER.get(key, []):
            out = cover(out, box)
        out.save(os.path.join(OUT, "try-avatar-%s.webp" % key), "WEBP", quality=84, method=6)
    return not problems


def cover(out, box):
    """Paints a small patch in the median colour of the ring around it, with a soft edge."""
    x, y, w, h = box
    px = np.asarray(out).astype(float)
    ring = np.concatenate([px[y - 4:y, x:x + w].reshape(-1, 3), px[y + h:y + h + 4, x:x + w].reshape(-1, 3),
                           px[y:y + h, x - 4:x].reshape(-1, 3), px[y:y + h, x + w:x + w + 4].reshape(-1, 3)])
    colour = np.median(ring, axis=0)
    yy, xx = np.mgrid[0:px.shape[0], 0:px.shape[1]]
    dist = np.minimum.reduce([xx - x, x + w - 1 - xx, yy - y, y + h - 1 - yy])  # depth inside the box
    alpha = np.clip(dist / 4, 0, 1)[:, :, None]
    return Image.fromarray((px * (1 - alpha) + colour * alpha).round().astype("uint8"))


def extend_top(img, rows):
    """Grows the picture upwards by `rows`: its top row carried up and blurred sideways more and more,
    until it is one flat colour. Every render has plain backdrop above the hair, so this reads as more wall.
    Where hair touches the top of a render, it tapers off within a few rows instead of streaking up."""
    if rows <= 0:
        return img
    px = np.asarray(img).astype(float)
    edge = px[:3].mean(axis=0)
    # the wall alone: a wide running median drops anything narrow, such as the tip of a ponytail
    half = 150
    windows = np.lib.stride_tricks.sliding_window_view(np.pad(edge, ((half, half), (0, 0)), mode="reflect"),
                                                       2 * half + 1, axis=0)
    wall_row = np.median(windows, axis=-1)

    def blurred(row, sigma):
        r = int(sigma * 3)
        k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
        padded = np.pad(row, ((r, r), (0, 0)), mode="reflect")
        return np.stack([np.convolve(padded[:, c], k / k.sum(), mode="valid") for c in range(3)], axis=1)

    # (distance above the render, what the row looks like there)
    stops = [(0, edge), (8, blurred(edge, 4)), (30, blurred(wall_row, 16)), (90, blurred(wall_row, 48)),
             (180, blurred(wall_row, 140)), (320, np.broadcast_to(wall_row.mean(axis=0), edge.shape))]
    wall = np.empty((rows,) + edge.shape)
    for i in range(rows):
        d = rows - i
        for (d0, a), (d1, b) in zip(stops, stops[1:]):
            if d <= d1:
                t = (d - d0) / (d1 - d0)
                t = t * t * (3 - 2 * t)
                wall[i] = a * (1 - t) + b * t
                break
        else:
            wall[i] = stops[-1][1]
    return Image.fromarray(np.concatenate([wall, px]).round().clip(0, 255).astype("uint8"))


def cut_ready(write):
    img = Image.open(os.path.join(SRC, READY)).convert("RGB")
    img, (x0, y0, x1, y1), _ = straighten(img)
    cw, ch = CANVAS
    scale = READY_SCREEN_H * ch / (y1 - y0)
    left = (x0 + x1) / 2 - cw / scale / 2  # phone in the middle
    top = img.height - ch / scale          # bottom edges together; the wall is grown upwards
    grow = max(0, int(np.ceil(-top)) + 2)
    out = extend_top(img, grow).transform(CANVAS, Image.AFFINE, (1 / scale, 0, left, 0, 1 / scale, top + grow),
                                          resample=Image.BICUBIC)
    if write:
        out.save(os.path.join(OUT, "try-avatar-ready.webp"), "WEBP", quality=84, method=6)
    rx0, ry0, rx1, ry1, _ = find_screen(out)
    print("ready    " + css_vars(rx0, ry0, rx1 - rx0, ry1 - ry0))


def css_vars(x, y, w, h):
    """The overlay's place for try-sara.html: the glass minus BEZEL, so a thin black rim stays around it."""
    cw, ch = CANVAS
    return "--sx:%.3f%%;--sy:%.3f%%;--sw:%.3f%%;--sh:%.3f%%" % (
        (x + BEZEL) / cw * 100, (y + BEZEL) / ch * 100, (w - 2 * BEZEL) / cw * 100, (h - 2 * BEZEL) / ch * 100)


if __name__ == "__main__":
    write = "--check" not in sys.argv
    ok = [cut_avatar(key, name, write) for key, name in AVATARS.items()]
    cut_ready(write)
    print("avatars  " + css_vars(*SCREEN))
    sys.exit(0 if all(ok) else 1)
