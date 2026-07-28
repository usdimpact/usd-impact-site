import { next } from '@vercel/functions';
import accessMap from './src/data/quiz-access-map.json' with { type: 'json' };
import {
  canAccessQuizOrder,
  readQuizEntitlement,
} from './src/lib/quiz-entitlement.js';

const normalizePath = (value) => {
  const normalized = value.replace(/\/+$/, '');
  return normalized || '/';
};

const protectedRoutes = new Map();
for (const quiz of accessMap.quizzes) {
  protectedRoutes.set(normalizePath(quiz.relatedLessonUrl), quiz.order);
  protectedRoutes.set(normalizePath(quiz.slug), quiz.order);
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/start-here/:path*',
    '/dollar/:path*',
    '/fx/:path*',
    '/dxy/:path*',
    '/regime/:path*',
    '/gold/:path*',
    '/energy/:path*',
    '/equities/:path*',
    '/bitcoin/:path*',
  ],
};

export default function learningProgressMiddleware(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  const url = new URL(request.url);
  const order = protectedRoutes.get(normalizePath(url.pathname));
  if (!order) return next();

  const progress = readQuizEntitlement(
    request.headers.get('cookie') ?? '',
    process.env.QUIZ_PROGRESS_SECRET,
    accessMap.quizzes.length,
  );

  if (canAccessQuizOrder(progress.entitlement, order)) return next();

  const current = accessMap.quizzes[Math.max(0, progress.entitlement.highestUnlockedOrder - 1)];
  const destination = new URL(`${current.relatedLessonUrl}/`, request.url);
  destination.searchParams.set('locked', '1');
  return Response.redirect(destination, 302);
}
