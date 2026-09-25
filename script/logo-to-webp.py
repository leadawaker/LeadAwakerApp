#!/usr/bin/env python3
"""Normalize a business logo into a 256px square WebP for a round avatar.

Usage: logo-to-webp.py <input> <output.webp>

Called by server/clientLogo.ts. Reads anything Pillow reads (PNG, JPEG, GIF,
WebP, ICO: the largest frame); SVG is rasterized by the caller first.

The avatar is a circle, so the logo is trimmed to its visible content and then
centred on a square whose side is the content's DIAGONAL (plus a little air):
that way no corner of a wide wordmark is ever clipped by the circle. The pad
colour is the logo's own background when its corners are a solid colour (an
app icon on red stays on red), otherwise white.

Prints {"w": .., "h": ..} (the source size) on success. Exit 2 when the image
is too small to look like anything at 256px, exit 1 on anything unreadable.
"""
import json
import math
import sys

from PIL import Image, ImageChops

MIN_SIDE = 48
OUT = 256
AIR = 1.03


def largest_frame(img: Image.Image) -> Image.Image:
    if getattr(img, "format", "") == "ICO" and hasattr(img, "ico"):
        sizes = sorted(img.ico.sizes(), key=lambda s: s[0] * s[1])
        if sizes:
            img.size = sizes[-1]
            img.load()
    return img


def corner_colour(img: Image.Image):
    """The shared colour of the four corners, or None if they differ or are transparent."""
    w, h = img.size
    pts = [img.getpixel((x, y)) for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    if any(p[3] < 250 for p in pts):
        return None
    base = pts[0]
    if all(sum(abs(a - b) for a, b in zip(p[:3], base[:3])) < 30 for p in pts):
        return base[:3]
    return None


def main() -> int:
    src, dst = sys.argv[1], sys.argv[2]
    try:
        img = largest_frame(Image.open(src))
        img = img.convert("RGBA")
    except Exception:
        return 1
    w, h = img.size
    if min(w, h) < MIN_SIDE:
        return 2

    bg = corner_colour(img) or (255, 255, 255)
    flat = Image.new("RGB", img.size, bg)
    flat.paste(img, mask=img.split()[3])

    # Trim to what differs from the background.
    diff = ImageChops.difference(flat, Image.new("RGB", flat.size, bg)).convert("L")
    diff = diff.point(lambda v: 255 if v > 24 else 0)
    box = diff.getbbox()
    if box:
        flat = flat.crop(box)
    cw, ch = flat.size

    side = max(int(math.ceil(math.hypot(cw, ch) * AIR)), 1)
    canvas = Image.new("RGB", (side, side), bg)
    canvas.paste(flat, ((side - cw) // 2, (side - ch) // 2))
    canvas = canvas.resize((OUT, OUT), Image.LANCZOS)
    canvas.save(dst, "WEBP", quality=90)
    print(json.dumps({"w": w, "h": h}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
