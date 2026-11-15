from chars import *
F1 = 'font-family="Bricolage Grotesque" font-weight="800"'; F2 = 'font-family="Plus Jakarta Sans" font-weight="700"'
def card(x, fill, name, desc, char, dots, light):
    tc = "#3A1E12" if not light else "#FFF4E2"
    d = "".join(f'<circle cx="{x+710+i*55}" cy="1145" r="20" fill="{c}" stroke="{tc}" stroke-width="2"/>' for i, c in enumerate(dots))
    return (f'<rect x="{x}" y="203" width="894" height="1020" rx="34" fill="{fill}"/>{char}'
            f'<text x="{x+57}" y="1120" {F1} font-size="48" fill="{tc}">{name}</text>'
            f'<text x="{x+57}" y="1163" {F2} font-size="20" fill="{tc}">{desc}</text>{d}')
s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1310" width="2000" height="1310">{fonts()}'
     f'<rect width="2000" height="1310" fill="#FFF4E2"/><text x="86" y="138" {F1} font-size="58" fill="#3A1E12">Maskot</text>'
     f'<text x="1913" y="138" text-anchor="end" {F2} font-size="20" fill="#6E5040">Karakter Little Bhre · garis tinta tebal · terbaca sampai 48 px</text>'
     + card(86, "#F2B33D", "Trah", "Si adik · bayi, kaus biru motif Tutu", at(trah("wave", "happy", t=0.3), 533, 1010, 1.75), ["#3B2418", "#C68A5E", "#BDE3F8"], False)
     + card(1019, "#C8372D", "Bhre", "Si kakak · rambut keriting, kaus warna-warni", at(bhre("wave", "happy", t=0.3), 1466, 1040, 1.5), ["#3B2418", "#C68A5E", "#3C5A8E"], True)
     + '</svg>')
open("out/02-maskot.svg", "w").write(s)
