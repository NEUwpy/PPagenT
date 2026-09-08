"""Collect actual PPTX renders without altering candidates; prepare comparison images."""
from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image, ImageOps, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PREVIEWS = ROOT / 'previews'
PREVIEWS.mkdir(exist_ok=True)
FONT = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 28)
manifest = []
rows = {}
for letter in 'abc':
    directory = ROOT / f'route-{letter}'
    ppt = directory / 'deck.pptx'
    if not ppt.exists():
        raise FileNotFoundError(ppt)
    # Renderer output paths are supplied explicitly after final render verification.
    mapping = json.loads((ROOT / 'render-map.json').read_text(encoding='utf-8'))
    for index, relative in enumerate(mapping[letter], 1):
        source = ROOT / relative
        target = PREVIEWS / f'{letter}-{index}.png'
        shutil.copy2(source, target)
        manifest.append({'route': letter, 'page': index, 'source': str(source.relative_to(ROOT)),
                         'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
        rows.setdefault(index, []).append(target)
    manifest.append({'route': letter, 'pptx': str(ppt.relative_to(ROOT)),
                     'sha256': hashlib.sha256(ppt.read_bytes()).hexdigest()})

labels = ['A  页面拆解', 'B  模式与容量', 'C  语义布局']
for page, paths in rows.items():
    sheet = Image.new('RGB', (1920, 410), '#edf0f4')
    draw = ImageDraw.Draw(sheet)
    for col, (file, label) in enumerate(zip(paths, labels)):
        draw.text((col * 640 + 14, 8), label, font=FONT, fill='#254564')
        thumb = ImageOps.contain(Image.open(file).convert('RGB'), (628, 354))
        sheet.paste(thumb, (col * 640 + 6, 50))
    sheet.save(ROOT / f'comparison-page-{page}.png')
(ROOT / 'output-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print('Collected 12 renders and 3 PPTX hashes.')
