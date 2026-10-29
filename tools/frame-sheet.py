"""Compose ten original browser screenshots. This tool never opens a video."""
import json
import pathlib
import sys
from PIL import Image, ImageDraw, ImageFont

directory = pathlib.Path(sys.argv[1])
capture = json.loads((directory / 'capture.json').read_text())
width, height, caption = 576, 324, 34
sheet = Image.new('RGB', (width * 5, (height + caption) * 2), '#0a0b10')
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 20)
except OSError:
    font = ImageFont.load_default()
for index in range(10):
    seconds = index * 2
    x = index % 5 * width
    y = index // 5 * (height + caption)
    with Image.open(directory / f'frame-{seconds:02d}.png') as frame:
        pixels = list(frame.convert('RGB').resize((160, 90)).getdata())
        white = sum(min(pixel) > 235 for pixel in pixels) / len(pixels)
        if white > 0.98:
            raise RuntimeError(f'Blank Chromium screenshot at {seconds}s; recapture before review')
        sheet.paste(frame.resize((width, height), Image.Resampling.LANCZOS), (x, y))
    draw.text((x + 12, y + height + 5),
              f'{seconds:02d}s / seed {capture["selectedSeed"]}', fill='#c6c8d1', font=font)
sheet.save(directory / 'sheet.png')
(directory / 'frames.json').write_text(json.dumps({
    'timestamps': list(range(0, 20, 2)), 'method': 'original Playwright screenshots',
    'videoRecorded': False
}, indent=2))
