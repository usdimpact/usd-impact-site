import chaptersData from './chapters.json' with { type: 'json' };
import toolsData from './tools.json' with { type: 'json' };
import printLinksData from './print-links.json' with { type: 'json' };
import surfaceBridgesData from './surface-bridges.json' with { type: 'json' };

export const BOOK_EDITION = '1.2';
export const BRIDGE_VERSION = '0.1.0-preview';
export const SURFACE_BRIDGE_VERSION = '0.2.0-preview';
export const chapters = Object.freeze(chaptersData);
export const tools = Object.freeze(toolsData);
export const printLinks = Object.freeze(printLinksData);
export const surfaceBridges = Object.freeze(surfaceBridgesData);

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(`Book-site bridge registry error: ${message}`);
  }
}

function normalizeSurfacePath(value) {
  const rawPath = String(value ?? '/').split(/[?#]/)[0] || '/';
  const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  if (withLeadingSlash === '/') return '/';
  return `${withLeadingSlash.replace(/\/+$/, '')}/`;
}

function validateBridgeRegistry() {
  requireCondition(chapters.length === 13, 'the certified edition must contain 13 governed chapters');
  requireCondition(tools.length === 6, 'Phase 0-1 must expose exactly 6 governed tools');
  requireCondition(printLinks.length === 19, 'the print-safe scheme must expose exactly 19 aliases');
  requireCondition(surfaceBridges.length === 5, 'Phase 2A must expose exactly 5 governed contextual surface mappings');

  const certifiedStartPages = [8, 12, 16, 21, 27, 32, 36, 41, 45, 49, 56, 60, 65];
  const chapterIds = new Set();
  const chapterNumbers = new Set();
  const shortCodes = new Set();

  for (const chapter of chapters) {
    requireCondition(!chapterIds.has(chapter.id), `duplicate chapter id ${chapter.id}`);
    requireCondition(!chapterNumbers.has(chapter.number), `duplicate chapter number ${chapter.number}`);
    requireCondition(!shortCodes.has(chapter.shortCode), `duplicate chapter short code ${chapter.shortCode}`);
    chapterIds.add(chapter.id);
    chapterNumbers.add(chapter.number);
    shortCodes.add(chapter.shortCode);

    requireCondition(chapter.code === String(chapter.number).padStart(2, '0'), `${chapter.id} has an invalid code`);
    requireCondition(chapter.shortCode === `c${chapter.code}`, `${chapter.id} has an invalid print short code`);
    requireCondition(chapter.bookPage === certifiedStartPages[chapter.number - 1], `${chapter.id} no longer matches the certified table of contents`);
    requireCondition(chapter.edition === BOOK_EDITION, `${chapter.id} has an unexpected edition`);
    requireCondition(typeof chapter.summary === 'string' && chapter.summary.length >= 40, `${chapter.id} needs a meaningful summary`);
    requireCondition(Array.isArray(chapter.learningObjectives) && chapter.learningObjectives.length >= 2, `${chapter.id} needs learning objectives`);
    requireCondition(Array.isArray(chapter.commonMistakes) && chapter.commonMistakes.length >= 1, `${chapter.id} needs a diagnostic mistake`);
    requireCondition(Array.isArray(chapter.toolIds) && chapter.toolIds.length >= 1, `${chapter.id} must connect to at least one tool`);
    requireCondition(typeof chapter.practicePath === 'string' && chapter.practicePath.startsWith('/'), `${chapter.id} practice path must be internal`);
  }

  const toolIds = new Set();
  for (const tool of tools) {
    requireCondition(!toolIds.has(tool.id), `duplicate tool id ${tool.id}`);
    toolIds.add(tool.id);
    requireCondition(typeof tool.path === 'string' && tool.path.startsWith('/'), `${tool.id} path must be internal`);
    requireCondition(Array.isArray(tool.steps) && tool.steps.length === 3, `${tool.id} must expose exactly three use steps`);
    requireCondition(Array.isArray(tool.inputs) && tool.inputs.length >= 1, `${tool.id} needs declared inputs`);
    requireCondition(typeof tool.dataCadence === 'string' && tool.dataCadence.length >= 10, `${tool.id} needs a data cadence statement`);
    requireCondition(typeof tool.timestampRule === 'string' && tool.timestampRule.length >= 10, `${tool.id} needs a timestamp rule`);
    requireCondition(Array.isArray(tool.agreement) && tool.agreement.length >= 1, `${tool.id} needs an agreement interpretation`);
    requireCondition(Array.isArray(tool.divergence) && tool.divergence.length >= 1, `${tool.id} needs a divergence interpretation`);
    requireCondition(Array.isArray(tool.limitations) && tool.limitations.length >= 2, `${tool.id} needs explicit limitations`);
    requireCondition(Array.isArray(tool.chapterIds) && tool.chapterIds.length >= 1, `${tool.id} needs at least one chapter connection`);
    requireCondition(Array.isArray(tool.currentEvidence) && tool.currentEvidence.length >= 1, `${tool.id} needs current-evidence links`);

    for (const chapterId of tool.chapterIds) {
      const chapter = chapters.find((candidate) => candidate.id === chapterId);
      requireCondition(Boolean(chapter), `${tool.id} references missing ${chapterId}`);
      requireCondition(chapter.toolIds.includes(tool.id), `${tool.id} to ${chapterId} is not reciprocal`);
    }
  }

  for (const chapter of chapters) {
    for (const toolId of chapter.toolIds) {
      const tool = tools.find((candidate) => candidate.id === toolId);
      requireCondition(Boolean(tool), `${chapter.id} references missing ${toolId}`);
      requireCondition(tool.chapterIds.includes(chapter.id), `${chapter.id} to ${toolId} is not reciprocal`);
    }
  }

  const printCodes = new Set();
  for (const link of printLinks) {
    requireCondition(!printCodes.has(link.code), `duplicate print alias ${link.code}`);
    printCodes.add(link.code);
    requireCondition(typeof link.target === 'string' && link.target.startsWith('/'), `${link.code} target must be internal`);
    requireCondition(!link.target.includes('//'), `${link.code} target contains a duplicate slash`);
    requireCondition(typeof link.purpose === 'string' && link.purpose.length > 0, `${link.code} needs a purpose`);
  }

  for (let number = 1; number <= 13; number += 1) {
    requireCondition(printCodes.has(`c${String(number).padStart(2, '0')}`), `missing chapter print alias c${number}`);
  }
  for (const requiredCode of ['book', 'companion', 'dxy-practice', 'weekly-practice', 'score', 'methodology']) {
    requireCondition(printCodes.has(requiredCode), `missing print alias ${requiredCode}`);
  }

  const surfaceBridgeIds = new Set();
  const allowedSurfaces = new Set(['score', 'score-methodology', 'weekly-report', 'daily']);
  const allowedMatches = new Set(['exact', 'prefix']);
  for (const bridge of surfaceBridges) {
    requireCondition(!surfaceBridgeIds.has(bridge.id), `duplicate contextual surface mapping ${bridge.id}`);
    surfaceBridgeIds.add(bridge.id);
    requireCondition(allowedSurfaces.has(bridge.surface), `${bridge.id} has an unsupported surface type`);
    requireCondition(allowedMatches.has(bridge.match), `${bridge.id} has an unsupported path match type`);
    requireCondition(typeof bridge.path === 'string' && bridge.path.startsWith('/') && bridge.path.endsWith('/'), `${bridge.id} path must be a normalized internal route`);
    requireCondition(!bridge.path.includes('//'), `${bridge.id} path contains a duplicate slash`);
    requireCondition(Boolean(chapters.find((chapter) => chapter.id === bridge.chapterId)), `${bridge.id} references missing ${bridge.chapterId}`);
    requireCondition(typeof bridge.rationale === 'string' && bridge.rationale.length >= 80, `${bridge.id} needs a relevance-specific rationale`);
    requireCondition(typeof bridge.linkLabel === 'string' && bridge.linkLabel.length >= 10, `${bridge.id} needs a descriptive link label`);
    requireCondition(!/buy the book|unlock|checkout|profit|return guarantee/i.test(`${bridge.rationale} ${bridge.linkLabel}`), `${bridge.id} violates the contextual promotion policy`);
  }

  for (const requiredId of ['weekly-score', 'score-methodology', 'weekly-report', 'daily-2026-08-20', 'daily-2026-08-27']) {
    requireCondition(surfaceBridgeIds.has(requiredId), `missing Phase 2A contextual surface mapping ${requiredId}`);
  }

  return true;
}

export const BRIDGE_REGISTRY_VALID = validateBridgeRegistry();

export function getChapterByNumber(number) {
  return chapters.find((chapter) => chapter.number === Number(number));
}

export function getChapterById(id) {
  return chapters.find((chapter) => chapter.id === id);
}

export function getToolById(id) {
  return tools.find((tool) => tool.id === id);
}

export function getToolsForChapter(chapter) {
  if (!chapter) return [];
  return chapter.toolIds.map((id) => getToolById(id)).filter(Boolean);
}

export function getChaptersForTool(tool) {
  if (!tool) return [];
  return tool.chapterIds.map((id) => getChapterById(id)).filter(Boolean);
}

export function getPrintLinkByCode(code) {
  return printLinks.find((link) => link.code === code);
}

export function getSurfaceBridgeById(id) {
  return surfaceBridges.find((bridge) => bridge.id === id);
}

export function getSurfaceBridgeForPath(pathname) {
  const normalizedPath = normalizeSurfacePath(pathname);
  return surfaceBridges.find((bridge) => {
    const targetPath = normalizeSurfacePath(bridge.path);
    if (bridge.match === 'prefix') {
      return normalizedPath !== targetPath && normalizedPath.startsWith(targetPath);
    }
    return normalizedPath === targetPath;
  });
}
