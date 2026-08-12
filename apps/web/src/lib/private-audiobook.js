import { readTheDollarFirstAudiobook } from '../data/read-the-dollar-first-audiobook.js';
import { readSupabaseServerConfig } from './supabase-server.js';

export const AUDIOBOOK_MEMBER_PATH = '/guided-edition/audiobook/';
export const AUDIOBOOK_TRACK_PATH_PREFIX = '/guided-edition/audiobook/track/';
export const PRIVATE_AUDIOBOOK_BUCKET = 'library-pass-assets';
export const PRIVATE_AUDIOBOOK_PREFIX = 'audiobook/read-the-dollar-first/v1';
export const AUDIOBOOK_SIGNED_URL_TTL_SECONDS = 3600;

const PRIVATE_TRACK_RECORDS = [
  ['read-the-dollar-first', '00-read-the-dollar-first.mp3', 2128764, '946012ea5010c48be184b0d358741ec7926a844bb42960398443aac9dc4ddb91'],
  ['acknowledgments-and-reader-guide', '01-acknowledgments-and-reader-guide.mp3', 4293594, '404c79abe686a0811ae480aaff7e406bfe6885ad62139d6a5a237271328d160d'],
  ['introduction-why-this-book-exists', '02-introduction-why-this-book-exists.mp3', 16648680, 'a79212c7e18919292b89737e851e02a63df18339e017ff2deee52d9a7f9315eb'],
  ['chapter-1-why-the-dollar-comes-first', '03-chapter-1-why-the-dollar-comes-first.mp3', 21081767, '8b4ac6c668566c61dc4d2a8b1b60c85667fa6d901fd8494f8073ce41c8ec96bb'],
  ['chapter-2-from-bretton-woods-to-fiat-discipline', '04-chapter-2-from-bretton-woods-to-fiat-discipline.mp3', 21711851, 'd4b0cce22e9f86de380cf70dbc46f8abdf159eac0e9809a8366efb71d2596e56'],
  ['chapter-3-usd-is-not-dxy', '05-chapter-3-usd-is-not-dxy.mp3', 22664148, '65a7678580e9fbf7e1e50c436d5d9e9fc88326bde1a8f5d3d89b92023460ec7f'],
  ['chapter-4-how-the-dollar-moves-oil-gold-bitcoin-gas-and-fx', '06-chapter-4-how-the-dollar-moves-oil-gold-bitcoin-gas-and-fx.mp3', 27391305, '89858e715b9385a2e2d5afbecbeec9c62a656420e2f3a459ed72684c0abda70c'],
  ['chapter-5-oil-is-not-a-dollar-trade-only', '07-chapter-5-oil-is-not-a-dollar-trade-only.mp3', 24178221, 'b9e1eb43b60266a7bb1dbc59c35c9bcd195fbe221b193098b17cd3b13d1ba7ea'],
  ['chapter-6-gold-and-the-dollar', '08-chapter-6-gold-and-the-dollar.mp3', 19479304, '00b5efa8428fe6f80b43a099ac9f9f544ec08ad95af93035b730416cd76566b1'],
  ['chapter-7-bitcoin-and-the-dollar', '09-chapter-7-bitcoin-and-the-dollar.mp3', 21664190, 'b0432e533278983f478c6ee973ea04b8422d150f61f2469dbbd26408e4bd92bf'],
  ['chapter-8-gas-lng-and-the-dollar', '10-chapter-8-gas-lng-and-the-dollar.mp3', 19505015, 'd0c5214d762c179953e74070074143db639771bf7c79f579a6105a29c7464f3e'],
  ['chapter-9-fx-carry-and-translation-risk', '11-chapter-9-fx-carry-and-translation-risk.mp3', 18167135, '3cb80f6f9d8a68c0ac5ba1af9a7ea91803a49b2f0178df2bba72b0b6ba2b982d'],
  ['chapter-10-reading-regimes-the-eleven-year-record', '12-chapter-10-reading-regimes-the-eleven-year-record.mp3', 37150223, 'eb6b24eba2cff93ad0d35680ced2a4c113f3cd0ae42e62e2adbe2aab5b5ae127'],
  ['chapter-11-the-weekly-operating-framework', '13-chapter-11-the-weekly-operating-framework.mp3', 18683105, '26554932d63675ce4452847341793834cfc5b909ab09e9289f2a4405e6688879'],
  ['chapter-12-common-mistakes-in-dollar-and-cross-asset-analysis', '14-chapter-12-common-mistakes-in-dollar-and-cross-asset-analysis.mp3', 23274825, '6bd33b69d966b04cb857985a0707056e0ed74cc70d20a88c23f072ae065a328f'],
  ['chapter-13-what-to-watch-from-here', '15-chapter-13-what-to-watch-from-here.mp3', 26885965, '53c3fe19f740405c3c08b8d3d90f30f2248766fb300d97b0606b1c8f32bb370e'],
  ['further-reading', '16-further-reading.mp3', 3219632, '9a9565410970b5f5c1f7bfec39313c1b82656f7546177cec518e3603d4483e6d'],
  ['appendix-a-quick-glossary', '17-appendix-a-quick-glossary.mp3', 24751856, '450b6a97b096708435f0db891e4ee9dec17458a3338c4dbddfc587a4c9699c6c'],
  ['appendix-b-usd-impact-score-methodology', '18-appendix-b-usd-impact-score-methodology.mp3', 18886231, '349844333398a408d01c714f511a1b1e805874a7b2ed2a4e09c34db677593b3f'],
  ['about-usd-impact', '19-about-usd-impact.mp3', 881779, 'faf54b3a98488ee8b8386a7adaa208f47ed2bb9f8ef549bca5f1188a4b6d1d00'],
];

function privateAudiobookError(message, { code, status = 503 } = {}) {
  const error = new Error(message);
  error.name = 'PrivateAudiobookError';
  error.code = code || 'PRIVATE_AUDIOBOOK_UNAVAILABLE';
  error.status = status;
  return error;
}

function encodeStoragePath(value) {
  return String(value).split('/').map(encodeURIComponent).join('/');
}

function requireSignedUrl(payload, config, objectPath) {
  const raw = payload?.signedURL || payload?.signedUrl;
  if (typeof raw !== 'string' || !raw.trim()) {
    throw privateAudiobookError('The private audiobook URL could not be created.', { code: 'INVALID_SIGNED_URL' });
  }

  const expectedPath = `/storage/v1/object/sign/${encodeStoragePath(PRIVATE_AUDIOBOOK_BUCKET)}/${encodeStoragePath(objectPath)}`;
  const candidate = raw.startsWith('/object/sign/')
    ? `${config.url}/storage/v1${raw}`
    : new URL(raw, `${config.url}/`).toString();
  const signedUrl = new URL(candidate);
  if (
    signedUrl.origin !== config.url
    || signedUrl.pathname !== expectedPath
    || !signedUrl.searchParams.get('token')
  ) {
    throw privateAudiobookError('The private audiobook URL failed validation.', { code: 'INVALID_SIGNED_URL' });
  }
  return signedUrl.toString();
}

export const privateAudiobookTracks = Object.freeze(PRIVATE_TRACK_RECORDS.map(
  ([slug, file, size, sha256], index) => {
    const publicTrack = readTheDollarFirstAudiobook.chapters[index];
    if (!publicTrack || publicTrack.slug !== slug) {
      throw privateAudiobookError('The audiobook manifests do not match.', { code: 'AUDIOBOOK_MANIFEST_MISMATCH', status: 500 });
    }
    return Object.freeze({
      ...publicTrack,
      file,
      size,
      sha256,
      objectPath: `${PRIVATE_AUDIOBOOK_PREFIX}/${file}`,
    });
  },
));

const tracksBySlug = new Map(privateAudiobookTracks.map((track) => [track.slug, track]));

export function getPrivateAudiobookTrack(slug) {
  const normalized = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) return null;
  return tracksBySlug.get(normalized) || null;
}

export function privateAudiobookTrackHref(track) {
  if (!track || tracksBySlug.get(track.slug) !== track) {
    throw privateAudiobookError('Choose a valid audiobook track.', { code: 'INVALID_AUDIOBOOK_TRACK', status: 400 });
  }
  return `${AUDIOBOOK_TRACK_PATH_PREFIX}${encodeURIComponent(track.slug)}/`;
}

export async function createSignedAudiobookTrackUrl({
  slug,
  environment = process.env,
  config,
  fetchImpl = fetch,
  expiresIn = AUDIOBOOK_SIGNED_URL_TTL_SECONDS,
} = {}) {
  const track = getPrivateAudiobookTrack(slug);
  if (!track) {
    throw privateAudiobookError('Choose a valid audiobook track.', { code: 'INVALID_AUDIOBOOK_TRACK', status: 404 });
  }
  if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 7200) {
    throw privateAudiobookError('The private audiobook expiry is invalid.', { code: 'INVALID_SIGNED_URL_EXPIRY', status: 500 });
  }

  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const endpoint = `${resolvedConfig.url}/storage/v1/object/sign/${encodeStoragePath(PRIVATE_AUDIOBOOK_BUCKET)}/${encodeStoragePath(track.objectPath)}`;
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        apikey: resolvedConfig.secretKey,
        Authorization: `Bearer ${resolvedConfig.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn }),
    });
  } catch {
    throw privateAudiobookError('The private audiobook is temporarily unavailable.', { code: 'AUDIOBOOK_STORAGE_UNAVAILABLE' });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // A missing or malformed response remains a fail-closed storage error.
  }
  if (!response.ok) {
    throw privateAudiobookError('The private audiobook is temporarily unavailable.', {
      code: 'AUDIOBOOK_SIGNING_FAILED',
      status: response.status >= 500 ? 503 : 502,
    });
  }
  return requireSignedUrl(payload, resolvedConfig, track.objectPath);
}
