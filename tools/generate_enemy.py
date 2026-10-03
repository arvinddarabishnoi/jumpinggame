#!/usr/bin/env python3
"""
generate_enemy.py - the enemy cast as sprite sheets.

  assets/slime.png/.json   Gloop: idle bounce, hop, fall, bite, hurt, death
  assets/bat.png/.json     Nightwing: flap, dive, hurt, death

Both use the same 48x48 cell / foot-anchor convention as the hero, so the
game can draw every character with one tiny sprite renderer.
Run with:  python3 tools/generate_enemy.py [--preview /tmp/enemy.png]
"""
import argparse, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixel import Canvas, Sheet, rgb, shade, put, Image
from generate_hero import ik2, impact, P as HERO_P

CELL = 48
CX, GROUND = 22, 42
OUTLINE = rgb("#241a2e")

SLIME = {
    "body": rgb("#4fd06a"), "body_sh": rgb("#279444"), "body_hi": rgb("#a8f0a8"),
    "core": rgb("#1d7a3a"), "eye": rgb("#20303a"), "white": rgb("#ffffff"),
    "mouth": rgb("#3d1f2c"), "tongue": rgb("#ef6a7a"), "spit": rgb("#c9ffd4"),
}
BAT = {
    "body": rgb("#6b5a8f"), "body_sh": rgb("#443a63"), "body_hi": rgb("#9d8ac4"),
    "wing": rgb("#4b3f6d"), "wing_sh": rgb("#332a4c"), "wing_hi": rgb("#8a76b6"),
    "eye": rgb("#ff5a5a"), "white": rgb("#ffd4d4"), "fang": rgb("#fff6cf"),
    "mouth": rgb("#2a1c33"),
}


# ---------------------------------------------------------------- helpers --
def blob(L, cx, cy, rx, ry, col, hi, sh, squash=0.0):
    """A wobbly slime body: wide dome on top, flat base, highlight + shadow."""
    L.ellipse(cx, cy, rx, ry, col)
    L.box(cx - rx, cy, cx + rx, cy + ry * 0.9, col)
    L.disc(cx - rx * 0.95, cy + ry * 0.55, rx * 0.35, col)
    L.disc(cx + rx * 0.95, cy + ry * 0.55, rx * 0.35, col)
    # shading along the bottom + a soft inner core
    L.ellipse(cx, cy + ry * 0.55, rx * 0.9, ry * 0.42, sh)
    L.ellipse(cx, cy + ry * 0.1, rx * 0.45, ry * 0.45, sh)
    # top highlight
    L.ellipse(cx - rx * 0.3, cy - ry * 0.55, rx * 0.42, ry * 0.3, hi)
    L.disc(cx - rx * 0.55, cy - ry * 0.5, rx * 0.14, hi)


def slime_face(L, cx, cy, angry=False, blink=False, pal=SLIME):
    for ex in (-3.2, 1.6):
        if blink:
            L.box(cx + ex, cy + 0.8, cx + ex + 1.8, cy + 1.3, pal["eye"])
        else:
            L.disc(cx + ex + 0.9, cy, 1.1, pal["white"])
            L.disc(cx + ex + 0.9, cy, 0.8, pal["eye"])
            put(L.img, int(cx + ex + 0.6), int(cy - 0.5), pal["white"])
    if angry:
        # gritted, toothy mouth
        L.box(cx - 2.4, cy + 3.0, cx + 2.4, cy + 4.4, pal["mouth"])
        for i in range(-2, 3):
            L.box(cx + i * 1.0, cy + 3.0, cx + i * 1.0 + 0.5, cy + 3.8, pal["white"])
    else:
        L.arc(cx, cy + 2.6, 2.2, 20, 160, pal["mouth"], 0.8)


def _wing(L, cx, cy, side, flap, pal):
    """One scalloped bat wing. side = -1 (left) / +1 (right)."""
    f = flap
    shoulder = (cx + side * 1.6, cy - 0.6)
    elbow = (cx + side * 5.2, cy - 2.6 - f * 2.2)
    tip = (cx + side * 11.0, cy - 0.6 - f * 3.6)
    edge = [shoulder, elbow, tip,
            (cx + side * 9.2, cy + 1.6 - f * 1.4),
            (cx + side * 7.4, cy + 0.4 - f * 0.6),
            (cx + side * 6.0, cy + 2.6 - f * 1.6),
            (cx + side * 4.4, cy + 0.8 - f * 0.6),
            (cx + side * 2.8, cy + 3.0 - f * 1.8),
            (cx + side * 1.6, cy + 1.0)]
    L.poly(edge, pal["wing"])
    # lighter top membrane, darker trailing edge
    L.poly([shoulder, elbow, tip, (cx + side * 8.0, cy + 0.2 - f * 1.0),
            (cx + side * 4.6, cy + 0.6 - f * 0.6), (cx + side * 2.2, cy + 0.4)], pal["wing_hi"])
    L.poly([(cx + side * 2.8, cy + 3.0 - f * 1.8), (cx + side * 6.0, cy + 2.6 - f * 1.6),
            (cx + side * 7.4, cy + 0.4 - f * 0.6), (cx + side * 9.2, cy + 1.6 - f * 1.4),
            (cx + side * 8.0, cy + 2.0 - f * 1.0)], pal["wing_sh"])
    # wing bones
    L.capsule(shoulder, elbow, pal["body_sh"], 0.5)
    L.capsule(elbow, tip, pal["body_sh"], 0.5)


def bat_body(L, cx, cy, flap, hurt=False, pal=BAT):
    """flap: +1 wings up, -1 wings down."""
    for side in (-1, 1):
        _wing(L, cx, cy, side, flap, pal)
    # body
    L.ellipse(cx, cy + 0.6, 4.0, 4.4, pal["body"])
    L.ellipse(cx - 1.2, cy - 0.4, 2.2, 2.4, pal["body_hi"])
    L.ellipse(cx, cy + 1.6, 2.6, 2.4, pal["body_sh"])
    # ears
    L.poly([(cx - 3.2, cy - 2.6), (cx - 4.6, cy - 6.2), (cx - 1.4, cy - 3.8)], pal["body_sh"])
    L.poly([(cx + 3.2, cy - 2.6), (cx + 4.6, cy - 6.2), (cx + 1.4, cy - 3.8)], pal["body_sh"])
    L.poly([(cx - 3.0, cy - 2.8), (cx - 4.0, cy - 5.4), (cx - 2.0, cy - 3.6)], pal["body"])
    L.poly([(cx + 3.0, cy - 2.8), (cx + 4.0, cy - 5.4), (cx + 2.0, cy - 3.6)], pal["body"])
    # face
    for ex in (-2.2, 1.1):
        L.disc(cx + ex + 0.5, cy + 0.2, 1.0, pal["white"])
        L.disc(cx + ex + 0.5, cy + 0.2, 0.6, pal["eye"])
        put(L.img, int(cx + ex), int(cy - 0.4), pal["white"])
    if hurt:
        L.box(cx - 1.6, cy + 2.2, cx + 1.6, cy + 3.6, pal["mouth"])       # open screech
        put(L.img, int(cx - 1.0), int(cy + 2.2), pal["fang"])
        put(L.img, int(cx + 0.6), int(cy + 2.2), pal["fang"])
    else:
        L.box(cx - 1.2, cy + 2.4, cx + 1.2, cy + 3.0, pal["mouth"])
        put(L.img, int(cx - 0.8), int(cy + 2.4), pal["fang"])
        put(L.img, int(cx + 0.4), int(cy + 2.4), pal["fang"])
    # feet
    for side in (-1, 1):
        L.disc(cx + side * 1.6, cy + 4.6, 0.9, pal["body_sh"])


# ------------------------------------------------------------------ slime --
def slime_frames():
    def mk(sq, dy=0.0, angry=False, blink=False, tongue=False, dx=0.0):
        c = Canvas(CELL, CELL)
        rx = 8.4 * (1 + sq * 0.16)
        ry = 6.2 * (1 - sq * 0.22)
        cy = GROUND - ry - 0.6 + dy
        blob(c, CX + dx, cy, rx, ry, SLIME["body"], SLIME["body_hi"], SLIME["body_sh"])
        # jelly core
        c.ellipse(CX + dx, cy + ry * 0.25, rx * 0.28, ry * 0.3, SLIME["core"])
        c.ellipse(CX + dx - rx * 0.45, cy, rx * 0.16, ry * 0.2, SLIME["core"])
        slime_face(c, CX + dx, cy - 0.4, angry=angry, blink=blink)
        if tongue:
            c.box(CX + dx - 1.4, cy + 3.2, CX + dx + 1.4, cy + 5.0, SLIME["tongue"])
        return c.outline(OUTLINE)

    idle = [mk(math.sin(i / 4 * math.pi * 2) * 0.8, dy=abs(math.sin(i / 4 * math.pi * 2)) * -0.7,
               blink=(i == 2)) for i in range(4)]

    hop = []
    for i, (sq, dy) in enumerate([(0.9, 0.0), (-0.6, -2.4), (-0.2, -3.4)]):
        c = mk(sq, dy=dy, angry=True)
        # squash-stretch stub of a leg pushing off
        hop.append(c)
    fall = [mk(-0.1 + k * 0.1, dy=-0.6, blink=False, tongue=True) for k in (-1, 1, -1)]

    def attack_frames():
        out = []
        for i, (dx, sq, angry) in enumerate([(-1.2, 0.2, True), (2.6, -0.35, True),
                                             (4.4, -0.55, True), (1.0, 0.15, True)]):
            c = Canvas(CELL, CELL)
            rx = 8.4 * (1 + sq * 0.16)
            ry = 6.2 * (1 - sq * 0.22)
            cy = GROUND - ry - 0.6 - (1.0 if i in (1, 2) else 0)
            blob(c, CX + dx, cy, rx, ry, SLIME["body"], SLIME["body_hi"], SLIME["body_sh"])
            c.ellipse(CX + dx, cy + ry * 0.25, rx * 0.28, ry * 0.3, SLIME["core"])
            # stretched biting maw
            if i >= 1:
                c.ellipse(CX + dx + 1.4, cy - 0.2, 3.4, 3.2, SLIME["mouth"])
                c.box(CX + dx - 1.4, cy - 0.6, CX + dx + 4.2, cy + 2.4, SLIME["mouth"])
                for t in range(3):
                    c.box(CX + dx - 1.0 + t * 1.6, cy - 0.8, CX + dx - 0.4 + t * 1.6, cy + 0.4, SLIME["white"])
                    c.box(CX + dx - 1.0 + t * 1.6, cy + 1.4, CX + dx - 0.4 + t * 1.6, cy + 2.6, SLIME["white"])
                c.box(CX + dx + 0.4, cy + 1.1, CX + dx + 3.4, cy + 1.7, SLIME["tongue"])
            slime_face(c, CX + dx - 1.0, cy - 0.8, angry=True)
            if i == 3:                                    # spit droplets
                for k in (-1, 0, 1):
                    c.disc(CX + dx + 6.5 + k * 1.4, cy + 1.5 + k * 1.8, 0.8, SLIME["spit"])
            out.append(c.outline(OUTLINE))
        return out

    def hurt_frames():
        out = []
        for i in range(3):
            c = Canvas(CELL, CELL)
            rx, ry = 8.4 * (1 + (0.3 if i == 0 else 0.1)), 6.2 * (1 - 0.2)
            cy = GROUND - ry - 0.6
            blob(c, CX - 0.6, cy, rx, ry, SLIME["body"], SLIME["body_hi"], SLIME["body_sh"])
            slime_face(c, CX - 0.6, cy - 0.4, angry=False, blink=True)
            c.box(CX - 2.0, cy + 3.2, CX + 1.2, cy + 4.6, SLIME["mouth"])
            out.append(c.outline(OUTLINE))
        return out

    def death_frames():
        from generate_hero import impact
        out = []
        for i in range(5):
            k = i / 4
            c = Canvas(CELL, CELL)
            rx = 8.4 * (1 + k * 0.35)
            ry = 6.2 * (1 - k * 0.62)
            cy = GROUND - ry - 0.4
            blob(c, CX, cy, rx, ry, SLIME["body"], SLIME["body_hi"], SLIME["body_sh"])
            if k < 0.5:
                slime_face(c, CX, cy - 0.4, blink=True)
            # puddle spread under the remains
            c.ellipse(CX, GROUND - 0.9, rx * 1.15, 1.2 + k, SLIME["body_sh"])
            if i == 0:
                impact(c, CX, cy - 6, 3.0, SLIME["body_hi"], SLIME["white"])
            out.append(c.outline(OUTLINE))
        return out

    return dict(idle=(idle, 6, True), hop=(hop, 9, False), fall=(fall, 8, True),
                attack=(attack_frames(), 12, False), hurt=(hurt_frames(), 10, False),
                death=(death_frames(), 8, False))


# -------------------------------------------------------------------- bat --
def bat_frames():
    def mk(flap, dy=0.0, hurt=False):
        c = Canvas(CELL, CELL)
        bat_body(c, CX, GROUND - 19 + dy, flap, hurt=hurt)
        return c.outline(OUTLINE)

    fly = [mk(f) for f in (1.0, 0.15, -1.0, 0.15)]
    dive = [mk(-0.5, dy=2.0), mk(-0.9, dy=5.0), mk(-0.6, dy=2.5)]
    hurt = [mk(-0.1, dy=1.0, hurt=True), mk(0.7, dy=3.0, hurt=True)]
    death = []
    for i in range(4):
        k = i / 3
        c = Canvas(CELL, CELL)
        bat_body(c, CX, GROUND - 19 + k * 16, -1 + k * 2.4, hurt=True)
        if k > 0.4:                                   # tumbling out of the air
            c.img = c.img.rotate(-30 * (k - 0.4) * 1.6, resample=Image.NEAREST)
        death.append(c.outline(OUTLINE))
    return dict(fly=(fly, 12, True), dive=(dive, 12, False),
                hurt=(hurt, 9, False), death=(death, 9, False))


def build(preview=None):
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
    sheets = {}
    for name, data in (("slime", slime_frames()), ("bat", bat_frames())):
        s = Sheet(name, (CELL, CELL), (CX, GROUND))
        for anim, (frames, fps, loop) in data.items():
            s.add(anim, frames, fps=fps, loop=loop)
        sheets[name] = s.save(out)
        if preview:
            s.preview(preview if name == "slime" else preview.replace(".png", "_bat.png"), zoom=4)
    return sheets


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", default=None)
    a = ap.parse_args()
    for name, (sheet, meta) in build(a.preview).items():
        print(name, sheet.size, {k: len(v["frames"]) for k, v in meta["animations"].items()})
