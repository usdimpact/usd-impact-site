export const readTheDollarFirstAudiobook = {
  title: 'Read the Dollar First',
  subtitle: 'How the Dollar Moves Global Markets',
  author: 'USD Impact',
  language: 'English',
  duration: '4 hr 18 min',
  coverUrl: '/assets/cover/USD_Impact_Ebook_Cover_ThumbnailFocused_1200x1800.png',
  coverAlt: 'Navy and gold cover for Read the Dollar First by USD Impact.',
  chapters: [
    ['Read the Dollar First', 'read-the-dollar-first', '1:29'],
    ['Acknowledgments and Reader Guide', 'acknowledgments-and-reader-guide', '2:59'],
    ['Introduction - Why This Book Exists', 'introduction-why-this-book-exists', '11:34'],
    ['Chapter 1 - Why the Dollar Comes First', 'chapter-1-why-the-dollar-comes-first', '14:38'],
    ['Chapter 2 - From Bretton Woods to Fiat Discipline', 'chapter-2-from-bretton-woods-to-fiat-discipline', '15:05'],
    ['Chapter 3 - USD Is Not DXY', 'chapter-3-usd-is-not-dxy', '15:44'],
    ['Chapter 4 - How the Dollar Moves Oil, Gold, Bitcoin, Gas, and FX', 'chapter-4-how-the-dollar-moves-oil-gold-bitcoin-gas-and-fx', '19:01'],
    ['Chapter 5 - Oil Is Not a Dollar Trade Only', 'chapter-5-oil-is-not-a-dollar-trade-only', '16:47'],
    ['Chapter 6 - Gold and the Dollar', 'chapter-6-gold-and-the-dollar', '13:32'],
    ['Chapter 7 - Bitcoin and the Dollar', 'chapter-7-bitcoin-and-the-dollar', '15:03'],
    ['Chapter 8 - Gas, LNG, and the Dollar', 'chapter-8-gas-lng-and-the-dollar', '13:33'],
    ['Chapter 9 - FX, Carry, and Translation Risk', 'chapter-9-fx-carry-and-translation-risk', '12:37'],
    ['Chapter 10 - Reading Regimes: The Eleven-Year Record', 'chapter-10-reading-regimes-the-eleven-year-record', '25:48'],
    ['Chapter 11 - The Weekly Operating Framework', 'chapter-11-the-weekly-operating-framework', '12:58'],
    ['Chapter 12 - Common Mistakes in Dollar and Cross-Asset Analysis', 'chapter-12-common-mistakes-in-dollar-and-cross-asset-analysis', '16:10'],
    ['Chapter 13 - What to Watch from Here', 'chapter-13-what-to-watch-from-here', '18:40'],
    ['Further Reading', 'further-reading', '2:14'],
    ['Appendix A - Quick Glossary', 'appendix-a-quick-glossary', '17:11'],
    ['Appendix B - USD Impact Score Methodology', 'appendix-b-usd-impact-score-methodology', '13:07'],
    ['About USD Impact', 'about-usd-impact', '0:37'],
  ].map(([title, slug, duration], index) => Object.freeze({
    index,
    title,
    slug,
    duration,
  })),
};

Object.freeze(readTheDollarFirstAudiobook.chapters);
Object.freeze(readTheDollarFirstAudiobook);
