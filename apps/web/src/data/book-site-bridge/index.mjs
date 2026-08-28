import chaptersData from './chapters.json' with { type: 'json' };
import toolsData from './tools.json' with { type: 'json' };
import printLinksData from './print-links.json' with { type: 'json' };

export const BOOK_EDITION = '1.2';
export const BRIDGE_VERSION = '0.1.0-preview';
export const chapters = Object.freeze(chaptersData);
export const tools = Object.freeze(toolsData);
export const printLinks = Object.freeze(printLinksData);

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
