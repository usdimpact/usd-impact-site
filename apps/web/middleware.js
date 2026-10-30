import { next } from '@vercel/functions';
import accessMap from './src/data/quiz-access-map.json' with { type: 'json' };
import {
  canAccessQuizOrder,
  readQuizEntitlement,
} from './src/lib/quiz-entitlement.js';
import { decideResearchPreviewRequest } from './src/lib/research-preview-route.js';

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
    '/research-membership/:path*',
    '/start-here/:path*',
    '/dollar/:path*',
    '/fx/:path*',
    '/dxy/:path*',
    '/regime/:path*',
    '/gold/:path*',
    '/energy/:path*',
    '/equities/:path*',
    '/bitcoin/:path*',
    '/reports/weekly/:path*',
    '/reports/monthly/:path*',
    '/score/:path*',
    '/internal/independent-macro-context/:path*',
  ],
};

export default async function learningAccessMiddleware(request) {
  const url = new URL(request.url);
  const pathname = normalizePath(url.pathname);
  // Independent Macro Context #313 remains an UNRELEASED concept. A static
  // Astro page and robots headers are not access control; deny requests
  // before reaching the static file or any quiz/research entitlement path.
  // Keep this unconditional until separate source-rights, owner, and
  // access-architecture approval. This is not a member/owner login system.
  const privateConcept = '/internal/independent-macro-context';
  if (pathname === privateConcept || pathname.startsWith(`${privateConcept}/`)) {
    return new Response(null, {
      status: 404,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  if (normalizePath(url.pathname) === '/research-membership') {
    url.pathname = '/research/';
    return Response.redirect(url, 301);
  }

  const researchDecision = await decideResearchPreviewRequest({ request });
  if (researchDecision.action === 'redirect') {
    return Response.redirect(researchDecision.location, 302);
  }

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
