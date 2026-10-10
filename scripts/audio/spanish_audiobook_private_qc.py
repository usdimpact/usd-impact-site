#!/usr/bin/env python3
"""Read-only checks for 20 PRIVATE Spanish audiobook WAV exports.

No audio edits, no uploads, no release/mastering approval. Requires ffmpeg/ffprobe.
"""
import argparse
import hashlib
import json
import math
import re
import statistics
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def command(argv, timeout=600):
    r = subprocess.run(argv, text=True, capture_output=True, timeout=timeout)
    if r.returncode:
        raise RuntimeError((r.stderr or 'Command failed')[-650:])
    return r.stdout, r.stderr


def file_hash(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def number(value):
    try:
        x = float(value)
        return x if math.isfinite(x) else None
    except (ValueError, TypeError):
        return None


def probe(path):
    out, _ = command(['ffprobe', '-v', 'error', '-show_entries',
                      'format=duration:stream=codec_type,codec_name,sample_rate,channels',
                      '-of', 'json', str(path)], timeout=90)
    d = json.loads(out)
    streams = [s for s in d.get('streams', []) if s.get('codec_type') == 'audio']
    if len(streams) != 1:
        raise ValueError('Audio stream count is not one')
    s = streams[0]
    return {'duration_seconds': number(d['format']['duration']),
            'sample_rate_hz': int(s['sample_rate']), 'channels': int(s['channels']),
            'codec': s.get('codec_name')}


def measure(path, duration):
    # silencedetect sees unmodified input; loudnorm measures input but outputs to null.
    _, log = command(['ffmpeg', '-hide_banner', '-nostats', '-v', 'info', '-i', str(path),
                      '-vn', '-af', 'silencedetect=noise=-45dB:d=5,'
                      'loudnorm=I=-16:TP=-2:LRA=11:print_format=json',
                      '-f', 'null', '-'])
    chunks = re.findall(r'\{\s*"input_i"\s*:\s*"[^"]+".*?\}', log, re.S)
    if not chunks:
        raise RuntimeError('loudnorm input readings not found')
    j = json.loads(chunks[-1])
    silences, start = [], None
    for line in log.splitlines():
        a = re.search(r'silence_start:\s*([\d.]+)', line)
        b = re.search(r'silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)', line)
        if a:
            start = float(a.group(1))
        if b:
            end = float(b.group(1))
            begin = start if start is not None else max(0, end - float(b.group(2)))
            silences.append([round(begin, 3), round(end, 3)])
            start = None
    if start is not None:
        silences.append([round(start, 3), round(duration, 3)])
    return {'integrated_lufs': number(j.get('input_i')),
            'true_peak_dbtp': number(j.get('input_tp')),
            'loudness_range_lu': number(j.get('input_lra')),
            'silence_intervals_5s_minus45db': silences}


def analyze(manifest, audio_dir, *, metadata_only=False, allow_subset=False):
    tracks = json.loads(manifest.read_text(encoding='utf-8'))['tracks']
    if (len(tracks) != 20 or {x['track'] for x in tracks} !=
            {f'{i:02}' for i in range(20)}) and not allow_subset:
        raise ValueError('Expected exactly tracks 00–19 in the selected manifest')
    rows, seen = [], set()
    for t in sorted(tracks, key=lambda x: x['track']):
        k = t['track']
        if not re.fullmatch(r'[0-9]{2}', k) or k in seen:
            raise ValueError('Invalid or repeated track key')
        seen.add(k)
        fn = f'ES_{k}_PRIVATE_QA.wav'
        path = audio_dir / fn
        row = {'track': k, 'expected_composition_uuid': t['private_review_composition_id'],
               'filename': fn, 'expected_duration_seconds': t['duration_seconds'],
               'flags': [], 'status': 'PENDING'}
        if not path.is_file():
            row.update(status='MISSING_EXPORT', flags=['MISSING_EXPORT'])
            rows.append(row)
            continue
        row['sha256'] = file_hash(path)
        row['bytes'] = path.stat().st_size
        try:
            info = probe(path)
            row.update(info)
            if info['duration_seconds'] is None:
                raise ValueError('Duration not measurable')
            row['duration_delta_seconds'] = round(info['duration_seconds'] - t['duration_seconds'], 6)
            if abs(row['duration_delta_seconds']) > .5:
                row['flags'].append('REVIEW_DURATION_GT_0_5S')
            if info['sample_rate_hz'] != 44100 or info['channels'] != 1:
                row['flags'].append('REVIEW_SAMPLE_FORMAT')
            if not metadata_only:
                row.update(measure(path, info['duration_seconds']))
                if row['true_peak_dbtp'] is None or row['true_peak_dbtp'] >= 0:
                    row['flags'].append('REVIEW_TRUE_PEAK')
                if row['silence_intervals_5s_minus45db']:
                    row['flags'].append('LISTEN_TO_LONG_SILENCE')
            row['status'] = 'REVIEW' if row['flags'] else 'MEASURED_NOT_MASTER_APPROVED'
        except (RuntimeError, ValueError, KeyError, subprocess.TimeoutExpired) as exc:
            row['status'] = 'MEASUREMENT_ERROR'
            row['flags'].append('MEASUREMENT_ERROR')
            row['error'] = str(exc)[:650]
        rows.append(row)
    measured = [r for r in rows if r.get('integrated_lufs') is not None]
    median = statistics.median(r['integrated_lufs'] for r in measured) if measured else None
    if len(measured) >= 2:
        for r in measured:
            if abs(r['integrated_lufs'] - median) > 2.5:
                r['flags'].append('REVIEW_LOUDNESS_SPREAD_GT_2_5LU')
                r['status'] = 'REVIEW'
    return {'generated_utc': datetime.now(timezone.utc).isoformat(),
            'disposition': 'PRIVATE_PREFLIGHT_ONLY_NO_AUDIO_EDITS_NO_MASTERING_OR_PUBLICATION',
            'warning': 'WAV filenames cannot cryptographically prove Descript composition identity; owner must verify selected UUIDs during export.',
            'thresholds_are_provisional': True,
            'summary': {'expected': len(rows), 'present': sum(r['status'] != 'MISSING_EXPORT' for r in rows),
                        'review_tracks': [r['track'] for r in rows if r['flags']],
                        'median_integrated_lufs': median}, 'tracks': rows}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--manifest', type=Path, required=True)
    ap.add_argument('--audio-dir', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    ap.add_argument('--metadata-only', action='store_true')
    ns = ap.parse_args(argv)
    try:
        data = analyze(ns.manifest, ns.audio_dir, metadata_only=ns.metadata_only)
    except (KeyError, ValueError, RuntimeError, OSError, json.JSONDecodeError) as exc:
        print('Private QA could not start:', exc, file=sys.stderr)
        return 3
    ns.output.parent.mkdir(parents=True, exist_ok=True)
    ns.output.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps(data['summary'], indent=2))
    return 2 if data['summary']['review_tracks'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
