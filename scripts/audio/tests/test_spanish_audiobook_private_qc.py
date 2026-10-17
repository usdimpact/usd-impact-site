"""Synthetic-only QA tests. No customer audio is included."""
import importlib.util
import json
import math
import struct
import tempfile
import unittest
import wave
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "spanish_audiobook_private_qc.py"
spec = importlib.util.spec_from_file_location("audio_qc", SOURCE)
audio_qc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio_qc)


def tone(path, duration=1.0):
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(44100)
        wav.writeframes(b"".join(struct.pack("<h", round(6000 * math.sin(
            2 * math.pi * 440 * i / 44100))) for i in range(round(duration * 44100))))


class PrivateQATests(unittest.TestCase):
    def test_measured_and_missing_exports(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            audio = root / "private"
            audio.mkdir()
            tone(audio / "ES_00_PRIVATE_QA.wav")
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({"tracks": [
                {"track": "00", "private_review_composition_id": "uuid0", "duration_seconds": 1},
                {"track": "01", "private_review_composition_id": "uuid1", "duration_seconds": 1}
            ]}))
            report = audio_qc.analyze(manifest, audio, allow_subset=True)
            self.assertEqual(report["summary"]["present"], 1)
            self.assertEqual(report["tracks"][1]["status"], "MISSING_EXPORT")
            self.assertIsNotNone(report["tracks"][0]["integrated_lufs"])
            self.assertLess(report["tracks"][0]["true_peak_dbtp"], 0)
            self.assertEqual(report["tracks"][0]["duration_delta_seconds"], 0)

    def test_path_traversal_and_invalid_track_key_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            audio = root / "private"
            audio.mkdir()
            manifest = root / "m.json"
            manifest.write_text(json.dumps({"tracks": [
                {"track": "../secret", "private_review_composition_id": "uuid0",
                 "duration_seconds": 1}
            ]}))
            with self.assertRaises(ValueError):
                audio_qc.analyze(manifest, audio, allow_subset=True)

    def test_five_second_silence_flag(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "s.wav"
            with wave.open(str(p), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(44100)
                wav.writeframes(b"\0\0" * int(44100 * 6.1))
            measured = audio_qc.measure(p, 6.1)
            self.assertTrue(measured["silence_intervals_5s_minus45db"])


if __name__ == "__main__":
    unittest.main()
