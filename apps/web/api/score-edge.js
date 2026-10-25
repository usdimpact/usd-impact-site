import { handleScoreEdgeBridge } from '../src/lib/score-edge-bridge.js';

export default async function handler(request, response) {
  return handleScoreEdgeBridge(request, response);
}
