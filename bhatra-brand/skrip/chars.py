"""Bhre & Trah (Little Bhre rig) for BHATRA artwork. Feet at (0,0), scale 1 (Bhre ~440px, Trah ~440px tall)."""
import sys, io, base64, contextlib
sys.path.insert(0, '/home/claude/little-bhre/kit')
with contextlib.redirect_stdout(io.StringIO()):
    import rig_adapter, motion as M, trah as TR, hands as H, life as L
T = 1.2
def bhre(arms="cheer", emo="laugh", look=None, t=None):
    T_ = T if t is None else t
    BH = L.Performer("bhre", seed=1)
    kw = BH.kw(T_, beats=[(0, emo)], look=[(0, look or L.CAM)])
    return M.place(M.bhre_rig(T_, pose=H.arms(T_, [(0, arms)]), breathe=False, **kw), 0, 0, 1)
def trah(arms="up", emo="laugh", look=None, t=None):
    T_ = T if t is None else t
    TP = L.Performer("trah", seed=3)
    kw = TP.kw(T_, beats=[(0, emo)], look=[(0, look or L.CAM)])
    return TR.place_rig(TR.trah_rig(T_, pose=H.trah_arms(T_, [(0, arms)]), **kw), 0, 0, 1)
def at(svg, x, y, s):
    return f'<g transform="translate({x} {y}) scale({s})">{svg}</g>'
def fonts():
    def ff(name, file, w):
        b = base64.b64encode(open('/home/claude/kv/' + file, 'rb').read()).decode()
        return f'@font-face{{font-family:"{name}";font-weight:{w};src:url(data:font/woff2;base64,{b}) format("woff2")}}'
    return '<style>' + ff("Bricolage Grotesque", "BricolageGrotesque-800.woff2", 800) + ff("Plus Jakarta Sans", "PlusJakartaSans.woff2", "200 800") + '</style>'
