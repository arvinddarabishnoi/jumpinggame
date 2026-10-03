#!/usr/bin/env python3
"""
generate_hero.py - every frame of the player character ("Ravi the Ember
Knight") as hand-tuned poses, packed into:

    assets/hero.png   sprite sheet  (one row per animation)
    assets/hero.json  atlas: frame rects, fps, loop flag, foot anchor

Animations: idle run jump fall attack hurt land death
Run with:  python3 tools/generate_hero.py [--preview /tmp/hero.png]
"""
import argparse, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixel import Canvas, Sheet, rgb, shade, limb, lerp, put, Image

# ---------------------------------------------------------------- palette --
P = {
    "outline": rgb("#241a2e"),
    "skin": rgb("#ffd0a0"), "skin_sh": rgb("#eaa06c"), "skin_dk": rgb("#c67c4c"),
    "blush": rgb("#f09a8a"),
    "hair": rgb("#4a2b34"), "hair_hi": rgb("#6b3f45"),
    "hood": rgb("#e44f39"), "hood_sh": rgb("#a52f1c"), "hood_hi": rgb("#ff8b68"),
    "tunic": rgb("#2fae95"), "tunic_sh": rgb("#1a6c5e"), "tunic_hi": rgb("#6cdcc0"),
    "pants": rgb("#3b4266"), "pants_sh": rgb("#272c47"),
    "boot": rgb("#7a5233"), "boot_sh": rgb("#4a3020"), "boot_hi": rgb("#a5744a"),
    "belt": rgb("#f5c243"), "belt_sh": rgb("#bb8a1c"),
    "steel": rgb("#f2f7ff"), "steel_sh": rgb("#b3c2de"), "steel_dk": rgb("#6f7fa6"),
    "gold": rgb("#ffd34d"), "gold_sh": rgb("#c9922a"),
    "fx": rgb("#fff6cf"), "fx2": rgb("#ffd76a"), "fx3": rgb("#ff9a3c"),
    "eye": rgb("#2b2338"), "white": rgb("#ffffff"), "mouth": rgb("#9c5560"),
}

def ik2(origin, target, l0, l1, bend=1.0):
    """Two-bone IK: returns (a0, a1) angles that put the hand/foot on target.
    `bend` picks which side the elbow/knee pops out (+1 = backwards)."""
    dx, dy = target[0] - origin[0], target[1] - origin[1]
    d = math.hypot(dx, dy)
    d = max(abs(l0 - l1) + 0.01, min(d, (l0 + l1) * 0.999))
    base = math.degrees(math.atan2(dx, dy))            # 0 = straight down
    cosA = max(-1.0, min(1.0, (l0 * l0 + d * d - l1 * l1) / (2 * l0 * d)))
    a0 = base + bend * math.degrees(math.acos(cosA))
    j = (origin[0] + math.sin(math.radians(a0)) * l0,
         origin[1] + math.cos(math.radians(a0)) * l0)
    a1 = math.degrees(math.atan2(target[0] - j[0], target[1] - j[1]))
    return a0, a1


CELL = 48
CX, GROUND = 22, 42          # cell centre-x, foot line (sprite pixels)
HR = 4.7                     # head radius
LEG = 4.8                    # thigh / shin length


# ------------------------------------------------------------- body paint --
def torso(L, hip, top, w=10, pal=P):
    """Body from hip to shoulder. Works at any angle, so the same function
    draws the upright idle and the hero lying flat on his back."""
    hw = w / 2
    dx, dy = top[0] - hip[0], top[1] - hip[1]
    ln = math.hypot(dx, dy) or 1.0
    u = (dx / ln, dy / ln)                       # along the body, hip -> chest
    n = (-u[1], u[0])                            # across the body (front side)
    L.capsule(hip, top, pal["tunic"], hw)
    L.disc(top[0], top[1], hw, pal["tunic"])     # shoulder cap
    # collar across the shoulders
    c = (top[0] - u[0] * 1.2, top[1] - u[1] * 1.2)
    L.capsule((c[0] - n[0] * (hw - 1.2), c[1] - n[1] * (hw - 1.2)),
              (c[0] + n[0] * (hw - 1.2), c[1] + n[1] * (hw - 1.2)), pal["tunic_sh"], 0.7)
    # hem shadow across the hips
    b0 = (hip[0] - u[0] * 0.8, hip[1] - u[1] * 0.8)
    L.capsule((b0[0] - n[0] * (hw - 1.5), b0[1] - n[1] * (hw - 1.5)),
              (b0[0] + n[0] * (hw - 1.5), b0[1] + n[1] * (hw - 1.5)), pal["tunic_sh"], 0.8)
    # belt + buckle across the waist
    wb = (hip[0] - u[0] * 1.6, hip[1] - u[1] * 1.6)
    L.capsule((wb[0] - n[0] * hw, wb[1] - n[1] * hw),
              (wb[0] + n[0] * hw, wb[1] + n[1] * hw), pal["belt"], 1.0)
    L.capsule((wb[0] - n[0] * hw, wb[1] - n[1] * hw + 0.9),
              (wb[0] + n[0] * hw, wb[1] + n[1] * hw + 0.9), pal["belt_sh"], 0.4)
    bk = (wb[0] + n[0] * 1.4, wb[1] + n[1] * 1.4)
    L.box(bk[0] - 1.1, bk[1] - 1.1, bk[0] + 1.1, bk[1] + 1.1, pal["gold"])
    put(L.img, int(bk[0] - 0.5), int(bk[1] - 0.5), pal["fx"])
    # back-edge shading + chest highlight
    L.capsule((hip[0] - n[0] * 0.4, hip[1] - n[1] * 0.4),
              (top[0] - n[0] * 0.4, top[1] - n[1] * 0.4), pal["tunic_sh"], 0.9)
    L.capsule((top[0] + n[0] * 1.4 + u[0] * 1.6, top[1] + n[1] * 1.4 + u[1] * 1.6),
              (top[0] + n[0] * 1.6 + u[0] * 4.6, top[1] + n[1] * 1.6 + u[1] * 4.6),
              pal["tunic_hi"], 0.6)


def scarf(L, neck, t=0.0, pal=P):
    wag = math.sin(t * math.pi * 2) * 1.5
    L.ellipse(neck[0], neck[1] + 0.8, 4.6, 2.0, pal["hood"])
    L.box(neck[0] - 4.6, neck[1] + 1.6, neck[0] + 4.6, neck[1] + 2.4, pal["hood_sh"])
    L.box(neck[0] - 2.6, neck[1] - 0.2, neck[0] + 2.6, neck[1] + 0.6, pal["hood_hi"])
    p0 = (neck[0] - 4.2, neck[1] + 0.8)
    p1 = (p0[0] - 3.6, p0[1] + 0.6 + wag * 0.5)
    p2 = (p1[0] - 3.2, p1[1] - 0.6 - wag)
    L.capsule(p0, p1, pal["hood"], 1.6)
    L.poly([(p1[0] + 1, p1[1] - 1.5), (p2[0] - 2.2, p2[1] + wag * 0.8),
            (p1[0] + 0.5, p1[1] + 1.8)], pal["hood_sh"])


def _face_side(L, cx, cy, blink, pal):
    """Eyes / nose / mouth.  Face box is roughly x in [cx-2.5, cx+4.3],
    y in [cy-2.6, cy+3.4]; eyes are deliberately tiny (1x2 px) so they read
    as eyes and not as a mask."""
    L.box(cx + 3.9, cy + 0.6, cx + 4.4, cy + 1.8, pal["skin_sh"])    # nose
    L.box(cx + 4.0, cy + 0.4, cx + 4.4, cy + 0.9, pal["skin"])
    if blink:
        L.box(cx + 0.3, cy + 0.5, cx + 1.3, cy + 1.0, pal["eye"])
        L.box(cx + 2.7, cy + 0.4, cx + 3.7, cy + 0.9, pal["eye"])
    else:
        L.box(cx + 0.3, cy - 0.3, cx + 1.3, cy + 1.6, pal["eye"])
        L.box(cx + 2.7, cy - 0.4, cx + 3.7, cy + 1.4, pal["eye"])
        put(L.img, int(cx + 0.3), int(cy - 0.3), pal["white"])
        put(L.img, int(cx + 2.7), int(cy - 0.4), pal["white"])
    put(L.img, int(cx + 1.6), int(cy + 2.9), pal["mouth"])           # mouth
    put(L.img, int(cx + 2.1), int(cy + 2.9), pal["mouth"])
    put(L.img, int(cx + 3.6), int(cy + 2.2), pal["blush"])


def _face_front(L, cx, cy, blink, pal):
    if blink:
        L.box(cx - 2.7, cy + 0.8, cx - 1.7, cy + 1.3, pal["eye"])
        L.box(cx + 1.7, cy + 0.8, cx + 2.7, cy + 1.3, pal["eye"])
    else:
        for ex in (-2.8, 1.8):
            L.box(cx + ex, cy + 0.0, cx + ex + 1.0, cy + 1.8, pal["eye"])
            put(L.img, int(cx + ex), int(cy + 0.0), pal["white"])
    put(L.img, int(cx - 0.5), int(cy + 3.0), pal["mouth"])
    put(L.img, int(cx + 0.5), int(cy + 3.0), pal["mouth"])
    put(L.img, int(cx - 3.4), int(cy + 2.4), pal["blush"])
    put(L.img, int(cx + 2.4), int(cy + 2.4), pal["blush"])


def head(L, c, face="side", tilt=0.0, blink=False, pal=P):
    """Chibi head: hood drape behind, dark hair, big readable face with tiny
    eyes, red hood crown + bright rim on top."""
    cx = c[0] + tilt * 0.5
    cy = c[1]
    if face == "side":
        # hood drape + pointed tip trailing behind the head
        L.poly([(cx - 3.4, cy - 3.6), (cx - 7.4, cy + 3.4), (cx - 1.8, cy + 3.4)], pal["hood_sh"])
        L.poly([(cx - 3.0, cy - 3.8), (cx - 6.0, cy + 2.6), (cx - 2.2, cy + 2.6)], pal["hood"])
        # hair mass + lighter crown
        L.ellipse(cx - 0.3, cy - 0.2, 4.3, 4.3, pal["hair"])
        L.ellipse(cx - 1.7, cy - 1.6, 3.3, 3.2, pal["hair_hi"])
        # face
        L.ellipse(cx + 0.9, cy + 0.9, 3.5, 3.2, pal["skin"])
        L.ellipse(cx + 1.1, cy + 1.1, 3.1, 2.8, pal["skin"])
        L.arc(cx + 0.9, cy + 1.0, 3.4, 40, 150, pal["skin_sh"], 1.0)
        # fringe: two hair teeth over the brow
        L.poly([(cx - 0.7, cy - 2.7), (cx + 1.7, cy - 0.7), (cx - 1.0, cy + 0.1)], pal["hair"])
        L.poly([(cx - 2.8, cy - 2.2), (cx - 0.7, cy - 0.3), (cx - 3.1, cy + 0.3)], pal["hair"])
        # hood crown over the hair, stopping at the brow
        L.arc(cx - 0.3, cy - 0.2, 4.7, 184, 346, pal["hood"], 2.0)
        L.arc(cx - 0.3, cy - 0.4, 4.8, 208, 332, pal["hood_hi"], 0.7)
        L.arc(cx - 0.3, cy - 0.2, 4.7, 184, 250, pal["hood_sh"], 1.0)
        L.box(cx - 5.0, cy - 2.2, cx - 3.6, cy + 0.2, pal["hood"])   # crown meets the drape
        _face_side(L, cx, cy, blink, pal)
    else:
        L.ellipse(cx, cy - 0.2, 4.4, 4.4, pal["hair"])
        L.ellipse(cx - 1.2, cy - 1.6, 3.2, 3.0, pal["hair_hi"])
        L.ellipse(cx, cy + 1.2, 3.5, 3.2, pal["skin"])
        L.ellipse(cx, cy + 1.3, 3.1, 2.9, pal["skin"])
        L.arc(cx, cy + 1.2, 3.4, 35, 145, pal["skin_sh"], 1.1)
        # fringe + hood ear flaps
        L.poly([(cx - 0.6, cy - 2.6), (cx + 0.8, cy - 1.0), (cx - 1.6, cy - 0.9)], pal["hair"])
        L.poly([(cx - 4.4, cy - 2.0), (cx - 6.6, cy - 3.6), (cx - 3.4, cy - 4.4)], pal["hood_sh"])
        L.poly([(cx + 4.4, cy - 2.0), (cx + 6.6, cy - 3.6), (cx + 3.4, cy - 4.4)], pal["hood_sh"])
        L.arc(cx, cy - 0.2, 4.8, 188, 352, pal["hood"], 2.0)
        L.arc(cx, cy - 0.4, 4.9, 210, 330, pal["hood_hi"], 0.7)
        _face_front(L, cx, cy, blink, pal)


def neck(L, neck_p, pal=P):
    L.box(neck_p[0] - 1.6, neck_p[1] - 1.4, neck_p[0] + 1.6, neck_p[1] + 1.4, pal["skin_sh"])


def arm(L, sh, a0, a1, pal=P, back=False):
    """Two-bone arm; returns the hand position."""
    j, hand = limb(sh, a0, a1, 4.3, 4.3)
    cu = pal["tunic_sh"] if back else pal["tunic"]
    sk = pal["skin_dk"] if back else pal["skin"]
    L.capsule(sh, j, cu, 2.1)
    L.disc(j[0], j[1], 1.9, cu)
    L.capsule(j, lerp(j, hand, 0.5), cu, 1.7)
    L.capsule(lerp(j, hand, 0.45), hand, sk, 1.5)
    L.disc(hand[0], hand[1], 1.8, sk)
    if not back:
        L.capsule(lerp(sh, j, 0.25), lerp(sh, j, 0.75), pal["tunic_hi"], 0.6)
    return hand


def leg(L, hip, a0, a1, pal=P, back=False):
    """Two-bone leg + boot; returns the foot position."""
    knee, foot = limb(hip, a0, a1, LEG, LEG)
    pc = pal["pants_sh"] if back else pal["pants"]
    bc = pal["boot_sh"] if back else pal["boot"]
    L.capsule(hip, knee, pc, 2.4)
    L.disc(knee[0], knee[1], 2.2, pc)
    L.capsule(knee, foot, bc, 2.1)
    ang = math.atan2(foot[1] - knee[1], foot[0] - knee[0])
    tip = (foot[0] + math.cos(ang - math.radians(80)) * 3.4,
           foot[1] + math.sin(ang - math.radians(80)) * 3.4)
    L.capsule(foot, tip, bc, 1.8)
    L.disc(tip[0], tip[1], 1.6, bc)
    if not back:
        L.disc(tip[0] - 0.4, tip[1] - 0.5, 0.9, pal["boot_hi"])
    return foot


def sword(L, grip, angle, pal=P, length=16.0):
    """Straight sword; angle in degrees: 0 = tip up, 90 = tip forward,
    180 = tip down, 270 = tip backwards (for a right-facing character)."""
    u = (math.sin(math.radians(angle)), -math.cos(math.radians(angle)))
    n = (-u[1], u[0])
    guard = (grip[0] + u[0] * 3.0, grip[1] + u[1] * 3.0)
    tip = (grip[0] + u[0] * length, grip[1] + u[1] * length)
    mid = lerp(guard, tip, 0.55)
    near = lerp(guard, tip, 0.06)
    L.capsule(grip, (grip[0] - u[0] * 2.4, grip[1] - u[1] * 2.4), pal["boot_sh"], 1.3)
    L.disc(grip[0] - u[0] * 2.8, grip[1] - u[1] * 2.8, 1.2, pal["gold"])
    L.capsule((guard[0] - n[0] * 3.0, guard[1] - n[1] * 3.0),
              (guard[0] + n[0] * 3.0, guard[1] + n[1] * 3.0), pal["gold"], 1.2)
    L.capsule(near, mid, pal["steel"], 1.6)
    L.capsule(mid, tip, pal["steel"], 1.1)
    L.capsule(lerp(near, mid, 0.15), lerp(mid, tip, 0.85), pal["white"], 0.6)
    L.capsule((near[0] - n[0] * 1.0, near[1] - n[1] * 1.0),
              (mid[0] - n[0] * 0.9, mid[1] - n[1] * 0.9), pal["steel_dk"], 0.7)
    L.disc(tip[0], tip[1], 1.0, pal["white"])
    return tip


def slash(c, cx, cy, a0, a1, r, thick=2.0, col=P["fx"], core=P["fx2"], alpha=85):
    """Thin translucent crescent along a sword sweep on the fx layer.
    (cx, cy) is the shoulder the arc is centred on, r the blade radius."""
    layer = Canvas(c.w, c.h)
    steps = 30
    for i in range(steps + 1):
        t = i / steps
        a = math.radians(a0 + (a1 - a0) * t)
        rr = r * (0.84 + 0.16 * t)
        th = thick * (0.35 + 0.65 * math.sin(t * math.pi) ** 0.5)
        layer.disc(cx + math.cos(a) * rr, cy + math.sin(a) * rr,
                   max(0.6, th), core if i % 4 == 0 else col)
    layer.img.putalpha(layer.img.split()[3].point(lambda v: min(v, alpha)))
    c.img = Image.alpha_composite(c.img, layer.img)
    return c


def impact(c, x, y, r=4.0, col=P["fx"], core=P["fx3"]):
    layer = Canvas(c.w, c.h)
    layer.disc(x, y, r * 0.55, col)
    for a in range(0, 360, 45):
        ax = math.radians(a)
        layer.capsule((x + math.cos(ax) * r * 0.45, y + math.sin(ax) * r * 0.45),
                      (x + math.cos(ax) * r, y + math.sin(ax) * r), col, 0.8)
    layer.disc(x, y, r * 0.35, core)
    c.img = Image.alpha_composite(c.img, layer.img)
    return c


# --------------------------------------------------------------- the hero --
class Hero:
    def __init__(self, pal=P):
        self.p = pal

    def frame(self, pose):
        c = Canvas(CELL, CELL)
        p = self.p
        hip = pose.get("hip", (CX, GROUND - 10))
        lean = pose.get("lean", 0)
        top = pose.get("chest", (hip[0] + lean, hip[1] - 9))
        neck_p = pose.get("neck", (top[0] + lean * 0.3, top[1] - 2.0))
        head_c = pose.get("head", (neck_p[0] + 0.6, neck_p[1] - 5.0))
        t = pose.get("t", 0.0)
        fx = Canvas(CELL, CELL)
        back = pose.get("back", True)          # draw the far leg in shadow

        hipb = pose.get("hipb", (hip[0] - 1.3, hip[1]))
        hipf = pose.get("hipf", (hip[0] + 1.3, hip[1]))
        shb = pose.get("shb", (top[0] - 4.4, top[1] + 1.4))
        shf = pose.get("shf", (top[0] + 4.4, top[1] + 1.4))
        legb_a = ik2(hipb, pose["legb_to"], LEG, LEG, -1) if "legb_to" in pose else pose.get("legb", (8, 8))
        legf_a = ik2(hipf, pose["legf_to"], LEG, LEG, 1) if "legf_to" in pose else pose.get("legf", (8, 8))
        armb_a = ik2(shb, pose["armb_to"], 4.3, 4.3, -1) if "armb_to" in pose else pose.get("armb", (16, 20))
        armf_a = ik2(shf, pose["armf_to"], 4.3, 4.3, 1) if "armf_to" in pose else pose.get("armf", (16, 20))
        hand = limb(shf, armf_a[0], armf_a[1], 4.3, 4.3)[1]
        sw = pose.get("sword")
        grip = sw.get("grip", hand) if sw else None
        if sw and pose.get("sword_back"):
            sword(c, grip, sw["a"], pal=p, length=sw.get("len", 16))

        if back:
            leg(c, hipb, *legb_a, pal=p, back=True)
        arm(c, shb, *armb_a, pal=p, back=True)
        torso(c, hip, top, w=pose.get("w", 10), pal=p)
        neck(c, neck_p, pal=p)
        scarf(c, neck_p, t, pal=p)
        if pose.get("head_rot"):
            tmp = Canvas(CELL, CELL)
            head(tmp, (CELL / 2, CELL / 2), face=pose.get("face", "side"),
                 tilt=pose.get("tilt", 0.0), blink=pose.get("blink", False), pal=p)
            rot = tmp.img.rotate(pose["head_rot"], resample=Image.NEAREST)
            c.img.alpha_composite(rot, (int(head_c[0] - CELL / 2), int(head_c[1] - CELL / 2)))
        else:
            head(c, head_c, face=pose.get("face", "side"), tilt=pose.get("tilt", 0.0),
                 blink=pose.get("blink", False), pal=p)
        if back:
            leg(c, hipf, *legf_a, pal=p)
        arm(c, shf, *armf_a, pal=p)
        if sw and not pose.get("sword_back"):
            sword(c, grip, sw["a"], pal=p, length=sw.get("len", 16))

        for e in pose.get("fx", []):
            e(fx, c)
        return Image.alpha_composite(c.outline(p["outline"]), fx.img)


# ------------------------------------------------------------- animations --
GY = GROUND - 10                     # resting hip-height (32)
CHEST_D, NECK_D, HEAD_D = 9.0, 2.0, 5.0


def _rig(hip_x, hip_y, lean=0.0, **kw):
    """Common skeleton anchors derived from hip position + forward lean."""
    top = (hip_x + lean, hip_y - CHEST_D)
    neck_p = (top[0] + lean * 0.3, top[1] - NECK_D)
    head_c = (neck_p[0] + 0.6, neck_p[1] - HEAD_D)
    rig = dict(hip=(hip_x, hip_y), chest=top, neck=neck_p, head=head_c, lean=lean)
    rig.update(kw)
    return rig


def idle(h, n=4):
    """Breathing loop: chest lifts, scarf drifts, one blink."""
    out = []
    for i in range(n):
        k = math.sin(i / n * math.pi * 2)
        dy = round(-0.8 * max(0.0, k))
        out.append(h.frame(_rig(
            CX, GY + dy * 0.3, 0.4,
            t=i / n,
            legb=(7, 7), legf=(4, 5),
            armb=(12 + k * 3, 22 + k * 4),
            shf=(CX + 4.6, GY + dy - 7.2), armf=(56 - k * 2, 68 - k * 3),
            sword=dict(a=134 + k * 3, len=15),
            blink=(i == 2),
        )))
    return out


def run(h, n=8):
    """8-frame sprint: contact / down / pass / up, mirrored in the 2nd half."""
    keys = [  # back leg (thigh, shin), front leg, back arm, bounce
        (-46, -34,  50,  22,  64, -1.0),    # contact: legs split wide
        (-30, -56,  34,  56,  46,  1.5),    # down: absorb, lowest
        (  6,  30, -18,  34,  22, -1.0),    # pass: trailing leg folds under
        ( 38,  62, -44, -38, -20, -2.2),    # up: knee drives forward
        ( 50,  22, -46, -34, -72, -1.0),
        ( 34,  56, -30, -56, -50,  1.5),
        (-18,  34,   6,  30, -26, -1.0),
        (-44, -38,  38,  62,  20, -2.2),
    ]
    out = []
    for i, (b0, b1, f0, f1, ab, dy) in enumerate(keys):
        lean = 2.0
        hy = GY + dy
        out.append(h.frame(_rig(
            CX + 1.6, hy, lean,
            t=i / n,
            hipb=(CX + 0.3, hy), legb=(b0, b1),
            hipf=(CX + 3.0, hy), legf=(f0, f1),
            shb=(CX - 2.4 + lean, hy - 7.4), armb=(ab * 0.55, ab * 0.75 + 8),
            shf=(CX + 6.6 + lean, hy - 7.4), armf=(62 - ab * 0.16, 66 - ab * 0.18),
            sword=dict(a=300 + ab * 0.10, len=14),
            face="side",
        )))
    return out


def jump(h, n=3):
    """Launch -> rise -> apex, knees tucked and the blade punched up-forward."""
    out = []
    for i in range(n):
        up = i / (n - 1)
        hy = GY - up * 1.2
        out.append(h.frame(_rig(
            CX + 0.6, hy, 1.0 + up * 0.6,
            t=i / n,
            hipb=(CX, hy), legb=(-16 - up * 22, 28 + up * 20),
            hipf=(CX + 2.8, hy), legf=(28 + up * 18, 10 + up * 14),
            shb=(CX - 2.2, hy - 7.4), armb=(-58 - up * 32, -40 - up * 24),
            shf=(CX + 6.2, hy - 7.4),
            armf_to=(CX + 7.5 + up * 1.5, hy - 5.5 - up * 3.5),
            sword=dict(a=6 + up * 20, len=15), sword_back=True,
        )))
    return out


def fall(h, n=3):
    """Airborne flail: arms up, legs trailing."""
    out = []
    for i in range(n):
        k = 1 if i == 1 else -1
        hy = GY
        out.append(h.frame(_rig(
            CX, hy, -0.8,
            t=i / n,
            hipb=(CX - 0.6, hy), legb=(-36 + k * 8, -16 + k * 14),
            hipf=(CX + 2.0, hy), legf=(14 - k * 10, 30 - k * 10),
            shb=(CX - 2.8, hy - 7.4), armb=(-106 + k * 10, -90 + k * 12),
            shf=(CX + 6.4, hy - 7.4), armf=(126 - k * 12, 150 - k * 10),
            sword=dict(a=-116 + k * 12, len=16),
        )))
    return out


def attack(h, n=6):
    """Wind-up -> three slash frames carrying a crescent arc -> recover."""
    keys = [
        dict(hand=(24.5, 16.0), sw=-30, arc=None, back=True, a=0.6),  # wind up over the shoulder
        dict(hand=(29.5, 12.5), sw=62,  arc=(258, 322), r=15, a=0.8), # downward chop
        dict(hand=(30.5, 22.0), sw=104, arc=(324, 36),  r=17, a=0.5), # horizontal cut
        dict(hand=(30.0, 26.0), sw=141, arc=(36, 100),  r=16, a=0.85),# cut through, low
        dict(hand=(28.5, 24.5), sw=168, arc=None, a=1.0),             # blade low, follow through
        dict(hand=(30.5, 21.0), sw=76,  arc=None, a=1.0),             # back to guard
    ]
    lean = (0.4, 1.0, 1.6, 2.0, 1.6, 0.8)
    out = []
    for i, k in enumerate(keys):
        hy = GY + (0, 1, 0.5, 1, 0.5, 0)[i]
        chest_y = hy - CHEST_D
        hand = k["hand"]
        a = k["sw"]
        u = (math.sin(math.radians(a)), -math.cos(math.radians(a)))
        grip = (hand[0] + u[0] * 1.4, hand[1] + u[1] * 1.4)
        fx = []
        if k.get("arc"):
            a0, a1 = k["arc"]
            rr, alpha = k["r"], k.get("a", 0.8)
            fx.append(lambda c, b, a0=a0, a1=a1, rr=rr, alpha=alpha: slash(
                c, CX + 4.5, chest_y + 2.0, a0, a1, rr, 2.0,
                P["fx"], P["fx2"], int(95 * alpha)))
        out.append(h.frame(_rig(
            CX, hy, lean[i],
            t=i / 6,
            legb=(-16, 18), legf=(22, 14),
            shb=(CX + lean[i] - 4.6, chest_y + 1.6),
            armb_to=(CX + lean[i] - 7.0, chest_y + 6.5),
            shf=(CX + lean[i] + 5.2, chest_y + 1.6),
            armf_to=hand,
            sword=dict(a=a, grip=grip, len=16),
            sword_back=k.get("back", False),
            fx=fx,
        )))
    return out


def hurt(h, n=3):
    """Knocked backwards, feet off the floor, dazed front-facing grimace."""
    out = []
    for i in range(n):
        k = i / max(1, n - 1)
        hy = GY - 1.0
        out.append(h.frame(dict(
            t=i / n, face="front", tilt=-1.4, blink=True,
            hip=(CX - 2.5 - k * 1.5, hy),
            chest=(CX - 5.5 - k * 2, hy - 8.5),
            neck=(CX - 6.5 - k * 2, hy - 10.2),
            head=(CX - 6.6 - k * 2.2, hy - 14.6),
            legb=(38 + k * 12, -20 - k * 12), legf=(56 + k * 12, -4 - k * 10),
            hipb=(CX - 3.5, hy), hipf=(CX - 1.5, hy),
            shb=(CX - 7 - k, hy - 7.2), armb=(-92 - k * 12, -66 - k * 14),
            shf=(CX - 1 - k, hy - 7.2), armf=(122 + k * 12, 146 + k * 10),
            sword=dict(a=-100 - k * 12, len=16),
            fx=[lambda c, b: impact(b, CX - 6, hy - 11, 2.6, P["fx2"], P["fx3"])] if i == 0 else [],
        )))
    return out


def land(h, n=2):
    """Touchdown squash -> push back up, feet planted wide."""
    out = []
    for i in range(n):
        sq = 1 - i * 0.6
        hy = GY + 1.2 + i * 1.0
        out.append(h.frame(_rig(
            CX, hy, 1.2 - i * 0.4,
            t=i / n,
            hipb=(CX - 1.4, hy), legb_to=(CX - 5.5 - sq, GROUND - 0.4),
            hipf=(CX + 1.4, hy), legf_to=(CX + 6.5 - sq, GROUND - 0.4),
            shb=(CX - 2.6, hy - 7.2),
            armb_to=(CX - 6.5, hy - 3.5), 
            shf=(CX + 6.0, hy - 7.0),
            armf_to=(CX + 8.5 + sq, hy - 3.0),
            sword=dict(a=202 - sq * 16, len=15), sword_back=True,
        )))
    return out


def death(h, n=6):
    """Knocked off his feet: stagger back, drop, land flat on his back with
    his legs in the air, then settle.  The head is drawn rotated for this."""
    keys = [
        # hip, chest, head, head rotation, feet (back, front), hands (back, swipe)
        dict(hip=(22.0, 32.5), chest=(19.5, 24.5), head=(19.0, 20.0), rot=-22,
             foot=((16.5, 42), (26.5, 42)), hands=((17.5, 22.0), (28.5, 20.5)),
             sw=150, sw_len=13, spark=True),
        dict(hip=(21.5, 34.8), chest=(18.8, 28.2), head=(17.6, 23.8), rot=-46,
             foot=((16.5, 42), (26.0, 42)), hands=((16.0, 24.5), (27.0, 24.5)),
             sw=160, sw_len=13),
        dict(hip=(25.0, 37.6), chest=(19.5, 33.6), head=(16.6, 28.6), rot=-68,
             foot=((31.5, 36.5), (32.5, 40.0)), hands=((18.0, 27.5), (27.5, 27.0)),
             sw=176, sw_len=13),
        dict(hip=(29.5, 39.0), chest=(22.0, 38.6), head=(16.6, 37.4), rot=64,
             foot=((35.5, 34.5), (33.5, 37.0)), hands=((21.5, 34.0), (29.0, 33.0)),
             sw=120, sw_len=13),
        dict(hip=(30.0, 38.6), chest=(21.5, 38.2), head=(14.6, 37.6), rot=88,
             foot=((36.5, 41.4), (34.5, 41.8)), hands=((23.5, 33.5), (33.0, 39.8)),
             sw=98, sw_len=13),
        dict(hip=(30.0, 38.8), chest=(21.5, 38.3), head=(14.4, 37.6), rot=90,
             foot=((36.8, 41.6), (34.8, 42.0)), hands=((23.0, 33.2), (33.2, 39.9)),
             sw=96, sw_len=13),
    ]
    out = []
    for i, k in enumerate(keys):
        hip, chest, head_c = k["hip"], k["chest"], k["head"]
        neck = ((chest[0] + head_c[0]) / 2, (chest[1] + head_c[1]) / 2)
        fx = []
        if k.get("spark"):
            fx.append(lambda c, b: impact(b, k["chest"][0] - 5.5, k["chest"][1] - 4.5, 2.6,
                                          P["fx2"], P["fx3"]))
        out.append(h.frame(dict(
            t=i / n, face="front", tilt=-1.0, blink=(i > 0),
            hip=hip, chest=chest, neck=neck, head=head_c, head_rot=k["rot"],
            hipb=(hip[0] - 1.6, hip[1]), hipf=(hip[0] + 1.6, hip[1]),
            legb_to=k["foot"][0], legf_to=k["foot"][1],
            shb=(chest[0] - 3.0, chest[1] + 1.2), shf=(chest[0] + 3.6, chest[1] + 1.4),
            armb_to=k["hands"][0], armf_to=k["hands"][1],
            sword=dict(a=k["sw"], len=k["sw_len"]),
            fx=fx,
        )))
    return out


ANIMS = dict(idle=(idle, 7, True), run=(run, 13, True), jump=(jump, 12, False),
             fall=(fall, 8, True), attack=(attack, 17, False), hurt=(hurt, 9, False),
             land=(land, 14, False), death=(death, 8, False))


def build(preview=None, strip=None, zoom=8):
    h = Hero()
    s = Sheet("hero", (CELL, CELL), (CX, GROUND))
    for name, (fn, fps, loop) in ANIMS.items():
        s.add(name, fn(h), fps=fps, loop=loop)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
    sheet, meta = s.save(out)
    if preview:
        s.preview(preview, zoom=4)
    if strip:
        frames = ANIMS[strip][0](h)
        img = Image.new("RGBA", (CELL * len(frames), CELL), (58, 46, 74, 255))
        for i, f in enumerate(frames):
            img.alpha_composite(f, (i * CELL, 0))
            img.paste((120, 100, 160, 255), (i * CELL + CELL - 1, 0, i * CELL + CELL, CELL))
        img = img.resize((img.width * zoom, img.height * zoom), Image.NEAREST)
        img.save("/tmp/strip.png")
    return sheet, meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", default=None)
    ap.add_argument("--strip", default=None, help="render one animation huge")
    ap.add_argument("--zoom", type=int, default=8)
    a = ap.parse_args()
    sheet, meta = build(a.preview, a.strip, a.zoom)
    print("hero sheet:", sheet.size, "| animations:",
          {k: len(v["frames"]) for k, v in meta["animations"].items()})
