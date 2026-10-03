"""
pixel.py - tiny procedural pixel-art drawing toolkit.

Draws onto small RGBA canvases with hard (non anti-aliased) edges so the
result reads as real pixel art, then optionally burns a 1px dark outline
around the whole silhouette (the classic "sticker" look) and packs every
frame into a sprite sheet + JSON atlas.

Only dependency: Pillow  (pip install Pillow)
"""

from PIL import Image, ImageDraw, ImageFilter
import math
import json


# --------------------------------------------------------------------------
# colours
# --------------------------------------------------------------------------
def rgb(h, a=255):
    """'#rrggbb' (or '#rgb') -> (r, g, b, a)"""
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def shade(h, f):
    """Multiply a hex colour by f (0.5 = darker, 1.3 = lighter)."""
    r, g, b, a = rgb(h)
    c = lambda v: max(0, min(255, int(v * f)))
    return (c(r), c(g), c(b), a)


def put(img, x, y, col):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), col)


# --------------------------------------------------------------------------
# canvas
# --------------------------------------------------------------------------
class Canvas:
    """Hard-edged drawing surface."""

    def __init__(self, w, h, bg=(0, 0, 0, 0)):
        self.img = Image.new("RGBA", (w, h), bg)
        self.d = ImageDraw.Draw(self.img)
        self.w, self.h = w, h

    # -- primitives --------------------------------------------------------
    def disc(self, cx, cy, r, col):
        self.d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)

    def ellipse(self, cx, cy, rx, ry, col):
        self.d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=col)

    def box(self, x0, y0, x1, y1, col):
        self.d.rectangle([x0, y0, x1, y1], fill=col)

    def poly(self, pts, col):
        self.d.polygon([(p[0], p[1]) for p in pts], fill=col)

    def line(self, p0, p1, col, w=1):
        self.d.line([p0, p1], fill=col, width=max(1, int(w)))

    def capsule(self, p0, p1, col, r=1.5):
        """Thick line with round caps - the workhorse for limbs."""
        self.d.line([p0, p1], fill=col, width=max(1, int(round(r * 2))))
        self.disc(p0[0], p0[1], r, col)
        self.disc(p1[0], p1[1], r, col)

    def arc(self, cx, cy, r, a0, a1, col, w=1.5, steps=None):
        """Hard-edged arc (degrees, 0 = +x, grows clockwise on screen)."""
        n = steps or max(4, int(abs(a1 - a0) / 6) + 2)
        prev = None
        for i in range(n + 1):
            a = math.radians(a0 + (a1 - a0) * i / n)
            p = (cx + math.cos(a) * r, cy + math.sin(a) * r)
            if prev:
                self.capsule(prev, p, col, w * 0.5)
            prev = p

    # -- text-free helpers -------------------------------------------------
    def outline(self, col=(34, 26, 46, 255), size=1):
        """Return a copy of this canvas with a dark border burned around the
        silhouette (original pixels stay on top)."""
        alpha = self.img.split()[3]
        grown = alpha.filter(ImageFilter.MaxFilter(size * 2 + 1))
        border = Image.new("RGBA", self.img.size, col)
        border.putalpha(grown)
        out = Image.alpha_composite(border, self.img)
        return out


# --------------------------------------------------------------------------
# geometry helpers
# --------------------------------------------------------------------------
def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def limb(origin, a0, a1, l0, l1):
    """Two-bone limb.

    origin : shoulder / hip position (px)
    a0, a1 : angle of upper bone and of lower bone (degrees, 0 = down,
             90 = forward/right), so poses read naturally.
    returns (joint, end)
    """
    j = (origin[0] + math.sin(math.radians(a0)) * l0,
         origin[1] + math.cos(math.radians(a0)) * l0)
    e = (j[0] + math.sin(math.radians(a1)) * l1,
         j[1] + math.cos(math.radians(a1)) * l1)
    return j, e


# --------------------------------------------------------------------------
# sprite sheet packing
# --------------------------------------------------------------------------
class Sheet:
    """Packs frames row-by-row and writes <name>.png + <name>.json."""

    def __init__(self, name, cell, origin, layout="rows", cols=8):
        self.name = name
        self.cw, self.ch = cell
        self.origin = origin          # ground-anchor inside the cell (sprite px)
        self.anims = []               # [{name, fps, loop, frames:[Image]}]
        self.layout = layout          # "rows" = one animation per row
        self.cols = cols              # "grid" = single-frame tiles, wrapped

    def add(self, name, frames, fps=10, loop=True):
        self.anims.append(dict(name=name, fps=fps, loop=loop, frames=frames))
        return self

    def build(self):
        meta = {
            "image": self.name + ".png",
            "cell": {"w": self.cw, "h": self.ch},
            "anchor": {"x": self.origin[0], "y": self.origin[1]},
            "animations": {},
        }
        if self.layout == "grid":
            # every animation is a single frame: wrap them across columns
            cols = min(self.cols, max(1, len(self.anims)))
            rows = (len(self.anims) + cols - 1) // cols
            sheet = Image.new("RGBA", (cols * self.cw, rows * self.ch), (0, 0, 0, 0))
            for i, a in enumerate(self.anims):
                x, y = (i % cols) * self.cw, (i // cols) * self.ch
                sheet.paste(a["frames"][0], (x, y), a["frames"][0])
                meta["animations"][a["name"]] = {"fps": a["fps"], "loop": a["loop"],
                                                 "frames": [[x, y, self.cw, self.ch]]}
            return sheet, meta
        cols = max(len(a["frames"]) for a in self.anims)
        rows = len(self.anims)
        sheet = Image.new("RGBA", (cols * self.cw, rows * self.ch), (0, 0, 0, 0))
        for r, a in enumerate(self.anims):
            entry = {"fps": a["fps"], "loop": a["loop"], "frames": []}
            for c, fr in enumerate(a["frames"]):
                x, y = c * self.cw, r * self.ch
                sheet.paste(fr, (x, y), fr)
                entry["frames"].append([x, y, self.cw, self.ch])
            meta["animations"][a["name"]] = entry
        return sheet, meta

    def save(self, outdir):
        import os
        sheet, meta = self.build()
        os.makedirs(outdir, exist_ok=True)
        sheet.save(os.path.join(outdir, self.name + ".png"))
        with open(os.path.join(outdir, self.name + ".json"), "w") as f:
            json.dump(meta, f, indent=1)
        return sheet, meta

    def preview(self, path, zoom=5, bg=(58, 46, 74, 255)):
        """Zoomed contact sheet with frame guide lines - for eyeballing only."""
        sheet, meta = self.build()
        guide = Canvas(sheet.width, sheet.height)
        for r, a in enumerate(self.anims):
            for c in range(len(a["frames"])):
                guide.box(c * self.cw, r * self.ch, (c + 1) * self.cw - 1,
                          r * self.ch + 2, (120, 100, 160, 255))
                guide.box(c * self.cw, r * self.ch, c * self.cw + 2,
                          (r + 1) * self.ch - 1, (120, 100, 160, 255))
        sheet = Image.alpha_composite(Image.new("RGBA", sheet.size, bg), sheet)
        sheet = Image.alpha_composite(sheet, guide.img)
        sheet = sheet.resize((sheet.width * zoom, sheet.height * zoom),
                             Image.NEAREST)
        sheet.save(path)
        return path
