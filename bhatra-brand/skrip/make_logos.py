import re
from chars import *
L_ = "/mnt/user-data/uploads/bhatra/brand/logo/"
def swap(src, chars, out):
    s = open(L_ + src).read()
    s = re.sub(r'<symbol id="boy".*?</symbol>\s*<symbol id="girl".*?</symbol>', '', s, flags=re.S)
    s = re.sub(r'<use href="#boy"[^>]*/>\s*<use href="#girl"[^>]*/>', chars, s)
    s = re.sub(r'<style>.*?</style>', fonts(), s, flags=re.S)
    open("out/" + out, "w").write(s)
# A: same staging as the approved KV (sign viewport 560x400)
swap("bhatra-logo-A-papan.svg", at(bhre(), 150, 280, 0.54) + at(trah(), 420, 252, 0.5), "bhatra-logo-A-papan.svg")
# C: avatar, open eyes so it reads at 48-180 px
swap("bhatra-logo-C-avatar.svg", at(bhre("hold", "happy", t=0.3), 128, 460, 0.70) + at(trah("clap", "happy", t=0.3), 290, 440, 0.64), "bhatra-logo-C-avatar.svg")
# standalone mascots (transparent)
for n, svg in (("bhatra-maskot-bhre-kakak.svg", at(bhre("wave", "happy", t=0.3), 260, 530, 1.0)), ("bhatra-maskot-trah-adik.svg", at(trah("wave", "happy", t=0.3), 220, 530, 1.0))):
    open("out/" + n, "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {520 if "bhre" in n else 440} 560" width="{1040 if "bhre" in n else 880}" height="1120">{svg}</svg>')
