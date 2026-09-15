import { next, rewrite } from '@vercel/functions';
import accessMap from './src/data/quiz-access-map.json' with { type: 'json' };
import {
  canAccessQuizOrder,
  readQuizEntitlement,
} from './src/lib/quiz-entitlement.js';
import { planPublicationPublicRouteRequest } from './src/lib/publication-public-route-wiring.js';
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

const PUBLICATION_DENY_HEADERS = Object.freeze({
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Content-Type': 'text/plain; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
});

function publicationDenyResponse(request, plan) {
  const message = plan.status === 404 ? 'Not found.\n'
    : plan.status === 405 ? 'Method not allowed.\n'
      : 'Publication unavailable.\n';
  const headers = new Headers(PUBLICATION_DENY_HEADERS);
  if (plan.status === 405) headers.set('Allow', 'GET, HEAD');
  if (request.method !== 'HEAD') headers.set('Content-Length', String(Buffer.byteLength(message)));
  return new Response(request.method === 'HEAD' ? null : message, { status: plan.status, headers });
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/',
    '/index.html',
    '/news',
    '/news/:path*',
    '/sitemap-0.xml',
    '/sitemap-0.xml/:path*',
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
  ],
};

export default async function learningAccessMiddleware(request) {
  const publicationPlan = planPublicationPublicRouteRequest({ request });
  if (publicationPlan.action === 'rewrite') {
    return rewrite(new URL(publicationPlan.destination), {
      request: { headers: publicationPlan.requestHeaders },
    });
  }
  if (publicationPlan.action === 'deny') return publicationDenyResponse(request, publicationPlan);
  if (publicationPlan.routeKind !== 'unrelated') return next();

  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  const url = new URL(request.url);
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
