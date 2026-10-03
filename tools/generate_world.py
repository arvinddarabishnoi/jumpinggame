#!/usr/bin/env python3
"""
generate_world.py - the level art: tiles, pickups, props and two parallax
background layers.

  assets/tiles.png/.json   16x16 grid : ground, stone, wood, spikes, items
  assets/props.png/.json   32x32 grid : tree, bush, rock, cloud, sign, torch
  assets/bg_far.png        320x180 tileable (sky band + far hills)
  assets/bg_mid.png        320x180 tileable (near hills + treeline, alpha)

Run with:  python3 tools/generate_world.py [--preview /tmp/world.png]
"""
import argparse, math, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixel import Canvas, Sheet, rgb, shade, put, Image

T = 16          # tile cell
PR = 32         # prop cell
OUT = rgb("#241a2e")
random.seed(7)

C = {
    "grass": rgb("#5fc15a"), "grass_hi": rgb("#8ee07a"), "grass_sh": rgb("#3d8f42"),
    "dirt": rgb("#8a5a37"), "dirt_sh": rgb("#6b4326"), "dirt_hi": rgb("#a8703f"),
    "stone": rgb("#8d94a8"), "stone_sh": rgb("#6a7085"), "stone_hi": rgb("#b0b7c9"),
    "wood": rgb("#a9773f"), "wood_sh": rgb("#7a5326"), "wood_hi": rgb("#c79a5c"),
    "spike": rgb("#cfd6e8"), "spike_sh": rgb("#94a0bb"),
    "coin": rgb("#ffd34d"), "coin_sh": rgb("#d19b1e"), "coin_hi": rgb("#fff3b0"),
    "heart": rgb("#ef4757"), "heart_hi": rgb("#ff8b93"), "heart_sh": rgb("#a81f34"),
    "potion": rgb("#4fd3f0"), "potion_sh": rgb("#1f8fb0"), "glass": rgb("#d9f6ff"),
    "cork": rgb("#b8823f"), "gold": rgb("#ffd34d"), "gold_sh": rgb("#c9922a"),
    "leaf": rgb("#3f9a52"), "leaf_hi": rgb("#69c46f"), "leaf_sh": rgb("#276b39"),
    "trunk": rgb("#7a5330"), "trunk_sh": rgb("#593a20"),
    "cloud": rgb("#f4f7ff"), "cloud_sh": rgb("#cdd7ee"),
    "sky_top": rgb("#3b2f63"), "sky_mid": rgb("#7b4a86"), "sky_low": rgb("#e2725b"),
    "hill_far": rgb("#6d4a7d"), "hill_far2": rgb("#5b3d6c"),
    "hill_mid": rgb("#3f3358"), "hill_mid2": rgb("#332a4a"),
    "water": rgb("#2c8fb0"), "water_hi": rgb("#6fd0e0"),
}


# ------------------------------------------------------------------ tiles --
def tile_ground(edges, kind="grass"):
    """edges: tuple like ('top','left') telling which sides are exposed."""
    c = Canvas(T, T)
    pal = {"grass": (C["grass"], C["grass_hi"], C["grass_sh"], C["dirt"], C["dirt_sh"], C["dirt_hi"]),
           "stone": (C["stone"], C["stone_hi"], C["stone_sh"], C["stone"], C["stone_sh"], C["stone_hi"]),
           "wood": (C["wood"], C["wood_hi"], C["wood_sh"], C["wood"], C["wood_sh"], C["wood_hi"])}[kind]
    main, hi, sh, fill, fill_sh, fill_hi = pal
    c.box(0, 0, T - 1, T - 1, fill)
    if kind == "grass":
        # speckled dirt body
        for y in range(4, T):
            for x in range(T):
                if (x * 7 + y * 13) % 11 == 0:
                    put(c.img, x, y, fill_sh)
                elif (x * 5 + y * 3) % 17 == 0:
                    put(c.img, x, y, fill_hi)
    elif kind == "stone":
        for y in range(2, T, 6):
            c.box(0, y, T - 1, y, fill_sh)
        for x in range(4, T, 8):
            c.box(x, 0, x, T - 1, fill_sh)
        c.box(0, 0, T - 1, 0, fill_hi)
    else:                                    # wood
        for x in range(2, T, 5):
            c.box(x, 0, x, T - 1, fill_sh)
        c.box(0, 1, T - 1, 1, fill_hi)
        c.box(0, T - 2, T - 1, T - 2, fill_sh)
    # exposed top: grass cap / lighter lip
    if "top" in edges:
        c.box(0, 0, T - 1, 1, main)
        c.box(0, 0, T - 1, 0, hi)
        for x in range(0, T, 2):
            put(c.img, x, 2, main if (x // 2) % 2 == 0 else sh)
        if kind == "grass":
            c.box(0, 3, T - 1, 3, sh)
    if "left" in edges:
        c.box(0, 0, 0, T - 1, sh)
    if "right" in edges:
        c.box(T - 1, 0, T - 1, T - 1, sh)
    if "left" in edges or "right" in edges:
        c.box(0, T - 1, T - 1, T - 1, fill_sh)
    return c.outline(OUT, 1)


def tile_spikes():
    c = Canvas(T, T)
    for i in range(2):                       # two chunky spikes per tile
        x0 = i * 8
        c.poly([(x0 + 0.5, T - 1), (x0 + 3.5, T - 12), (x0 + 4.0, T - 12), (x0 + 7.5, T - 1)],
               C["spike"])
        c.poly([(x0 + 3.5, T - 12), (x0 + 4.0, T - 12), (x0 + 7.5, T - 1), (x0 + 5.4, T - 1)],
               C["spike_sh"])
        c.poly([(x0 + 1.4, T - 3), (x0 + 3.5, T - 12), (x0 + 4.0, T - 12), (x0 + 3.2, T - 3)],
               rgb("#ffffff"))
    c.box(0, T - 3, T - 1, T - 1, C["spike_sh"])       # base plate
    c.box(0, T - 3, T - 1, T - 3, rgb("#7c86a4"))
    return c.outline(OUT, 1)


def tile_platform():
    c = Canvas(T, T)
    c.box(0, 0, T - 1, 6, C["wood"])
    c.box(0, 0, T - 1, 1, C["wood_hi"])
    c.box(0, 5, T - 1, 6, C["wood_sh"])
    for x in range(0, T, 6):
        c.capsule((x + 1, 1), (x + 1, 5), C["wood_sh"], 0.4)
    c.box(0, 0, 0, 6, C["wood_sh"])
    c.box(T - 1, 0, T - 1, 6, C["wood_sh"])
    return c.outline(OUT, 1)


def item_coin(i, n=4):
    c = Canvas(T, T)
    w = (4.5, 3.2, 1.4, 3.2)[i % n]
    c.ellipse(8, 8, w, 5.0, C["coin"])
    c.ellipse(8, 8, max(0.8, w - 1.4), 3.4, C["coin_sh"])
    if w > 2.0:
        c.ellipse(8, 7.4, max(0.6, w - 2.2), 2.4, C["coin_hi"])
        put(c.img, 7, 5, C["coin_hi"])
    return c.outline(OUT, 1)


def item_heart():
    c = Canvas(T, T)
    c.disc(5.6, 6.4, 2.6, C["heart"])
    c.disc(10.4, 6.4, 2.6, C["heart"])
    c.poly([(2.8, 7.6), (13.2, 7.6), (8, 14.4)], C["heart"])
    c.disc(5.0, 5.6, 1.0, C["heart_hi"])
    c.disc(9.8, 5.6, 1.0, C["heart_hi"])
    return c.outline(OUT, 1)


def item_potion():
    c = Canvas(T, T)
    c.box(6, 2, 9, 4, C["cork"])
    c.ellipse(8, 8.6, 3.6, 3.6, C["glass"])
    c.ellipse(8, 9.2, 2.8, 2.8, C["potion"])
    c.ellipse(8, 10.0, 2.0, 1.8, C["potion_sh"])
    put(c.img, 6, 8, C["glass"])
    put(c.img, 7, 7, C["glass"])
    return c.outline(OUT, 1)


def tile_crate():
    c = Canvas(T, T)
    c.box(1, 1, T - 2, T - 2, C["wood"])
    c.box(1, 1, T - 2, 2, C["wood_hi"])
    c.box(1, T - 3, T - 2, T - 2, C["wood_sh"])
    c.poly([(1, 1), (5, 1), (1, 5)], C["wood_hi"])
    c.box(6, 1, 9, T - 2, C["wood_sh"])
    c.box(1, 7, T - 2, 8, C["wood_sh"])
    return c.outline(OUT, 1)


# ------------------------------------------------------------------ props --
def prop_tree(big=True):
    c = Canvas(PR, PR)
    h = 30 if big else 24
    trunk_x = PR // 2
    c.capsule((trunk_x, PR - 1), (trunk_x, PR - h * 0.5), C["trunk"], 2.4 if big else 2.0)
    c.capsule((trunk_x - 1, PR - 1), (trunk_x - 1, PR - h * 0.5), C["trunk_sh"], 0.7)
    # leaf blobs
    blobs = [(16, 12, 9.5), (10, 15, 7), (22, 15, 7), (16, 6, 6.5), (9, 9, 5.5), (23, 9, 5.5)]
    for bx, by, r in blobs:
        c.disc(bx, by - (0 if big else 3), r, C["leaf"])
    for bx, by, r in blobs[:4]:
        c.disc(bx - r * 0.35, by - r * 0.4 - (0 if big else 3), r * 0.55, C["leaf_hi"])
    for bx, by, r in blobs[2:]:
        c.arc(bx, by - (0 if big else 3), r - 1, 20, 160, C["leaf_sh"], 1.2)
    return c.outline(OUT, 1)


def prop_bush():
    c = Canvas(PR, PR)
    for bx, by, r in ((11, 22, 7), (21, 22, 7), (16, 18, 8)):
        c.disc(bx, by, r, C["leaf"])
        c.disc(bx - r * 0.3, by - r * 0.4, r * 0.5, C["leaf_hi"])
    c.box(6, 26, 26, 28, C["leaf_sh"])
    return c.outline(OUT, 1)


def prop_rock():
    c = Canvas(PR, PR)
    c.poly([(6, 28), (8, 20), (14, 16), (22, 17), (26, 22), (27, 28)], C["stone"])
    c.poly([(10, 28), (12, 21), (18, 18), (22, 21), (23, 28)], C["stone_hi"])
    c.poly([(22, 28), (24, 22), (27, 24), (27, 28)], C["stone_sh"])
    return c.outline(OUT, 1)


def prop_cloud():
    c = Canvas(PR, PR)
    for bx, by, r in ((11, 16, 6), (17, 13, 7.5), (24, 16, 6)):
        c.disc(bx, by, r, C["cloud"])
    c.box(6, 16, 28, 20, C["cloud"])
    c.ellipse(18, 18.5, 9, 2.4, C["cloud_sh"])
    return c.outline(OUT, 1)


def prop_sign():
    c = Canvas(PR, PR)
    c.capsule((16, 30), (16, 16), C["trunk"], 1.6)
    c.box(4, 8, 28, 17, C["wood"])
    c.box(4, 8, 28, 9, C["wood_hi"])
    c.box(4, 18, 28, 19, C["wood_sh"])
    for i, x in enumerate(range(7, 25, 3)):
        c.box(x, 11, x + 1, 12, C["wood_sh"])
        c.box(x, 15, x + 1, 15, C["wood_sh"])
    return c.outline(OUT, 1)


def prop_torch():
    c = Canvas(PR, PR)
    c.capsule((16, 30), (16, 18), C["wood_sh"], 1.6)
    c.box(12, 16, 20, 19, C["stone_sh"])
    c.poly([(16, 2), (20, 10), (16, 16), (12, 10)], rgb("#ff9a3c"))
    c.poly([(16, 5), (18, 10), (16, 14), (14, 10)], rgb("#ffd76a"))
    c.disc(16, 11, 1.4, rgb("#fff6cf"))
    return c.outline(OUT, 1)


def prop_grass_tuft():
    c = Canvas(PR, PR)
    for i, (x, h) in enumerate(((10, 8), (14, 11), (18, 9), (22, 7), (12, 6), (20, 6))):
        c.poly([(x - 1, 29), (x + 1, 29), (x + 2 - i % 2 * 3, 29 - h)], C["grass"])
    c.box(8, 28, 24, 30, C["grass_sh"])
    return c.outline(OUT, 1)


def prop_flag():
    """The goal marker: a tall pole with a big waving banner."""
    c = Canvas(PR, PR)
    c.capsule((9, 31), (9, 3), C["stone_sh"], 1.7)             # pole
    c.capsule((8.2, 31), (8.2, 3), C["stone"], 0.6)            # pole highlight
    c.disc(9, 2.4, 2.2, C["gold"])                             # finial
    c.disc(8.3, 1.7, 0.9, C["coin_hi"])
    c.poly([(10, 4), (29, 7), (25.5, 12), (29, 17), (10, 20)], C["heart"])       # banner
    c.poly([(10, 4), (29, 7), (25.5, 12), (10, 12)], C["heart_hi"])
    c.poly([(10, 13), (25.5, 12), (29, 17), (10, 20)], C["heart_sh"])
    c.box(10, 4, 11, 20, C["gold_sh"])                         # hoist edge
    return c.outline(OUT, 1)


PROPS = [("flag", prop_flag), ("tree", prop_tree), ("tree_small", lambda: prop_tree(False)), ("bush", prop_bush),
         ("rock", prop_rock), ("cloud", prop_cloud), ("sign", prop_sign),
         ("torch", prop_torch), ("tuft", prop_grass_tuft)]


# ------------------------------------------------------------- backgrounds --
def bg_far(w=320, h=256):
    c = Canvas(w, h)
    for y in range(h):
        t = y / h
        if t < 0.62:
            k = t / 0.62
            col = tuple(int(C["sky_top"][i] + (C["sky_mid"][i] - C["sky_top"][i]) * k) for i in range(3))
        else:
            k = (t - 0.62) / 0.38
            col = tuple(int(C["sky_mid"][i] + (C["sky_low"][i] - C["sky_mid"][i]) * k) for i in range(3))
        c.box(0, y, w - 1, y, col + (255,))
    # stars up high
    for _ in range(64):
        x, y = random.randrange(w), random.randrange(int(h * 0.55))
        put(c.img, x, y, (255, 255, 255, random.choice((90, 140, 200))))
    # moon
    c.disc(258, 46, 15, rgb("#fff2cf", 235))
    c.disc(258, 50, 13, rgb("#ffeeba", 255))           # soft lower shading
    c.disc(252, 41, 3.0, rgb("#f6dfa4", 255))          # craters
    c.disc(263, 54, 2.0, rgb("#f6dfa4", 255))
    c.disc(262, 38, 1.5, rgb("#f6dfa4", 255))
    # far hills (two ridges, drawn as overlapping domes)
    for ridge, (base, col, half) in enumerate(((196, C["hill_far"], 46), (214, C["hill_far2"], 34))):
        x = -20
        while x < w + 40:
            rw = random.randint(half - 12, half + 10)
            rh = random.randint(16, 30) + ridge * 6
            c.ellipse(x, base - rh // 2, rw, rh, col[:3] + (255,))
            x += rw + random.randint(6, 20)
        c.box(0, base, w - 1, h - 1, col[:3] + (255,))
    return c


def bg_mid(w=320, h=256):
    c = Canvas(w, h)
    base = 214
    # near hills
    x = -30
    while x < w + 40:
        rw = random.randint(26, 52)
        rh = random.randint(22, 44)
        c.ellipse(x, base - rh // 2, rw, rh, C["hill_mid"][:3] + (255,))
        c.ellipse(x - rw * 0.3, base - rh // 2 - rh * 0.2, rw * 0.6, rh * 0.5, C["hill_mid2"][:3] + (255,))
        x += rw + random.randint(4, 18)
    c.box(0, base, w - 1, h - 1, C["hill_mid"][:3] + (255,))
    # treeline silhouette along the top of the hills
    x = 0
    while x < w:
        tw = random.randint(10, 22)
        th = random.randint(12, 26)
        c.poly([(x, base), (x + tw // 2, base - th), (x + tw, base)], C["hill_mid2"][:3] + (255,))
        c.poly([(x + tw // 2, base - th), (x + tw, base), (x + tw // 2, base - th + 6)],
               C["hill_mid"][:3] + (255,))
        x += tw - random.randint(2, 5)
    c.box(0, base + 12, w - 1, h - 1, C["hill_mid2"][:3] + (255,))
    return c


def build(preview=None):
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
    os.makedirs(out, exist_ok=True)

    # --- tiles: 8 columns of 16x16
    tiles = [
        ("ground_top", tile_ground(("top", "left", "right"))),
        ("ground_top_l", tile_ground(("top", "left"))),
        ("ground_top_r", tile_ground(("top", "right"))),
        ("ground_top_m", tile_ground(("top",))),
        ("dirt", tile_ground(())),
        ("stone_top", tile_ground(("top",), "stone")),
        ("stone", tile_ground((), "stone")),
        ("wood", tile_ground((), "wood")),
        ("platform", tile_platform()),
        ("spikes", tile_spikes()),
        ("crate", tile_crate()),
        ("coin0", item_coin(0)), ("coin1", item_coin(1)), ("coin2", item_coin(2)), ("coin3", item_coin(3)),
        ("heart", item_heart()), ("potion", item_potion()),
    ]
    s = Sheet("tiles", (T, T), (T // 2, T - 1), layout="grid", cols=9)
    for name, img in tiles:
        s.add(name, [img], fps=1, loop=False)
    sheet, meta = s.save(out)
    if preview:
        s.preview(preview, zoom=6)

    # --- props: 32x32 cells
    ps = Sheet("props", (PR, PR), (PR // 2, PR - 1), layout="grid", cols=4)
    for name, fn in PROPS:
        ps.add(name, [fn()], fps=1, loop=False)
    ps.save(out)
    if preview:
        ps.preview(preview.replace(".png", "_props.png"), zoom=4)

    # --- parallax layers
    bg_far().img.save(os.path.join(out, "bg_far.png"))
    bg_mid().img.save(os.path.join(out, "bg_mid.png"))
    return sheet, meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", default=None)
    a = ap.parse_args()
    sheet, meta = build(a.preview)
    print("tiles:", sheet.size, len(meta["animations"]), "tiles | props + bg written")
