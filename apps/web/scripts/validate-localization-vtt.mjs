#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

function parseTimestamp(value) {
  const match = String(value).match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) throw new Error(`Invalid WebVTT timestamp: ${value}`);
  const [, hh, mm, ss, ms] = match;
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms) / 1000;
}

export function validateLocalizationVtt(source, options = {}) {
  const {
    maxDurationSeconds = null,
    maxVisualLines = 2,
  } = options;

  const text = String(source ?? '').replace(/\r\n/g, '\n').trim();
  if (!text.startsWith('WEBVTT')) {
    throw new Error('WebVTT file must begin with WEBVTT');
  }

  const blocks = text.split(/\n{2,}/);
  const cues = [];
  let previousEnd = -1;

  for (const block of blocks.slice(1)) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length === 0 || lines[0] === 'NOTE' || lines[0].startsWith('NOTE ')) {
      continue;
    }

    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0) continue;

    const timing = lines[timingIndex].match(
      /^(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})(?:\s+.*)?$/,
    );
    if (!timing) throw new Error(`Invalid cue timing line: ${lines[timingIndex]}`);

    const start = parseTimestamp(timing[1]);
    const end = parseTimestamp(timing[2]);
    const body = lines.slice(timingIndex + 1);

    if (!(start < end)) throw new Error(`Cue start must be before end: ${lines[timingIndex]}`);
    if (start < previousEnd) throw new Error(`Cue overlap detected at ${timing[1]}`);
    if (body.length < 1) throw new Error(`Cue at ${timing[1]} has no caption text`);
    if (body.length > maxVisualLines) {
      throw new Error(`Cue at ${timing[1]} exceeds ${maxVisualLines} visual lines`);
    }
    if (maxDurationSeconds != null && end > Number(maxDurationSeconds) + 0.001) {
      throw new Error(
        `Cue ending ${timing[2]} exceeds media duration ${Number(maxDurationSeconds).toFixed(3)}s`,
      );
    }

    cues.push({ start, end, lines: body });
    previousEnd = end;
  }

  if (cues.length === 0) throw new Error('No WebVTT cues found');

  return {
    cueCount: cues.length,
    firstStartSeconds: cues[0].start,
    lastEndSeconds: cues.at(-1).end,
    maxVisualLines,
    maxDurationSeconds,
  };
}

async function main() {
  const [filePath, durationArg] = process.argv.slice(2);
  if (!filePath) {
    console.error('Usage: node scripts/validate-localization-vtt.mjs <file.vtt> [durationSeconds]');
    process.exitCode = 2;
    return;
  }

  const source = await readFile(filePath, 'utf8');
  const result = validateLocalizationVtt(source, {
    maxDurationSeconds: durationArg == null ? null : Number(durationArg),
  });
  console.log(JSON.stringify(result));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
