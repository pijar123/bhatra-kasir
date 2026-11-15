"""render.py in.svg out.png width  -> PNG at that pixel width (transparent where svg is)."""
import sys, re
from playwright.sync_api import sync_playwright
def render(svg_path, out, width, pg):
    s = open(svg_path).read()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', s).group(1).split()]
    h = round(width * vb[3] / vb[2])
    s = re.sub(r'(<svg[^>]*?)\swidth="[^"]*"', r'\1', s, 1); s = re.sub(r'(<svg[^>]*?)\sheight="[^"]*"', r'\1', s, 1)
    s = s.replace('<svg ', f'<svg width="{width}" height="{h}" ', 1)
    pg.set_viewport_size({"width": width, "height": h})
    pg.set_content(f'<html><body style="margin:0;background:transparent">{s}</body></html>'); pg.wait_for_timeout(300)
    pg.screenshot(path=out, clip={"x": 0, "y": 0, "width": width, "height": h}, omit_background=True)
if __name__ == "__main__":
    jobs = [sys.argv[i:i+3] for i in range(1, len(sys.argv), 3)]
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        for a, o, w in jobs: render(a, o, int(w), pg)
        b.close()
