#!/usr/bin/env python3
"""
replay.py - turn the JSON frames recorded by tools/headless.mjs into PNGs.

    python3 tools/headless.mjs --seconds 20 --shot 3,6,9 --out /tmp/frames
    python3 tools/replay.py /tmp/frames/*.json --zoom 3 --sheet /tmp/review.png

It understands exactly the canvas subset the game uses (translations, axis
aligned scaling/flips, alpha, rectangles, gradients flattened to a colour and
image blits - including the offscreen canvas the level is baked into), so the
result is a faithful pixel-for-pixel preview of the game.
"""
import argparse, json, os, re, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = {}


def load_src(name):
    if name not in CACHE:
        p = os.path.join(ROOT, 'assets', name)
        CACHE[name] = Image.open(p).convert('RGBA')
    return CACHE[name]


def parse_color(col):
    """'#rgb' / '#rrggbb' / 'rgba(r,g,b,a)' / 'rgb(...)' -> (r,g,b,a)"""
    if isinstance(col, tuple):
        return col
    col = str(col).strip()
    m = re.match(r'rgba?\(([^)]+)\)', col)
    if m:
        parts = [float(x) for x in m.group(1).split(',')]
        a = parts[3] if len(parts) > 3 else 1.0
        return (int(parts[0]), int(parts[1]), int(parts[2]), int(a * 255))
    if col.startswith('#'):
        h = col[1:]
        if len(h) == 3:
            h = ''.join(c * 2 for c in h)
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
    return (255, 0, 255, 255)


class Canvas:
    """A tiny stand-in for the HTML canvas 2D API."""

    def __init__(self, w, h, bg=(0, 0, 0, 255)):
        self.img = Image.new('RGBA', (w, h), bg)
        self.w, self.h = w, h
        self.m = (1, 0, 0, 1, 0, 0)         # a b c d e f
        self.alpha = 1.0
        self.stack = []
        self.warnings = 0

    # --- transforms -------------------------------------------------------
    def push_mul(self, n):
        a, b, c, d, e, f = self.m
        na, nb, nc, nd, ne, nf = n
        self.m = (a * na + c * nb, b * na + d * nb,
                  a * nc + c * nd, b * nc + d * nd,
                  a * ne + c * nf + e, b * ne + d * nf + f)

    def run(self, ops):
        for op in ops:
            kind = op.get('op')
            if kind == 'save':
                self.stack.append((self.m, self.alpha))
            elif kind == 'restore':
                if self.stack:
                    self.m, self.alpha = self.stack.pop()
            elif kind == 'translate':
                self.push_mul((1, 0, 0, 1, op['x'], op['y']))
            elif kind == 'scale':
                self.push_mul((op['x'], 0, 0, op['y'], 0, 0))
            elif kind == 'rotate':
                self.stack.append((self.m, self.alpha))     # not used by the game
                self.stack.pop()
            elif kind == 'fillRect':
                self.fill_rect(op)
            elif kind == 'strokeRect':
                self.stroke_rect(op)
            elif kind == 'drawImage':
                self.draw_image(op)
        return self.img

    # --- primitives -------------------------------------------------------
    def fill_rect(self, op):
        a, b, c, d, e, f = op['m']
        if abs(b) > 1e-6 or abs(c) > 1e-6:
            self.warnings += 1
            return
        x0, y0 = a * op['x'] + e, d * op['y'] + f
        x1, y1 = a * (op['x'] + op['w']) + e, d * (op['y'] + op['h']) + f
        rx0, rx1 = sorted((x0, x1))
        ry0, ry1 = sorted((y0, y1))
        col = parse_color(op['col'])
        al = int(col[3] * op.get('alpha', 1) * self.alpha)
        if al <= 0:
            return
        box = (int(round(rx0)), int(round(ry0)), int(round(rx1)), int(round(ry1)))
        if box[2] <= box[0] or box[3] <= box[1]:
            return
        layer = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), (col[0], col[1], col[2], al))
        self.img.alpha_composite(layer, (box[0], box[1]))

    def stroke_rect(self, op):
        a, b, c, d, e, f = op['m']
        x0, y0 = a * op['x'] + e, d * op['y'] + f
        x1, y1 = a * (op['x'] + op['w']) + e, d * (op['y'] + op['h']) + f
        rx0, rx1 = sorted((x0, x1))
        ry0, ry1 = sorted((y0, y1))
        col = parse_color(op['col'])
        al = int(255 * op.get('alpha', 1) * self.alpha)
        layer = Image.new('RGBA', self.img.size, (0, 0, 0, 0))
        px = layer.load()

        def put(x, y):
            if 0 <= x < self.w and 0 <= y < self.h:
                px[x, y] = (col[0], col[1], col[2], al)
        for x in range(int(rx0), int(rx1) + 1):
            put(x, int(ry0)); put(x, int(ry1))
        for y in range(int(ry0), int(ry1) + 1):
            put(int(rx0), y); put(int(rx1), y)
        self.img.alpha_composite(layer)

    def draw_image(self, op):
        a, b, c, d, e, f = op['m']
        if abs(b) > 1e-6 or abs(c) > 1e-6:
            self.warnings += 1
            return
        if op.get('sub') is not None:
            sub = Canvas(op['iw'], op['ih'], (0, 0, 0, 0))
            sub.run(op['sub'])
            src = sub.img
        else:
            src = load_src(op['src'])
        sx, sy, sw, sh = op['sx'], op['sy'], op['sw'], op['sh']
        tile = src.crop((int(sx), int(sy), int(round(sx + sw)), int(round(sy + sh))))
        dw = abs(a) * op['dw']
        dh = abs(d) * op['dh']
        if dw <= 0 or dh <= 0:
            return
        if (round(dw), round(dh)) != tile.size:
            tile = tile.resize((max(1, int(round(dw))), max(1, int(round(dh)))), Image.NEAREST)
        if a < 0:
            tile = tile.transpose(Image.FLIP_LEFT_RIGHT)
        if d < 0:
            tile = tile.transpose(Image.FLIP_TOP_BOTTOM)
        al = op.get('alpha', 1) * self.alpha
        if al < 0.999:
            ch = tile.split()[3].point(lambda v: int(v * al))
            tile = tile.copy()
            tile.putalpha(ch)
        x = int(round(min(a * op['dx'] + e, a * (op['dx'] + op['dw']) + e)))
        y = int(round(min(d * op['dy'] + f, d * (op['dy'] + op['dh']) + f)))
        self.img.alpha_composite(tile, (x, y))


def render_frame(js):
    w, h = js.get('w', 320), js.get('h', 180)
    c = Canvas(w, h, (26, 20, 44, 255))
    img = c.run(js['ops'])
    if c.warnings:
        print(f"  ! {c.warnings} unsupported ops skipped")
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('frames', nargs='+')
    ap.add_argument('--zoom', type=int, default=3)
    ap.add_argument('--sheet', default=None, help='also write a contact sheet')
    ap.add_argument('--outdir', default=None)
    a = ap.parse_args()

    images = []
    for p in a.frames:
        with open(p) as fh:
            js = json.load(fh)
        img = render_frame(js)
        name = os.path.splitext(os.path.basename(p))[0]
        outdir = a.outdir or os.path.dirname(os.path.abspath(p))
        out = os.path.join(outdir, name + '.png')
        z = img.resize((img.width * a.zoom, img.height * a.zoom), Image.NEAREST)
        z.save(out)
        images.append((name, z))
        print('wrote', out, z.size)

    if a.sheet and images:
        cols = min(3, len(images))
        rows = (len(images) + cols - 1) // cols
        cw = max(i.width for _, i in images)
        chh = max(i.height for _, i in images)
        sheet = Image.new('RGBA', (cols * (cw + 6) + 6, rows * (chh + 18) + 6), (18, 14, 32, 255))
        for k, (name, img) in enumerate(images):
            x = 6 + (k % cols) * (cw + 6)
            y = 6 + (k // cols) * (chh + 18)
            sheet.alpha_composite(img, (x, y))
            from PIL import ImageDraw
            d = ImageDraw.Draw(sheet)
            d.text((x + 2, y + chh + 2), name, fill=(200, 190, 230))
        sheet.save(a.sheet)
        print('wrote', a.sheet, sheet.size)


if __name__ == '__main__':
    main()
