from chars import *
import subprocess
F1 = 'font-family="Bricolage Grotesque" font-weight="800"'; F2 = 'font-family="Plus Jakarta Sans" font-weight="800"'
B = lambda: bhre("hold", "happy", t=0.3); Tr = lambda: trah("clap", "happy", t=0.3)
def kids(y=300):
    return at(B(), 196, y + 60, 0.40) + at(Tr(), 322, y + 50, 0.36)
def wrap(body): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">{fonts()}{body}</svg>'
red = wrap('<rect width="512" height="512" fill="#C8372D"/><circle cx="256" cy="256" r="214" fill="#D14035"/>' + kids()
           + '<rect x="100" y="282" width="312" height="96" rx="30" fill="#FFF4E2"/>'
           f'<text x="256" y="352" text-anchor="middle" {F1} font-size="70" letter-spacing="-2" fill="#C8372D">BHATRA</text>')
brown = wrap('<rect width="512" height="512" fill="#3A1E12"/><circle cx="256" cy="256" r="214" fill="#4A2A1C"/>' + kids(290)
             + '<rect x="104" y="288" width="304" height="112" rx="30" fill="#C8372D"/><rect x="104" y="278" width="304" height="112" rx="30" fill="#F2B33D"/>'
             f'<text x="256" y="320" text-anchor="middle" {F2} font-size="26" letter-spacing="1" fill="#3A1E12">BHATRA</text>'
             f'<text x="256" y="372" text-anchor="middle" {F1} font-size="54" fill="#3A1E12">OWNER</text>')
yellow = wrap('<rect width="512" height="512" fill="#F2B33D"/>' + at(B(), 160, 600, 0.90) + at(Tr(), 372, 572, 0.82))
for n, s in (("red", red), ("brown", brown), ("yellow", yellow)): open(f"out/icon-{n}.svg", "w").write(s)
jobs = [("red", "icon-512.png", 512), ("red", "apple-touch-icon.png", 180), ("yellow", "icon-192.png", 192),
        ("brown", "admin-512.png", 512), ("brown", "admin-192.png", 192), ("brown", "admin-touch.png", 180)]
args = []
for n, f, w in jobs: args += [f"out/icon-{n}.svg", f"out/web-img/{f}", str(w)]
import os; os.makedirs("out/web-img", exist_ok=True)
subprocess.run(["python3", "render.py"] + args, check=True, capture_output=True)
