import { next } from '@vercel/functions';
import accessMap from './src/data/quiz-access-map.json' with { type: 'json' };
import {
  canAccessQuizOrder,
  readQuizEntitlement,
} from './src/lib/quiz-entitlement.js';
import {
  decidePaidRouteAccess,
  isPaidContentPath,
  readPaidAccessFromAccountApi,
} from './src/lib/paid-route.js';

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
    '/guided-edition/:path*',
  ],
};

async function enforcePaidRoute(request, url) {
  try {
    const result = await readPaidAccessFromAccountApi({
      requestUrl: url,
      cookieHeader: request.headers.get('cookie') ?? '',
    });
    const decision = decidePaidRouteAccess({
      requestUrl: url,
      hasSession: result.hasSession,
      accessState: result.accessState,
    });
    return decision.action === 'allow'
      ? next()
      : Response.redirect(decision.location, 302);
  } catch (error) {
    console.error('Paid-route authorization failed closed.', {
      name: error instanceof Error ? error.name : 'UnknownError',
      code: typeof error?.code === 'string' ? error.code : null,
      status: Number.isInteger(error?.status) ? error.status : null,
    });
    const decision = decidePaidRouteAccess({
      requestUrl: url,
      hasSession: true,
      accessState: { allowed: false, reason: 'denied' },
    });
    return Response.redirect(decision.location, 302);
  }
}

export default async function learningAndPaidAccessMiddleware(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  const url = new URL(request.url);
  if (isPaidContentPath(url.pathname)) return enforcePaidRoute(request, url);

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
