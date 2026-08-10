export const AUDIOBOOK_PRIVATE_BLOB_PREFIX = 'read-the-dollar-first';

const AUDIOBOOK_STREAM_ENDPOINT = '/api/audiobook';
const AUDIOBOOK_CHAPTERS = Object.freeze([
  ['Read the Dollar First', '00-read-the-dollar-first.mp3', '1:29'],
  ['Acknowledgments and Reader Guide', '01-acknowledgments-and-reader-guide.mp3', '2:59'],
  ['Introduction - Why This Book Exists', '02-introduction-why-this-book-exists.mp3', '11:34'],
  ['Chapter 1 - Why the Dollar Comes First', '03-chapter-1-why-the-dollar-comes-first.mp3', '14:38'],
  ['Chapter 2 - From Bretton Woods to Fiat Discipline', '04-chapter-2-from-bretton-woods-to-fiat-discipline.mp3', '15:05'],
  ['Chapter 3 - USD Is Not DXY', '05-chapter-3-usd-is-not-dxy.mp3', '15:44'],
  ['Chapter 4 - How the Dollar Moves Oil, Gold, Bitcoin, Gas, and FX', '06-chapter-4-how-the-dollar-moves-oil-gold-bitcoin-gas-and-fx.mp3', '19:01'],
  ['Chapter 5 - Oil Is Not a Dollar Trade Only', '07-chapter-5-oil-is-not-a-dollar-trade-only.mp3', '16:47'],
  ['Chapter 6 - Gold and the Dollar', '08-chapter-6-gold-and-the-dollar.mp3', '13:32'],
  ['Chapter 7 - Bitcoin and the Dollar', '09-chapter-7-bitcoin-and-the-dollar.mp3', '15:03'],
  ['Chapter 8 - Gas, LNG, and the Dollar', '10-chapter-8-gas-lng-and-the-dollar.mp3', '13:33'],
  ['Chapter 9 - FX, Carry, and Translation Risk', '11-chapter-9-fx-carry-and-translation-risk.mp3', '12:37'],
  ['Chapter 10 - Reading Regimes: The Eleven-Year Record', '12-chapter-10-reading-regimes-the-eleven-year-record.mp3', '25:48'],
  ['Chapter 11 - The Weekly Operating Framework', '13-chapter-11-the-weekly-operating-framework.mp3', '12:58'],
  ['Chapter 12 - Common Mistakes in Dollar and Cross-Asset Analysis', '14-chapter-12-common-mistakes-in-dollar-and-cross-asset-analysis.mp3', '16:10'],
  ['Chapter 13 - What to Watch from Here', '15-chapter-13-what-to-watch-from-here.mp3', '18:40'],
  ['Further Reading', '16-further-reading.mp3', '2:14'],
  ['Appendix A - Quick Glossary', '17-appendix-a-quick-glossary.mp3', '17:11'],
  ['Appendix B - USD Impact Score Methodology', '18-appendix-b-usd-impact-score-methodology.mp3', '13:07'],
  ['About USD Impact', '19-about-usd-impact.mp3', '0:37'],
]);

export const readTheDollarFirstAudiobook = {
  title: 'Read the Dollar First',
  subtitle: 'How the Dollar Moves Global Markets',
  author: 'USD Impact',
  language: 'English',
  duration: '4 hr 18 min',
  coverUrl: '/assets/cover/USD_Impact_Ebook_Cover_ThumbnailFocused_1200x1800.png',
  coverAlt: 'Dark navy cover for Read the Dollar First, with the USD Impact globe-and-wave mark.',
  chapters: AUDIOBOOK_CHAPTERS.map(([title, , duration], index) => ({
    index,
    title,
    duration,
    url: `${AUDIOBOOK_STREAM_ENDPOINT}?chapter=${index}`,
  })),
};

export function readTheDollarFirstAudiobookChapter(value) {
  const rawValue = typeof value === 'number' ? value : String(value ?? '').trim();
  if (rawValue === '') return null;
  const index = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isInteger(index) || index < 0 || index >= AUDIOBOOK_CHAPTERS.length) return null;
  const [title, file, duration] = AUDIOBOOK_CHAPTERS[index];
  return Object.freeze({
    index,
    title,
    duration,
    pathname: `${AUDIOBOOK_PRIVATE_BLOB_PREFIX}/${file}`,
  });
}
