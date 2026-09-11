import { handleMarketingOptInRequest } from '../src/lib/marketing-opt-in-handler.js';

export default async function handler(request, response) {
  return handleMarketingOptInRequest(request, response);
}
