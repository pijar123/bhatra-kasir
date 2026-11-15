import sys, io, re, base64, contextlib
sys.path.insert(0, '/home/claude/little-bhre/kit')
with contextlib.redirect_stdout(io.StringIO()):
    import rig_adapter, motion as M, trah as TR, hands as H, life as L
SRC = "/mnt/user-data/uploads/bhatra/kv/kv-bhatra-feed-4x5.svg"
t = 1.2
BH, TRH = L.Performer("bhre", seed=1), L.Performer("trah", seed=3)
bkw = BH.kw(t, beats=[(0, "laugh")], look=[(0, L.CAM)])
tkw = TRH.kw(t, beats=[(0, "laugh")], look=[(0, L.CAM)])
bhre = M.place(M.bhre_rig(t, pose=H.arms(t, [(0, "cheer")]), breathe=False, **bkw), 0, 0, 1)
trah = TR.place_rig(TR.trah_rig(t, pose=H.trah_arms(t, [(0, "up")]), **tkw), 0, 0, 1)
# x, feet-y (inside the 560x400 sign viewport), scale
BX, BY, BS = 150, 280, 0.54
TX, TY, TS = 420, 252, 0.5
chars = (f'<g transform="translate({BX} {BY}) scale({BS})">{bhre}</g>'
         f'<g transform="translate({TX} {TY}) scale({TS})">{trah}</g>')
s = open(SRC).read()
s = re.sub(r'<use href="#boy"[^>]*/><use href="#girl"[^>]*/>', chars, s)
s = re.sub(r'<symbol id="boy".*?</symbol>\s*<symbol id="girl".*?</symbol>', '', s, flags=re.S)
s = s.replace("22.30", "22.00")
def ff(name, file, w):
    b = base64.b64encode(open(file, 'rb').read()).decode()
    return f'@font-face{{font-family:"{name}";font-weight:{w};src:url(data:font/woff2;base64,{b}) format("woff2")}}'
fonts = ff("Bricolage Grotesque", "BricolageGrotesque-800.woff2", 800) + ff("Plus Jakarta Sans", "PlusJakartaSans.woff2", "200 800")
s = re.sub(r'<style>.*?</style>', f'<style>{fonts}</style>', s, flags=re.S)
open("kv-bhatra-feed-4x5-littlebhre.svg", "w").write(s)
