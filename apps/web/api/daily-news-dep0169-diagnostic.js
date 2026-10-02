import { requestParam } from './daily-news-background.js';

export default function handler(request, response) {
  if (process.env.VERCEL_ENV !== 'preview') {
    response.statusCode = 404;
    return response.end('Not found.');
  }

  const date = requestParam(request, 'date');
  const responseId = requestParam(request, 'response_id');

  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  return response.end(JSON.stringify({
    ok: true,
    dateWasReadFromHeaderOnly: date === '',
    responseIdWasReadFromHeaderOnly: responseId === '',
  }));
}
