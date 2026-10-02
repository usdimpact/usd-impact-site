import { createCloudflareStreamToken } from '../src/lib/cloudflare-stream.js';
import { getStreamCustomerCode, getStreamUid } from '../src/lib/video-stream-map.js';

const NONCE = 'dxy-ffmpeg-9e8a4c1d77a849f49dd2106fd3086a32';
const EXPIRES = Date.parse('2026-10-02T21:00:00Z');

export default async function handler(request, response) {
  const url = new URL(request.url || '/', 'https://usd-impact.invalid');
  if (
    process.env.VERCEL_ENV !== 'preview'
    || Date.now() > EXPIRES
    || request.method !== 'GET'
    || url.searchParams.get('k') !== NONCE
  ) {
    response.statusCode = 404;
    return response.end('Not found.');
  }

  try {
    const uid = getStreamUid('dxy-the-signal-vs-the-system');
    const customerCode = getStreamCustomerCode(process.env);
    const token = await createCloudflareStreamToken({ videoUid: uid, environment: process.env });
    const manifest = `https://customer-${customerCode}.cloudflarestream.com/${encodeURIComponent(token)}/manifest/video.m3u8`;
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    return response.end(JSON.stringify({ manifest }));
  } catch {
    response.statusCode = 503;
    return response.end(JSON.stringify({ error: 'unavailable' }));
  }
}
