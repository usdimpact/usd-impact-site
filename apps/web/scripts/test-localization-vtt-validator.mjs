import assert from 'node:assert/strict';
import { validateLocalizationVtt } from './validate-localization-vtt.mjs';

const valid = `WEBVTT

NOTE
HOLD - unpublished localization asset.

00:00:00.100 --> 00:00:01.500
Primera línea.
Segunda línea.

00:00:01.700 --> 00:00:03.000
Última línea.
`;

assert.deepEqual(
  validateLocalizationVtt(valid, { maxDurationSeconds: 3.2 }),
  {
    cueCount: 2,
    firstStartSeconds: 0.1,
    lastEndSeconds: 3,
    maxVisualLines: 2,
    maxDurationSeconds: 3.2,
  },
);

assert.throws(
  () => validateLocalizationVtt(
    `WEBVTT

00:00:00.100 --> 00:00:02.000
Uno.

00:00:01.900 --> 00:00:03.000
Dos.
`,
  ),
  /overlap/i,
);

assert.throws(
  () => validateLocalizationVtt(
    `WEBVTT

00:00:00.100 --> 00:00:01.000
Uno.
Dos.
Tres.
`,
  ),
  /visual lines/i,
);

assert.throws(
  () => validateLocalizationVtt(
    `WEBVTT

00:00:00.100 --> 00:00:04.000
Uno.
`,
    { maxDurationSeconds: 3.5 },
  ),
  /exceeds media duration/i,
);

const shortForm = `WEBVTT

00:00.000 --> 00:02.860
Short-form timestamps.

05:38.670 --> 05:40.040
Final cue.
`;

assert.deepEqual(
  validateLocalizationVtt(shortForm, { maxDurationSeconds: 340.288 }),
  {
    cueCount: 2,
    firstStartSeconds: 0,
    lastEndSeconds: 340.04,
    maxVisualLines: 2,
    maxDurationSeconds: 340.288,
  },
);

console.log('localization WebVTT validator: PASS');
