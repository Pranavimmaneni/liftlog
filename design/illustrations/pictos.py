"""Pictogram rig for LiftLog exercise illustrations.

1970s Olympic-pictogram language: thick round-capped strokes, detached head,
paper-coloured halos to separate overlapping limbs. Each exercise = static
equipment + ghost start pose + solid end pose + motion arrow.
"""
import math

INK = "#1D1B18"
EQUIP = "#8E7F66"
EQUIP_D = "#6B604E"
GHOST = "#CDBFA3"
RED = "#9E2B25"
FLOOR = "#C9BA9C"
FAR = "#4A443B"
PANEL_BG = "#EDE3CF"

L = dict(torso=46, ua=27, fa=25, th=34, sh=33, foot=10)
W = dict(torso=19, ua=11, fa=10, th=14, sh=12, foot=8)
HEAD_R = 10.5
HEAD_GAP = 17
SHOULDER_AT = 42


def v(a, n):
    r = math.radians(a)
    return (n * math.cos(r), n * math.sin(r))


def add(p, q):
    return (p[0] + q[0], p[1] + q[1])


def pose(p, anchor=("hip", (0, 0))):
    """p: dict of absolute segment directions in degrees (0=right, 90=down)."""
    j = {}
    j["hip"] = (0.0, 0.0)
    j["neck"] = add(j["hip"], v(p["torso"], L["torso"]))
    j["head"] = add(j["neck"], v(p["torso"], HEAD_GAP))
    j["shoulder"] = add(j["hip"], v(p["torso"], SHOULDER_AT))
    j["elbow"] = add(j["shoulder"], v(p["ua"], L["ua"]))
    j["hand"] = add(j["elbow"], v(p["fa"], L["fa"]))
    j["knee"] = add(j["hip"], v(p["th"], L["th"]))
    j["ankle"] = add(j["knee"], v(p["sh"], L["sh"]))
    j["toe"] = add(j["ankle"], v(p.get("foot", 0), L["foot"]))
    if "ua2" in p:
        j["elbow2"] = add(j["shoulder"], v(p["ua2"], L["ua"]))
        j["hand2"] = add(j["elbow2"], v(p["fa2"], L["fa"]))
    if "th2" in p:
        j["knee2"] = add(j["hip"], v(p["th2"], L["th"]))
        j["ankle2"] = add(j["knee2"], v(p["sh2"], L["sh"]))
        j["toe2"] = add(j["ankle2"], v(p.get("foot2", 0), L["foot"]))
    name, target = anchor
    off = (target[0] - j[name][0], target[1] - j[name][1])
    return {k: add(q, off) for k, q in j.items()}


def f(n):
    return f"{n:.1f}".rstrip("0").rstrip(".")


def seg(a, b, w, color, halo=None):
    out = ""
    d = f"M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}"
    if halo:
        out += f'<path d="{d}" stroke="{halo}" stroke-width="{f(w + 5)}" stroke-linecap="round"/>'
    out += f'<path d="{d}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>'
    return out


def poly(pts, w, color, halo=None):
    d = "M" + "L".join(f"{f(x)} {f(y)}" for x, y in pts)
    out = ""
    if halo:
        out += f'<path d="{d}" stroke="{halo}" stroke-width="{f(w + 5)}" stroke-linecap="round" stroke-linejoin="round"/>'
    out += f'<path d="{d}" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'
    return out


def figure(j, color, bg, feet=True, near_arm_halo=True):
    s = ""
    far = FAR if color == INK else color
    if "knee2" in j:
        s += poly([j["hip"], j["knee2"], j["ankle2"]], W["sh"], far)
        if feet:
            s += seg(j["ankle2"], j["toe2"], W["foot"], far)
    if "elbow2" in j:
        s += poly([j["shoulder"], j["elbow2"], j["hand2"]], W["fa"], far)
    s += seg(j["hip"], j["neck"], W["torso"], color)
    s += f'<circle cx="{f(j["head"][0])}" cy="{f(j["head"][1])}" r="{HEAD_R}" fill="{color}"/>'
    s += seg(j["hip"], j["knee"], W["th"], color)
    s += seg(j["knee"], j["ankle"], W["sh"], color)
    if feet:
        s += seg(j["ankle"], j["toe"], W["foot"], color)
    s += poly([j["shoulder"], j["elbow"], j["hand"]], W["ua"], color, halo=bg if near_arm_halo else None)
    return s


# ---------- equipment ----------

def line(a, b, w, color=None, cap="round"):
    color = color or EQUIP
    return f'<path d="M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}" stroke="{color}" stroke-width="{w}" stroke-linecap="{cap}"/>'


def dumbbell(c, color=None, bg=None, ang=0):
    color = color or INK
    x, y = c
    r = math.radians(ang)
    ux, uy = math.cos(r), math.sin(r)
    s = ""
    a = (x - 11 * ux, y - 11 * uy)
    b = (x + 11 * ux, y + 11 * uy)
    if bg:
        s += line(a, b, 17, bg)
    s += line(a, b, 4, color)
    for k in (-10, 10):
        p = (x + k * ux, y + k * uy)
        s += line((p[0] - 0.1 * ux, p[1] - 0.1 * uy), (p[0] + 0.1 * ux, p[1] + 0.1 * uy), 13, color, cap="round")
        s += line((p[0] - 2.2 * ux, p[1] - 2.2 * uy), (p[0] + 2.2 * ux, p[1] + 2.2 * uy), 13, color, cap="butt")
    return s


def plate(c, r=17, color=None, bg=None):
    color = color or INK
    bg = bg or PANEL_BG
    x, y = c
    return (f'<circle cx="{f(x)}" cy="{f(y)}" r="{r + 2.5}" fill="{bg}"/>'
            f'<circle cx="{f(x)}" cy="{f(y)}" r="{r}" fill="{color}"/>'
            f'<circle cx="{f(x)}" cy="{f(y)}" r="{r - 5}" fill="none" stroke="{bg}" stroke-width="1.4" opacity=".55"/>'
            f'<circle cx="{f(x)}" cy="{f(y)}" r="3" fill="{bg}"/>')


def stack(x, y, w, h, color=None):
    color = color or EQUIP
    s = f'<rect x="{f(x)}" y="{f(y)}" width="{w}" height="{h}" rx="2" fill="none" stroke="{color}" stroke-width="3"/>'
    yy = y + h - 7
    n = 0
    while yy > y + h * 0.45 and n < 12:
        s += line((x + 4, yy), (x + w - 4, yy), 3.2, color, cap="butt")
        yy -= 6
        n += 1
    s += f'<circle cx="{f(x + w - 6)}" cy="{f(y + h - 7 - 6 * 3)}" r="2.6" fill="{RED}"/>'
    return s


def pulley(c, color=None):
    color = color or EQUIP_D
    return f'<circle cx="{f(c[0])}" cy="{f(c[1])}" r="5.5" fill="{PANEL_BG}" stroke="{color}" stroke-width="3"/>'


def cable(a, b, color=None):
    color = color or EQUIP_D
    return line(a, b, 1.8, color)


def arrow(p0, p1, bulge=0, color=None, w=3.2):
    color = color or RED
    (x0, y0), (x1, y1) = p0, p1
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1
    nx, ny = -dy / ln, dx / ln
    cx, cy = mx + nx * bulge, my + ny * bulge
    tx, ty = x1 - cx, y1 - cy
    tl = math.hypot(tx, ty) or 1
    tx, ty = tx / tl, ty / tl
    hx, hy = x1 + tx * 3, y1 + ty * 3
    a1 = (hx - tx * 9 - ty * 5.5, hy - ty * 9 + tx * 5.5)
    a2 = (hx - tx * 9 + ty * 5.5, hy - ty * 9 - tx * 5.5)
    return (f'<path d="M{f(x0)} {f(y0)}Q{f(cx)} {f(cy)} {f(x1)} {f(y1)}" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-dasharray="1 6.5"/>'
            f'<path d="M{f(a1[0])} {f(a1[1])}L{f(hx)} {f(hy)}L{f(a2[0])} {f(a2[1])}Z" fill="{color}" stroke="{color}" stroke-width="2" stroke-linejoin="round"/>')


def floor(y=157, x0=14, x1=226):
    s = line((x0, y), (x1, y), 2.2, FLOOR, cap="butt")
    return s


# ---------- exercises ----------
# Each returns dict(back=, ghost=, solid=, front=, arrow=) layers.

def ex_incline_db_press(bg):
    base = dict(torso=-135, th=0, sh=90, foot=0)
    end = pose({**base, "ua": -74, "fa": -80}, ("hip", (118, 118)))
    st = pose({**base, "ua": 110, "fa": -80}, ("hip", (118, 118)))
    back = floor()
    back += line((104, 126.5), (72, 94.5), 9, EQUIP)            # incline pad
    back += line((100, 131), (140, 131), 8, EQUIP)               # seat
    back += line((108, 136), (100, 157), 5, EQUIP_D)
    back += line((136, 136), (144, 157), 5, EQUIP_D)
    back += line((84, 108), (88, 157), 5, EQUIP_D)
    ghost = figure(st, GHOST, bg) + dumbbell(st["hand"], GHOST)
    solid = figure(end, INK, bg) + dumbbell(end["hand"], INK, bg)
    arr = arrow((122, 86), (124, 46), bulge=-5)
    return back, ghost, solid, arr, end


def ex_seated_cable_row(bg):
    end = pose(dict(torso=-95, th=-15, sh=20, foot=-70, ua=120, fa=0), ("hip", (78, 122)))
    st = pose(dict(torso=-72, th=-15, sh=20, foot=-70, ua=8, fa=8), ("hip", (78, 122)))
    back = floor()
    back += f'<rect x="170" y="26" width="16" height="131" rx="2" fill="none" stroke="{EQUIP}" stroke-width="3"/>'
    back += stack(172, 60, 12, 88)
    back += line((44, 133), (128, 133), 8, EQUIP)
    back += line((52, 137), (52, 157), 5, EQUIP_D)
    back += line((120, 137), (120, 157), 5, EQUIP_D)
    back += line((152, 104), (152, 134), 6, EQUIP_D)            # footplate
    back += line((152, 134), (170, 134), 4, EQUIP_D)
    back += pulley((164, 118))
    handle = lambda p, c: line((p[0] + 4, p[1] - 6), (p[0] + 4, p[1] + 6), 5, c)
    ghost = cable(add(st["hand"], (4, 0)), (164, 118), GHOST) + figure(st, GHOST, bg) + handle(st["hand"], GHOST)
    solid = cable(add(end["hand"], (4, 0)), (164, 118)) + figure(end, INK, bg) + handle(end["hand"], INK)
    arr = arrow((136, 70), (104, 78), bulge=6)
    return back, ghost, solid, arr, end


def ex_machine_shoulder_press(bg):
    base = dict(torso=-90, th=0, sh=90, foot=0)
    end = pose({**base, "ua": -62, "fa": -84}, ("hip", (116, 120)))
    st = pose({**base, "ua": 70, "fa": -96}, ("hip", (116, 120)))
    back = floor()
    back += stack(30, 50, 24, 100)
    back += line((42, 50), (42, 20), 4, EQUIP_D)
    back += line((42, 20), (78, 20), 4, EQUIP_D)
    back += line((78, 22), (78, 157), 5, EQUIP_D)               # post
    back += line((98, 70), (98, 124), 9, EQUIP)                 # back pad
    back += line((100, 131), (138, 131), 8, EQUIP)              # seat
    back += line((116, 136), (116, 157), 5, EQUIP_D)
    ghost = line((78, 26), st["hand"], 5, GHOST) + figure(st, GHOST, bg)
    solid = line((78, 26), end["hand"], 5, EQUIP_D, cap="round") + figure(end, INK, bg)
    solid += line(add(end["hand"], (-7, 0)), add(end["hand"], (7, 0)), 6, INK)
    ghost += line(add(st["hand"], (-7, 0)), add(st["hand"], (7, 0)), 6, GHOST)
    arr = arrow((156, 80), (156, 36), bulge=-6)
    return back, ghost, solid, arr, end


def ex_lat_pulldown(bg):
    base = dict(torso=-97, th=0, sh=95, foot=0)
    end = pose({**base, "ua": 106, "fa": -68}, ("hip", (100, 120)))
    st = pose({**base, "ua": -82, "fa": -80}, ("hip", (100, 120)))
    back = floor()
    back += line((104, 12), (176, 12), 5, EQUIP_D)
    back += line((176, 12), (176, 157), 5, EQUIP_D)
    back += stack(182, 58, 20, 92)
    back += pulley((104, 12)) + pulley((176, 12))
    back += line((80, 129), (120, 129), 8, EQUIP)
    back += line((100, 133), (100, 157), 5, EQUIP_D)
    back += line((126, 104), (176, 104), 4, EQUIP_D)
    back += f'<circle cx="126" cy="102" r="6.5" fill="{EQUIP}"/>'

    def bar(p, c, halo=None):
        pts = [(p[0] - 24, p[1] + 5), (p[0] - 18, p[1]), (p[0] + 18, p[1]), (p[0] + 24, p[1] + 5)]
        return poly(pts, 4.5, c, halo=halo)
    ghost = cable(st["hand"], (104, 12), GHOST) + figure(st, GHOST, bg) + bar(st["hand"], GHOST)
    solid = cable(end["hand"], (104, 12)) + figure(end, INK, bg) + bar(end["hand"], INK, halo=bg)
    arr = arrow((140, 30), (140, 70), bulge=-6)
    return back, ghost, solid, arr, end


def ex_rope_pushdown(bg):
    base = dict(torso=-84, th=92, sh=90, foot=0, ua=93)
    end = pose({**base, "fa": 82}, ("ankle", (100, 150)))
    st = pose({**base, "fa": -38}, ("ankle", (100, 150)))
    back = floor()
    back += f'<rect x="160" y="10" width="16" height="147" rx="2" fill="none" stroke="{EQUIP}" stroke-width="3"/>'
    back += stack(162, 70, 12, 80)
    back += pulley((154, 18))

    def rope(p, c):
        return poly([(p[0] + 1, p[1] - 4), (p[0] + 5, p[1] + 5)], 4, c) + poly([(p[0] - 1, p[1] - 4), (p[0] - 5, p[1] + 5)], 4, c)
    ghost = cable(st["hand"], (154, 18), GHOST) + figure(st, GHOST, bg) + rope(st["hand"], GHOST)
    solid = cable(end["hand"], (154, 18)) + figure(end, INK, bg) + rope(end["hand"], INK)
    arr = arrow((140, 58), (128, 96), bulge=-10)
    return back, ghost, solid, arr, end


def ex_back_squat(bg):
    arms = dict(ua=128, fa=-40)
    st = pose(dict(torso=-88, th=90, sh=90, foot=0, **arms), ("ankle", (112, 150)))
    end = pose(dict(torso=-52, th=2, sh=106, foot=0, **arms), ("ankle", (112, 150)))
    back = floor()
    ghost = figure(st, GHOST, bg) + plate(add(st["neck"], (-2, 5)), r=15, color=GHOST, bg=bg)
    solid = figure(end, INK, bg) + plate(add(end["neck"], (-3, 6)), r=15, bg=bg)
    arr = arrow((66, 64), (60, 104), bulge=8)
    return back, ghost, solid, arr, end


def ex_rdl(bg):
    st = pose(dict(torso=-90, th=90, sh=90, foot=0, ua=92, fa=90), ("ankle", (100, 150)))
    end = pose(dict(torso=-24, th=66, sh=86, foot=0, ua=98, fa=98), ("ankle", (100, 150)))
    back = floor()
    ghost = figure(st, GHOST, bg) + plate(st["hand"], color=GHOST, bg=bg)
    solid = figure(end, INK, bg) + plate(end["hand"], bg=bg)
    arr = arrow((124, 22), (164, 56), bulge=-12)
    return back, ghost, solid, arr, end


def ex_leg_press(bg):
    end = pose(dict(torso=-150, th=-40, sh=-50, foot=-135, ua=60, fa=20), ("hip", (70, 124)))
    st = pose(dict(torso=-150, th=-82, sh=-10, foot=-135, ua=60, fa=20), ("hip", (70, 124)))
    back = floor()
    back += line((58, 136), (24, 116), 9, EQUIP)       # back pad
    back += line((58, 137), (84, 137), 8, EQUIP)       # seat
    back += line((64, 142), (64, 157), 5, EQUIP_D)
    back += line((32, 124), (32, 157), 5, EQUIP_D)
    back += line((96, 128), (180, 44), 5, EQUIP_D)      # rail
    back += line((150, 74), (176, 157), 4, EQUIP_D)
    back += line((96, 128), (96, 157), 4, EQUIP_D)

    def sled(a, c):
        ux, uy = 0.707, -0.707
        px, py = 0.707, 0.707
        cx, cy = a[0] + ux * 7, a[1] + uy * 7
        s = line((cx - px * 17, cy - py * 17), (cx + px * 17, cy + py * 17), 6, c)
        s += line((cx + ux * 6 + px * 4, cy + uy * 6 + py * 4), (cx + ux * 6 + px * 16, cy + uy * 6 + py * 16), 9, c)
        return s
    ghost = sled(st["ankle"], GHOST) + figure(st, GHOST, bg)
    solid = sled(end["ankle"], EQUIP_D) + figure(end, INK, bg)
    arr = arrow((92, 62), (118, 38), bulge=0)
    return back, ghost, solid, arr, end


def ex_leg_curl(bg):
    base = dict(torso=-96, th=0, foot=0, ua=80, fa=10)
    end = pose({**base, "sh": 122, "foot": 30}, ("hip", (96, 112)))
    st = pose({**base, "sh": 16, "foot": -70}, ("hip", (96, 112)))
    back = floor()
    back += line((78, 64), (78, 118), 9, EQUIP)          # back pad
    back += line((80, 123), (132, 123), 8, EQUIP)        # seat
    back += line((100, 128), (100, 157), 5, EQUIP_D)
    back += line((112, 100), (134, 100), 8, EQUIP)       # thigh pad
    back += line((134, 100), (150, 86), 4, EQUIP_D)
    back += line((150, 86), (150, 157), 5, EQUIP_D)
    knee = end["knee"]

    def roller(a, c, off):
        p = add(a, off)
        return line(knee, p, 4, c) + f'<circle cx="{f(p[0])}" cy="{f(p[1])}" r="7" fill="{c}"/>'
    ghost = roller(st["ankle"], GHOST, (-1, 10)) + figure(st, GHOST, bg)
    solid = figure(end, INK, bg) + roller(end["ankle"], EQUIP_D, (-9, 5))
    solid += f'<circle cx="{f(knee[0])}" cy="{f(knee[1])}" r="3.5" fill="{PANEL_BG}" stroke="{EQUIP_D}" stroke-width="2"/>'
    arr = arrow((176, 132), (138, 156), bulge=10)
    return back, ghost, solid, arr, end


def ex_pullup(bg):
    base = dict(torso=-90, th=108, sh=196, foot=100)
    st = pose({**base, "ua": -90, "fa": -90}, ("hand", (112, 32)))
    end = pose({**base, "ua": 100, "fa": -80}, ("hand", (112, 32)))
    back = line((30, 12), (210, 12), 5, EQUIP_D)
    back += line((112, 12), (112, 32), 3, EQUIP_D)
    ghost = figure(st, GHOST, bg)
    solid = figure(end, INK, bg)
    solid += f'<circle cx="112" cy="32" r="5" fill="{EQUIP_D}"/>'
    arr = arrow((158, 110), (158, 60), bulge=0)
    return back, ghost, solid, arr, end


EXERCISES = {
    "incline-db-press": ex_incline_db_press,
    "seated-cable-row": ex_seated_cable_row,
    "machine-shoulder-press": ex_machine_shoulder_press,
    "lat-pulldown": ex_lat_pulldown,
    "rope-pushdown": ex_rope_pushdown,
    "back-squat": ex_back_squat,
    "romanian-deadlift": ex_rdl,
    "leg-press": ex_leg_press,
    "seated-leg-curl": ex_leg_curl,
    "pull-up": ex_pullup,
}


def illustration(key, bg=None, ghost=True, arrow_on=True, width="100%", height=None, label=None, pad=0):
    bg = bg or PANEL_BG
    back, gh, solid, arr, _ = EXERCISES[key](bg)
    h = f' height="{height}"' if height else ""
    aria = label or key.replace("-", " ")
    body = back + (gh if ghost else "") + solid + (arr if arrow_on else "")
    return (f'<svg viewBox="{-pad} {-pad} {240 + 2 * pad} {170 + 2 * pad}" width="{width}"{h} fill="none" '
            f'role="img" aria-label="{aria}">' + body + "</svg>")


# ---------- muscle map ----------
IDLE = "#D8CBB1"
BODY = "#E8DFCC"
PRIM = None
SEC = "#D6A546"


def _c(key, prim, sec):
    if key in prim:
        return PRIM or RED
    if key in sec:
        return SEC
    return IDLE


def muscle_front(prim, sec, ox=0):
    c = lambda k: _c(k, prim, sec)
    s = f'<g transform="translate({ox} 0)">'
    s += f'<circle cx="50" cy="15" r="10" fill="{BODY}"/>'
    s += f'<path d="M34 34 Q50 28 66 34 L68 100 Q50 106 32 100 Z" fill="{BODY}"/>'
    s += f'<path d="M30 40 L20 96" stroke="{BODY}" stroke-width="11" stroke-linecap="round"/>'
    s += f'<path d="M70 40 L80 96" stroke="{BODY}" stroke-width="11" stroke-linecap="round"/>'
    s += f'<path d="M42 100 L40 164" stroke="{BODY}" stroke-width="15" stroke-linecap="round"/>'
    s += f'<path d="M58 100 L60 164" stroke="{BODY}" stroke-width="15" stroke-linecap="round"/>'
    # shoulders
    s += f'<ellipse cx="29" cy="41" rx="8" ry="9" fill="{c("shoulders")}"/>'
    s += f'<ellipse cx="71" cy="41" rx="8" ry="9" fill="{c("shoulders")}"/>'
    # chest
    s += f'<path d="M49 36 C41 35 35 38 35 44 C35 52 40 57 49 57 Z" fill="{c("chest")}"/>'
    s += f'<path d="M51 36 C59 35 65 38 65 44 C65 52 60 57 51 57 Z" fill="{c("chest")}"/>'
    # abs
    s += f'<rect x="42" y="60" width="16" height="34" rx="5" fill="{c("abs")}"/>'
    for yy in (69, 77.5, 86):
        s += f'<path d="M42 {yy}H58" stroke="{BODY}" stroke-width="1.6"/>'
    s += f'<path d="M50 60V94" stroke="{BODY}" stroke-width="1.6"/>'
    # biceps / forearms
    s += f'<ellipse cx="25" cy="59" rx="5" ry="10" transform="rotate(10 25 59)" fill="{c("biceps")}"/>'
    s += f'<ellipse cx="75" cy="59" rx="5" ry="10" transform="rotate(-10 75 59)" fill="{c("biceps")}"/>'
    s += f'<ellipse cx="21" cy="83" rx="4.2" ry="10" transform="rotate(10 21 83)" fill="{c("forearms")}"/>'
    s += f'<ellipse cx="79" cy="83" rx="4.2" ry="10" transform="rotate(-10 79 83)" fill="{c("forearms")}"/>'
    # quads / calves
    s += f'<ellipse cx="42" cy="121" rx="7.5" ry="19" fill="{c("quads")}"/>'
    s += f'<ellipse cx="58" cy="121" rx="7.5" ry="19" fill="{c("quads")}"/>'
    s += f'<ellipse cx="40.5" cy="152" rx="4.5" ry="10" fill="{c("calves")}"/>'
    s += f'<ellipse cx="59.5" cy="152" rx="4.5" ry="10" fill="{c("calves")}"/>'
    s += "</g>"
    return s


def muscle_back(prim, sec, ox=0):
    c = lambda k: _c(k, prim, sec)
    s = f'<g transform="translate({ox} 0)">'
    s += f'<circle cx="50" cy="15" r="10" fill="{BODY}"/>'
    s += f'<path d="M34 34 Q50 28 66 34 L68 100 Q50 106 32 100 Z" fill="{BODY}"/>'
    s += f'<path d="M30 40 L20 96" stroke="{BODY}" stroke-width="11" stroke-linecap="round"/>'
    s += f'<path d="M70 40 L80 96" stroke="{BODY}" stroke-width="11" stroke-linecap="round"/>'
    s += f'<path d="M42 100 L40 164" stroke="{BODY}" stroke-width="15" stroke-linecap="round"/>'
    s += f'<path d="M58 100 L60 164" stroke="{BODY}" stroke-width="15" stroke-linecap="round"/>'
    s += f'<ellipse cx="29" cy="41" rx="8" ry="9" fill="{c("shoulders")}"/>'
    s += f'<ellipse cx="71" cy="41" rx="8" ry="9" fill="{c("shoulders")}"/>'
    s += f'<path d="M50 29 L63 38 L50 60 L37 38 Z" fill="{c("upper back")}"/>'
    s += f'<path d="M36 44 C34 58 38 74 47 84 L48 64 Z" fill="{c("lats")}"/>'
    s += f'<path d="M64 44 C66 58 62 74 53 84 L52 64 Z" fill="{c("lats")}"/>'
    s += f'<rect x="44" y="84" width="12" height="14" rx="4" fill="{c("lower back")}"/>'
    s += f'<ellipse cx="25" cy="59" rx="5" ry="10" transform="rotate(10 25 59)" fill="{c("triceps")}"/>'
    s += f'<ellipse cx="75" cy="59" rx="5" ry="10" transform="rotate(-10 75 59)" fill="{c("triceps")}"/>'
    s += f'<ellipse cx="21" cy="83" rx="4.2" ry="10" transform="rotate(10 21 83)" fill="{c("forearms")}"/>'
    s += f'<ellipse cx="79" cy="83" rx="4.2" ry="10" transform="rotate(-10 79 83)" fill="{c("forearms")}"/>'
    s += f'<circle cx="43" cy="107" r="8.5" fill="{c("glutes")}"/>'
    s += f'<circle cx="57" cy="107" r="8.5" fill="{c("glutes")}"/>'
    s += f'<ellipse cx="41.5" cy="130" rx="6.5" ry="14" fill="{c("hamstrings")}"/>'
    s += f'<ellipse cx="58.5" cy="130" rx="6.5" ry="14" fill="{c("hamstrings")}"/>'
    s += f'<ellipse cx="40.5" cy="154" rx="5.2" ry="9.5" fill="{c("calves")}"/>'
    s += f'<ellipse cx="59.5" cy="154" rx="5.2" ry="9.5" fill="{c("calves")}"/>'
    s += "</g>"
    return s


def muscle_map(prim, sec, width="100%", height=None, label="Muscles worked"):
    h = f' height="{height}"' if height else ""
    return (f'<svg viewBox="0 0 210 170" width="{width}"{h} role="img" aria-label="{label}">'
            + muscle_front(prim, sec, 0) + muscle_back(prim, sec, 110) + "</svg>")


MUSCLES = {
    "incline-db-press": (["chest"], ["shoulders", "triceps"]),
    "seated-cable-row": (["upper back", "lats"], ["biceps", "shoulders"]),
    "machine-shoulder-press": (["shoulders"], ["triceps", "upper back"]),
    "lat-pulldown": (["lats"], ["biceps", "upper back"]),
    "rope-pushdown": (["triceps"], []),
    "back-squat": (["quads", "glutes"], ["hamstrings", "lower back", "abs"]),
    "romanian-deadlift": (["hamstrings", "glutes"], ["lower back", "forearms"]),
    "leg-press": (["quads"], ["glutes", "hamstrings"]),
    "seated-leg-curl": (["hamstrings"], ["calves"]),
    "pull-up": (["lats"], ["biceps", "upper back", "forearms"]),
}


THEMES = {
    "light": dict(INK="#1D1B18", EQUIP="#8E7F66", EQUIP_D="#6B604E", GHOST="#CDBFA3", RED="#9E2B25", FLOOR="#C9BA9C",
                  PANEL_BG="#EDE3CF", FAR="#4A443B", IDLE="#D8CBB1", BODY="#E8DFCC", PRIM=None, SEC="#D6A546"),
    "dark": dict(INK="#EFE6D4", EQUIP="#6E6352", EQUIP_D="#9C8D74", GHOST="#4E483F", RED="#E0654C", FLOOR="#3B3731",
                 PANEL_BG="#2A2723", FAR="#BDB29C", IDLE="#4A443B", BODY="#36322C", PRIM=None, SEC="#D6A546"),
}


def set_theme(name):
    globals().update(THEMES[name])
