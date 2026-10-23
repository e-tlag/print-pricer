"""Draws the app icons (no extra libraries needed).

Run:  python tools/make_icons.py
Writes icons/icon-192.png, icons/icon-512.png, icons/icon-maskable-512.png.
The design: a print nozzle over three stacked layers, on the app's dark background.
"""
import pathlib
import struct
import zlib

BG = (10, 15, 26)        # #0A0F1A
TEAL = (45, 212, 191)    # #2DD4BF
LIGHT = (238, 242, 247)  # #EEF2F7
OUT = pathlib.Path(__file__).resolve().parent.parent / "icons"


def in_round_rect(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def in_trapezoid(x, y, y0, y1, w0, w1, cx=0.5):
    if y < y0 or y > y1:
        return False
    t = (y - y0) / (y1 - y0)
    half = (w0 + (w1 - w0) * t) / 2
    return abs(x - cx) <= half


def shape_color(x, y):
    """Color of the artwork at (x, y) in 0..1 space, or None for background."""
    if in_round_rect(x, y, 0.38, 0.15, 0.62, 0.28, 0.03) or (0.38 <= x <= 0.62 and 0.22 <= y <= 0.28):
        return LIGHT  # heater block: rounded top, square bottom so it joins the tip cleanly
    if in_trapezoid(x, y, 0.25, 0.37, 0.24, 0.06):
        return LIGHT
    bars = [(0.35, 0.65, 0.46), (0.27, 0.73, 0.575), (0.19, 0.81, 0.69)]
    for x0, x1, y0 in bars:
        if in_round_rect(x, y, x0, y0, x1, y0 + 0.08, 0.035):
            return TEAL
    return None


def render(size, maskable):
    ss = 3  # samples per pixel side, for smooth edges
    scale = 0.84 if maskable else 1.0  # keep artwork inside Android's safe circle
    rows = []
    for py in range(size):
        row = bytearray([0])  # PNG filter: none
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    u = (px + (sx + 0.5) / ss) / size
                    v = (py + (sy + 0.5) / ss) / size
                    inside_bg = maskable or in_round_rect(u, v, 0, 0, 1, 1, 0.22)
                    if not inside_bg:
                        continue
                    au = 0.5 + (u - 0.5) / scale
                    av = 0.5 + (v - 0.5) / scale - 0.04  # nudge artwork down to look centered
                    c = shape_color(au, av) or BG
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 255
            n = ss * ss
            a = acc[3] / n
            if a == 0:
                row += bytes([0, 0, 0, 0])
            else:
                k = acc[3] / 255
                row += bytes([round(acc[0] / k), round(acc[1] / k), round(acc[2] / k), round(a)])
        rows.append(bytes(row))
    return png(size, size, b"".join(rows))


def png(w, h, raw):
    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
    header = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for name, size, maskable in [("icon-192.png", 192, False), ("icon-512.png", 512, False), ("icon-maskable-512.png", 512, True)]:
        (OUT / name).write_bytes(render(size, maskable))
        print("wrote", OUT / name)
