import handleScoreMemberRequest from '../src/lib/score-member-handler.js';

export default async function handler(request, response) {
  return handleScoreMemberRequest(request, response);
}
