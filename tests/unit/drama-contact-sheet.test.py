"""Tiny lossless clips verify actual frame selection; no game/browser is launched."""
import importlib.util
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('drama_contact_sheet', ROOT / 'tools/drama-contact-sheet.py')
SHEET = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SHEET)


class ContactSheetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.qa = (ROOT / '.data/qa').resolve()
        cls.qa.mkdir(parents=True, exist_ok=True)
        cls.temporary = tempfile.TemporaryDirectory(prefix='drama-capture-test-', dir=cls.qa)
        cls.directory = Path(cls.temporary.name).resolve()
        if cls.directory.parent != cls.qa:
            raise RuntimeError('Test fixture escaped QA directory')
        cls.clip = cls.directory / 'luma-timestamps.mkv'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                        '-f', 'lavfi', '-i', 'nullsrc=s=16x16:r=1:d=60',
                        '-vf', 'geq=lum=16+N*3:cb=128:cr=128', '-c:v', 'ffv1',
                        str(cls.clip)], check=True)

    @classmethod
    def tearDownClass(cls):
        if cls.directory.parent != cls.qa or not cls.directory.name.startswith('drama-capture-test-'):
            raise RuntimeError('Refusing fixture cleanup outside QA directory')
        cls.temporary.cleanup()

    def test_exact_timestamp_pixels(self):
        frames = SHEET.extract_frames(self.clip, self.directory / 'selected')
        self.assertEqual([f['actual'] for f in frames], list(range(0, 60, 5)))
        for frame in frames:
            with Image.open(frame['path']) as image:
                self.assertEqual(image.size, (480, 270))
                value = image.convert('RGB').getpixel((240, 135))[0]
                # Swscale's integer YUV→RGB conversion can round a few code values;
                # a wrong mid-bin frame differs by about9, beyond this allowance.
                self.assertAlmostEqual(value, frame['requested'] * 3 * 255 / 219, delta=3)

    def fixture(self, name):
        directory = self.directory / name
        directory.mkdir()
        # The lossless Matroska fixture is identified by its container bytes.
        shutil.copyfile(self.clip, directory / 'normal-speed.webm')
        data = {'samples': [{'wall': t, 'time': t * .8, 'alive': 24} for t in range(61)],
                'preview': {'includesResult': True, 'includesFullPayoff': False},
                'fullRound': {'includesFullPayoff': True}}
        (directory / 'capture.json').write_text(json.dumps(data), encoding='utf-8')
        return directory

    def test_sheet_and_manifest_use_actual_video_pts(self):
        directory = self.fixture('valid-sheet')
        output = SHEET.make_sheet(directory)
        self.assertTrue(output.is_file())
        data = json.loads((directory / 'contact-sheet.json').read_text(encoding='utf-8'))
        self.assertEqual(len(data['frames']), 12)
        self.assertEqual([f['decodedVideoSeconds'] for f in data['frames']], list(range(0, 60, 5)))
        self.assertEqual(data['frames'][4]['gameSeconds'], 16)
        self.assertIn('FULL PAYOFF CONTINUES', data['previewStatus'])

    def test_stale_frames_cannot_make_short_media_pass(self):
        directory = self.fixture('short-with-stale-frames')
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i',
                        str(self.clip), '-t', '20', '-c', 'copy',
                        str(directory / 'normal-speed.webm.mkv')], check=True)
        shutil.copyfile(directory / 'normal-speed.webm.mkv', directory / 'normal-speed.webm')
        for index in range(1, 13):
            Image.new('RGB', (480, 270), 'red').save(directory / f'frame-{index:02}.png')
        with self.assertRaisesRegex(RuntimeError, 'nominal60s preview'):
            SHEET.make_sheet(directory)
        self.assertFalse((directory / 'contact-sheet.png').exists())

    def test_unverified_clock_overrides_a_positive_payoff_estimate(self):
        directory = self.fixture('provisional-clock')
        data = json.loads((directory / 'capture.json').read_text(encoding='utf-8'))
        data['provisionalTimeAlignment'] = True
        data['preview']['includesFullPayoff'] = True
        (directory / 'capture.json').write_text(json.dumps(data), encoding='utf-8')
        SHEET.make_sheet(directory)
        manifest = json.loads((directory / 'contact-sheet.json').read_text(encoding='utf-8'))
        self.assertIn('PROVISIONAL CLOCK ALIGNMENT', manifest['previewStatus'])
        self.assertNotIn('AT LEAST5s', manifest['previewStatus'])


if __name__ == '__main__':
    unittest.main()
