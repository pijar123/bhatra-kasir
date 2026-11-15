"""BHATRA Reel 1 v2: set/kamera/kartu/CTA dari ep.js TK Penginapan + Bhre & Trah dari rig Little Bhre + suara Bhre (klip disetujui).
  python3 reel1b.py check [t,t,...]   -> chk.jpg (lembar cek)
  python3 reel1b.py full              -> v1_17nov_kulkas.mp4
"""
import os, sys, io, json, math, shutil, subprocess, contextlib
sys.path.insert(0, '/home/claude/little-bhre/kit')
with contextlib.redirect_stdout(io.StringIO()):
    import rig_adapter, motion as M, trah as TR, hands as H, life as L
from motion import ease, lerp, clamp

HERE = os.path.dirname(os.path.abspath(__file__))
FPS, DUR = 30, 18.0
OUT, SAMBAL, KUNYIT, KECAP, SANTAN = "#3B2418", "#C8372D", "#F2B33D", "#3A1E12", "#FFF4E2"
def seg(t, a, b): return clamp((t - a) / (b - a))
def spring(x, osc=1.4, damp=5): return 0 if x <= 0 else 1 if x >= 1 else 1 - math.exp(-damp * x) * math.cos(osc * 2 * math.pi * x)

# ---------- acting data (one timeline for both worlds) ----------
B_BEATS = [(0, "curious"), (2.7, "worried"), (5.6, "sad"), (7.2, "worried"), (9.1, "curious"),
           (12.5, "surprised"), (13.3, "laugh"), (15.0, "happy"), (15.9, "laugh")]
B_LOOK = [(0, (1, 0.2)), (5.6, (1, 0.1)), (6.5, L.CAM), (9.1, (1, -0.2)), (12.5, (0.2, 0.6)), (13.3, L.CAM), (15.0, (1, 0.1)), (15.8, L.CAM)]
B_ARMS = [(0, "down"), (2.8, "belly"), (7.0, "shy"), (9.1, "down"), (12.5, "down"), (13.4, "cheer"), (14.6, "down"), (15.0, "hold")]
T_BEATS = [(0, "happy"), (5.5, "curious"), (12.6, "surprised"), (13.4, "laugh"), (15.0, "happy")]
T_LOOK = [(0, (1, 0)), (6.6, L.CAM), (12.6, (-0.3, 0.5)), (13.4, L.CAM), (15.2, (-1, 0)), (15.9, L.CAM)]
T_ARMS = [(0, "rest"), (5.4, "clap"), (12.6, "rest"), (13.4, "up"), (14.6, "clap")]
BH = L.Performer("bhre", seed=1); TP = L.Performer("trah", seed=3)

PLATE = f'<g transform="translate(0 300)"><ellipse rx="70" ry="22" fill="#7FC8E8" stroke="{OUT}" stroke-width="6"/><ellipse rx="44" ry="12" fill="#A9DDF2"/></g>'
PLATE_HAND = PLATE.replace('translate(0 300)', 'translate(0 150)')
BISKUIT = f'<g transform="translate(0 150) rotate(-8)"><rect x="-46" y="-30" width="92" height="60" rx="10" fill="#E7AE5B" stroke="{OUT}" stroke-width="6"/><g fill="#B9813A"><circle cx="-22" cy="-8" r="5"/><circle cx="0" cy="8" r="5"/><circle cx="22" cy="-8" r="5"/></g></g>'
PAHA = f'<g transform="translate(30 172) rotate(-25)"><rect x="-8" y="-6" width="70" height="16" rx="8" fill="#FFF4E2" stroke="{OUT}" stroke-width="5"/><circle cx="66" cy="-4" r="11" fill="#FFF4E2" stroke="{OUT}" stroke-width="5"/><circle cx="66" cy="12" r="11" fill="#FFF4E2" stroke="{OUT}" stroke-width="5"/><ellipse cx="-30" cy="2" rx="52" ry="40" fill="#C9742C" stroke="{OUT}" stroke-width="6"/><g fill="#E8A55A"><circle cx="-44" cy="-10" r="7"/><circle cx="-22" cy="12" r="6"/><circle cx="-12" cy="-14" r="5"/></g></g>'

def bhre(t, x, y, s, lift=0.0, squash=1.0, extra="", shadow=True):
    kw = BH.kw(t, beats=B_BEATS, look=B_LOOK, lift=lift, squash=squash)
    svg = M.bhre_rig(t, pose=H.arms(t, B_ARMS), **kw)
    sh = f'<ellipse cx="{x}" cy="{y + 4}" rx="{120 * s * (1 - lift / 400):.1f}" ry="{20 * s:.1f}" fill="#173336" opacity=".18"/>' if shadow else ""
    return sh + M.place(svg + extra, x, y, s)

def trah(t, x, y, s, crawl=None, extra="", shadow=True):
    if crawl is not None:
        svg = TR.trah_rig(t, "happy", "crawl", crawl)
    else:
        kw = TP.kw(t, beats=T_BEATS, look=T_LOOK)
        svg = TR.trah_rig(t, pose=H.trah_arms(t, T_ARMS), **kw)
    sh = f'<ellipse cx="{x}" cy="{y + 4}" rx="{105 * s:.1f}" ry="{18 * s:.1f}" fill="#173336" opacity=".18"/>' if shadow else ""
    return sh + TR.place_rig(svg + extra, x, y, s)

def fridge(t):
    fx, fy, fw, fh = 560, 600, 400, 1050
    sh = [f'<rect x="{fx + 26}" y="{y}" width="{fw - 52}" height="10" fill="#C9DDE3"/>' for y in (790, 1030, 1270)]
    return (f'<ellipse cx="{fx + fw / 2}" cy="{fy + fh + 6}" rx="230" ry="18" fill="#173336" opacity=".18"/>'
            f'<polygon points="{fx},{fy + 80} 140,1720 760,1720" fill="#FFF8D0" opacity=".35"/>'
            f'<rect x="{fx}" y="{fy}" width="{fw}" height="{fh}" rx="34" fill="#E3EEF0" stroke="{OUT}" stroke-width="8"/>'
            f'<rect x="{fx + 22}" y="{fy + 26}" width="{fw - 44}" height="{fh - 52}" rx="16" fill="#F7FCFF" stroke="#B9CDD3" stroke-width="5"/>'
            f'<circle cx="760" cy="700" r="160" fill="#FFFBE0" opacity=".6"/>' + "".join(sh) +
            f'<ellipse cx="760" cy="1030" rx="46" ry="8" fill="{OUT}" opacity=".15"/><ellipse cx="760" cy="988" rx="34" ry="43" fill="#FFFDF5" stroke="{OUT}" stroke-width="5"/><ellipse cx="750" cy="975" rx="8" ry="13" fill="#fff"/>'
            f'<path d="M{fx + fw} {fy} L{fx + fw + 230} {fy - 40} L{fx + fw + 230} {fy + fh + 40} L{fx + fw} {fy + fh} Z" fill="#D5E4E8" stroke="{OUT}" stroke-width="8" stroke-linejoin="round"/>'
            f'<circle cx="{fx + fw + 110}" cy="{fy + 220}" r="18" fill="{SAMBAL}"/><rect x="{fx + fw + 140}" y="{fy + 320}" width="56" height="70" rx="6" fill="{KUNYIT}" transform="rotate(4 {fx + fw + 168} {fy + 355})"/>')

def box(x, y, s, open_=0.0):
    lid = (f'<path d="M-150 -100 L150 -100 L132 -190 L-132 -190 Z" fill="#B88B5A" stroke="{OUT}" stroke-width="7"/>' if open_ > 0.5 else
           f'<rect x="-155" y="-108" width="310" height="30" rx="6" fill="#B88B5A" stroke="{OUT}" stroke-width="7"/>')
    food = (f'<ellipse cx="-50" cy="-100" rx="70" ry="28" fill="#FFFDF5" stroke="{OUT}" stroke-width="5"/><ellipse cx="50" cy="-104" rx="60" ry="30" fill="#C9742C" stroke="{OUT}" stroke-width="5"/>'
            f'<ellipse cx="112" cy="-96" rx="22" ry="12" fill="{SAMBAL}"/>' if open_ > 0.5 else "")
    return (f'<g transform="translate({x:.1f} {y:.1f}) scale({s:.3f})"><ellipse cy="4" rx="170" ry="14" fill="#173336" opacity=".2"/>'
            f'<rect x="-150" y="-104" width="300" height="104" rx="8" fill="#D2A26E" stroke="{OUT}" stroke-width="7"/>{food}{lid}'
            f'<rect x="-74" y="-66" width="148" height="44" rx="8" fill="{SAMBAL}"/><text x="0" y="-34" text-anchor="middle" font-family="BG" font-weight="800" font-size="30" fill="{SANTAN}">BHATRA</text></g>')

def chars(t):
    # ---- world A: kitchen ----
    crawl_x = lerp(-160, 200, ease(seg(t, 2.8, 4.9)))
    if t < 4.9:
        tr_a = trah(t, crawl_x, 1660, 0.62, crawl=(t * 1.5) % 1 if t > 2.8 else 0.0, extra=PLATE)
    else:
        tr_a = trah(t, 200, 1660, 0.62, extra=PLATE_HAND)
    a1 = fridge(t) + bhre(t, 420, 1655, 1.08) + tr_a
    # ---- world B: dining table ----
    jp = M.jump(t, 13.85, h=110, ant=0.25, air=0.5, land=0.45)
    b1 = (bhre(t, 390, 1575, 1.15, lift=jp["lift"], squash=jp["squash"], extra=PAHA if t >= 15.0 else "", shadow=False)
          + trah(t, 800, 1490, 0.76, extra=BISKUIT if t >= 14.6 else "", shadow=False))
    drop = spring(seg(t, 12.55, 13.25))
    b2 = box(625, lerp(980, 1392, drop), 0.74, open_=1.0 if t > 14.8 else 0.0) if t > 12.5 else ""
    return {"a1": a1, "b1": b1, "b2": b2}

# ---------- sound (Little Bhre audio kit: approved Bhre vocals + SFX + score) ----------
def build_audio(path):
    C = []
    def cue(t, name, **kw): C.append([round(t, 3), name, kw])
    # suara Bhre: klip yang sudah disetujui (assets/audio/vox + bhre_laugh_*), satu per momen
    for t, slot in [(2.85, "uhoh"), (6.65, "hmm"), (12.45, "huh"), (13.25, "wow"), (13.95, "yeay")]:
        cue(t, "bvox", slot=slot)
    cue(15.95, "laugh", clip=1)
    for t, n, kw in [(0.1, "tension", {}), (1.95, "whoosh", {}), (2.9, "uhoh", {}),
                     (5.95, "whoosh", {}), (6.3, "hit", {"kind": "land", "vol": 0.5}), (6.7, "hit", {"kind": "land", "vol": 0.45}), (7.1, "hit", {"kind": "land", "vol": 0.4}),
                     (9.05, "whoosh", {}), (9.25, "pop", {}), (10.6, "pop", {}), (11.15, "chime", {}),
                     (12.3, "ding", {}), (12.45, "whoosh", {}), (12.6, "hit", {"kind": "slide_down"}), (13.2, "hit", {"kind": "land"}),
                     (13.85, "boing", {}), (13.9, "giggle", {}), (14.8, "pop", {}), (15.4, "whoosh", {}), (16.3, "whoosh", {}), (16.75, "sting", {})]:
        C.append([t, n, kw])
    for k in range(5):                                   # Trah's crawl: soft pats
        C.append([round(2.9 + k * 0.42, 3), "hit", {"kind": "tiptoe", "vol": 0.25}]) if k == 0 else None
    music = [[0.0, "think", "play"], [12.3, "celebrate", "play"], [DUR, "celebrate", "stop"]]
    cj = os.path.join(HERE, "cues.json")
    json.dump({"cues": [[a, b, c] for a, b, c in C], "music": music, "duration": DUR}, open(cj, "w"), indent=0)
    with contextlib.redirect_stdout(io.StringIO()):
        import audio_synth
        audio_synth.build(cj, path)
    print("vokal Bhre:", [c[2].get("slot") for c in C if c[1] == "bvox"])

def render(ts, outdir, scale=1.0):
    from playwright.sync_api import sync_playwright
    os.makedirs(outdir, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1080, "height": 1920})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("file://" + os.path.join(HERE, "reel1.html")); pg.wait_for_timeout(800)
        for i, t in enumerate(ts):
            pg.evaluate("([t, ch]) => { window.CH = ch; setT(t); }", [t, chars(t)])
            pg.screenshot(path=f"{outdir}/f{i:05d}.jpg", type="jpeg", quality=92)
        b.close()
    if errs: print("ERR", errs[:3])

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    if mode == "check":
        ts = [float(x) for x in sys.argv[2].split(",")] if len(sys.argv) > 2 else [0.4, 2.2, 3.6, 5.0, 6.8, 8.6, 10.2, 11.6, 12.6, 13.95, 15.6, 17.2]
        d = os.path.join(HERE, "chk"); shutil.rmtree(d, ignore_errors=True); render(ts, d)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-pattern_type", "glob", "-i", f"{d}/*.jpg", "-vf",
                        f"scale=270:480,tile={min(6, len(ts))}x{(len(ts) + 5) // 6}", os.path.join(HERE, "chk.jpg")], check=True)
        print("chk.jpg")
    else:
        d = os.path.join(HERE, "f"); shutil.rmtree(d, ignore_errors=True)
        render([i / FPS for i in range(int(DUR * FPS))], d)
        wav = os.path.join(HERE, "audio.wav"); build_audio(wav)
        mp4 = os.path.join(HERE, "v1_17nov_kulkas.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", f"{d}/f%05d.jpg", "-i", wav,
                        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-tune", "animation", "-pix_fmt", "yuv420p",
                        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", mp4], check=True)
        print(mp4)
