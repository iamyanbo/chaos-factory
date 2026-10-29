"""Extract the real Cup's cards and standings without changing its video."""
import json
import pathlib
import subprocess
from PIL import Image, ImageDraw, ImageFont

directory = pathlib.Path('qa/cup')
capture = json.loads((directory / 'capture.json').read_text())
rows = []
for transition in capture['transitions']:
    phase = transition['phase']
    if phase not in ('INTRO', 'STANDINGS', 'CUP_RESULTS'):
        continue
    seconds = transition['wall'] + 2
    name = f"round-{transition['round']}-{phase.lower()}.png"
    target = directory / name
    subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(seconds),
        '-i', str(directory / 'full-cup.webm'), '-frames:v', '1', str(target)
    ], check=True)
    rows.append((transition['round'], phase, seconds, target))

width, height, caption = 640, 360, 32
sheet = Image.new('RGB', (width * 5, (height + caption) * 2), '#0a0b10')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 19)
for index, (round_number, phase, seconds, path) in enumerate(rows):
    x = index % 5 * width
    y = index // 5 * (height + caption)
    with Image.open(path) as frame:
        sheet.paste(frame.resize((width, height), Image.Resampling.LANCZOS), (x, y))
    draw.text((x + 10, y + height + 5),
              f'Round {round_number} / {phase} / {seconds:.1f}s', fill='#c6c8d1', font=font)
sheet.save(directory / 'sheet.png')
