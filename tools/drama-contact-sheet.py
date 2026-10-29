"""Twelve accurately sought video samples, with observed game clocks beside them."""
import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

TIMES = tuple(range(0, 60, 5))


def duration_seconds(video):
    result = subprocess.run([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', str(video)
    ], capture_output=True, text=True, check=True)
    return float(result.stdout.strip())


def extract_frames(video, frame_directory, timestamps=TIMES):
    """Accurate input seeking decodes the frame at/just after each timestamp.

    copyts + showinfo retains its actual source PTS for caption/sample alignment.
    A fresh frame directory means stale files can never satisfy the count check.
    """
    frame_directory.mkdir(parents=True, exist_ok=False)
    frames = []
    for index, timestamp in enumerate(timestamps, 1):
        path = frame_directory / f'frame-{index:02}.png'
        result = subprocess.run([
            'ffmpeg', '-hide_banner', '-loglevel', 'info', '-y',
            '-ss', f'{timestamp:.6f}', '-copyts', '-i', str(video),
            '-an', '-vf', 'showinfo,scale=480:270', '-frames:v', '1', str(path)
        ], capture_output=True, text=True, check=True)
        match = re.search(r'\bn:\s*0\s+pts:.*?pts_time:([-+\deE.]+)', result.stderr)
        if not path.is_file() or not match:
            raise RuntimeError(f'No new decoded frame at video {timestamp}s')
        actual = float(match.group(1))
        if actual < timestamp - .05:
            raise RuntimeError(f'Seek returned an earlier frame: {actual} < {timestamp}')
        frames.append({'path': path, 'requested': timestamp, 'actual': actual})
    return frames


def make_sheet(directory):
    directory = directory.resolve()
    capture = json.loads((directory / 'capture.json').read_text(encoding='utf-8'))
    video = directory / 'normal-speed.webm'
    duration = duration_seconds(video)
    if abs(duration - 60) > .25:
        raise RuntimeError(f'Expected a nominal60s preview, found {duration:.3f}s')
    if not capture.get('samples'):
        raise RuntimeError('Recording has no clock samples')
    font_path = Path('C:/Windows/Fonts/segoeuib.ttf')
    font = ImageFont.truetype(str(font_path), 21) if font_path.exists() else ImageFont.load_default()
    sheet = Image.new('RGB', (1960, 1000), '#090d18')
    draw = ImageDraw.Draw(sheet)
    manifest = []
    with tempfile.TemporaryDirectory(prefix='.contact-sheet-', dir=directory) as temporary:
        temporary = Path(temporary).resolve()
        if temporary.parent != directory:
            raise RuntimeError('Temporary frames escaped the capture directory')
        frames = extract_frames(video, temporary / 'frames')
        for index, frame in enumerate(frames):
            x, y = 8 + (index % 4) * 488, 8 + (index // 4) * 312
            with Image.open(frame['path']) as image:
                sheet.paste(image.convert('RGB'), (x, y))
            sample = min(capture['samples'], key=lambda s: abs(s['wall'] - frame['actual']))
            caption = f'video {frame["actual"]:05.2f}s | game {sample["time"]:.1f}s | {sample["alive"]} left'
            draw.text((x + 8, y + 275), caption, font=font, fill='#d5e2f5')
            manifest.append({'file': frame['path'].name, 'requestedVideoSeconds': frame['requested'],
                             'decodedVideoSeconds': frame['actual'], 'sampleWallSeconds': sample['wall'],
                             'gameSeconds': sample['time'], 'alive': sample['alive']})
        preview, full = capture.get('preview', {}), capture.get('fullRound', {})
        if capture.get('provisionalTimeAlignment', False):
            status = 'PROVISIONAL CLOCK ALIGNMENT: captions/payoff timing unverified. Visual footage: full-round.webm'
        elif not full.get('includesFullPayoff', False):
            status = 'FULL RECORDING INCOMPLETE: inspect capture.json for the safety cap/error.'
        elif not preview.get('includesResult', False):
            status = '60s PREVIEW ENDS BEFORE RESULT. Complete round and payoff: full-round.webm'
        elif not preview.get('includesFullPayoff', False):
            status = '60s PREVIEW INCLUDES RESULT; FULL PAYOFF CONTINUES in full-round.webm'
        else:
            status = '60s PREVIEW INCLUDES RESULT AND AT LEAST5s OF PAYOFF.'
        draw.text((16, 945), status, font=font, fill='#ffd23f')
        draw.text((16, 972), 'Normal speed. Images use their decoded video PTS; game time is a separate observed clock.', font=font, fill='#a8bdd7')
        # Publish only after every new frame and caption has succeeded.
        for frame in frames:
            shutil.copyfile(frame['path'], directory / frame['path'].name)
        sheet.save(directory / 'contact-sheet.png')
        (directory / 'contact-sheet.json').write_text(json.dumps({
            'video': video.name, 'durationSeconds': duration,
            'method': 'accurate timestamp seek, one decoded frame, no fps binning',
            'frames': manifest, 'previewStatus': status
        }, indent=2), encoding='utf-8')
        # The context manager recursively removes only this checked private directory.
        if temporary.parent != directory:
            raise RuntimeError('Refusing cleanup outside the capture directory')
    return directory / 'contact-sheet.png'


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', required=True)
    print(make_sheet(Path(parser.parse_args().directory)))
