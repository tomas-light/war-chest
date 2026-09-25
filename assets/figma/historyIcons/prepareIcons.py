import json
from pathlib import Path
from PIL import Image, ImageDraw

ASSET_DIRECTORY = Path(__file__).parent
MANIFEST = json.loads((ASSET_DIRECTORY / 'generationPrompts.json').read_text(encoding='utf-8'))
PREVIEW_ROWS = (len(MANIFEST['icons']) + 3) // 4
PREVIEW = Image.new('RGB', (768, 130 * PREVIEW_ROWS), '#080d10')
DRAW = ImageDraw.Draw(PREVIEW)

for index, item in enumerate(MANIFEST['icons']):
    source = Image.open(ASSET_DIRECTORY / item['source']).convert('RGBA')
    bounds = source.getchannel('A').point(lambda value: 255 if value > 128 else 0).getbbox()
    artwork = source.crop(bounds)
    artwork.thumbnail((224, 224), Image.Resampling.LANCZOS)
    output = Image.new('RGBA', (256, 256))
    output.alpha_composite(artwork, ((256 - artwork.width) // 2, (256 - artwork.height) // 2))
    output.save(ASSET_DIRECTORY / (item['name'] + '.png'))
    column, row = index % 4, index // 4
    x, y = column * 192, row * 130
    for size, offset in [(24, 24), (32, 68), (48, 124)]:
        reduced = output.resize((size, size), Image.Resampling.LANCZOS)
        PREVIEW.paste(reduced, (x + offset, y + 30), reduced)
    DRAW.text((x + 24, y + 94), item['name'], fill='#eee5d2')

PREVIEW.save(ASSET_DIRECTORY / 'sizePreview.png')
