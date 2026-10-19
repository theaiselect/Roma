"""Genera los iconos de la app (ROMA ↔ AMOR) con la fuente Cormorant empaquetada."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1])
font_path = root / 'node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff'
out = root / 'public/icons'
TERRA = (192, 88, 58)
MARMOL = (247, 243, 238)

def icon(size: int, safe: float) -> Image.Image:
    s = size * 4  # supersampling
    img = Image.new('RGB', (s, s), TERRA)
    d = ImageDraw.Draw(img)
    inner = s * safe
    font = ImageFont.truetype(str(font_path), int(inner * 0.34))
    text = 'AMOR'
    box = d.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    x = (s - tw) / 2 - box[0]
    y = (s - th) / 2 - box[1]
    d.text((x, y), text, font=font, fill=MARMOL)
    rule_w = tw * 0.9
    lw = max(2, int(s * 0.012))
    gap = th * 0.42
    for yy in ((s - th) / 2 - gap, (s + th) / 2 + gap):
        d.line([((s - rule_w) / 2, yy), ((s + rule_w) / 2, yy)], fill=MARMOL, width=lw)
    # corazón pequeño bajo la línea inferior
    r = s * 0.022
    cx, cy = s / 2, (s + th) / 2 + gap + r * 3.2
    d.ellipse([cx - 2 * r, cy - r, cx, cy + r], fill=MARMOL)
    d.ellipse([cx, cy - r, cx + 2 * r, cy + r], fill=MARMOL)
    d.polygon([(cx - 2 * r + r * 0.15, cy + r * 0.35), (cx + 2 * r - r * 0.15, cy + r * 0.35), (cx, cy + r * 2.4)], fill=MARMOL)
    return img.resize((size, size), Image.LANCZOS)

icon(192, 0.86).save(out / 'icon-192.png', optimize=True)
icon(512, 0.86).save(out / 'icon-512.png', optimize=True)
icon(512, 0.66).save(out / 'icon-maskable-512.png', optimize=True)
icon(180, 0.86).save(out / 'apple-touch-icon.png', optimize=True)
print('ok')
