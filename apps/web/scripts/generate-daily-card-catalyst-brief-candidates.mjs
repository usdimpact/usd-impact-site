import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import { dailyCardInventoryTargets } from '../src/data/daily-card-inventory-plan.js';

const catalystDir = path.resolve('src/content/catalyst-briefs');
const outputDir = path.resolve('artifacts/daily-card-catalyst-brief-candidates');

function splitDocument(text, fileName) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`${fileName}: missing frontmatter`);
  return { frontmatter: match[1], body: match[2] };
}

function readScalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
  if (!match) return '';
  const value = match[1].trim();
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  return value;
}

function readPublishers(frontmatter) {
  return [...frontmatter.matchAll(/^\s*publisher:\s*"([^"]+)"\s*$/gm)].map((match) => match[1]);
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function overlapCardIds(title, concepts = []) {
  const titleNorm = normalize(title);
  const tokens = [...new Set(normalize(`${title} ${concepts.join(' ')}`).split(' ').filter((token) => token.length >= 4))];
  return dailyCards.filter((card) => {
    const identity = normalize(`${card.slug} ${card.title} ${card.shortTitle || ''} ${(card.concepts || []).join(' ')}`);
    if (normalize(card.title) === titleNorm || normalize(card.shortTitle) === titleNorm) return true;
    const identityTokens = new Set(identity.split(' '));
    const shared = tokens.filter((token) => identityTokens.has(token));
    return shared.length >= Math.min(3, Math.max(2, Math.ceil(tokens.length / 3)));
  }).map((card) => card.id).slice(0, 8);
}

const files = fs.readdirSync(catalystDir)
  .filter((fileName) => fileName.endsWith('.md'))
  .sort();

const briefs = [];
for (const fileName of files) {
  const sourcePath = `src/content/catalyst-briefs/${fileName}`;
  const text = fs.readFileSync(path.join(catalystDir, fileName), 'utf8');
  const { frontmatter, body } = splitDocument(text, fileName);
  const status = readScalar(frontmatter, 'status');
  const category = readScalar(frontmatter, 'category');
  if (status !== 'published') continue;
  if (category !== 'USD Impact Catalyst Brief') throw new Error(`${fileName}: unexpected Catalyst Brief category`);
  const phase = readScalar(frontmatter, 'phase');
  const lastReviewed = readScalar(frontmatter, 'lastReviewed');
  const eventKey = readScalar(frontmatter, 'eventKey');
  if (!phase || !lastReviewed || !eventKey) throw new Error(`${fileName}: Catalyst Brief metadata incomplete`);
  briefs.push({
    fileName,
    sourcePath,
    phase,
    lastReviewed,
    eventKey,
    sourceNames: [...new Set(readPublishers(frontmatter))],
    fullText: `${frontmatter}\n${body}`,
  });
}

if (briefs.length === 0) throw new Error('No published Catalyst Briefs are available for Tier 8 review.');

const previewBrief = briefs.find((brief) => brief.phase === 'preview');
if (!previewBrief) throw new Error('Tier 8 currently requires at least one published preview Catalyst Brief.');

const templates = [
  {
    id: 'candidate-catalyst-primary-source-timing',
    title: 'Verify Catalyst Timing Before Interpreting Market Impact',
    suggestedCollectionId: 'market-application',
    suggestedFormat: 'workflow',
    suggestedLevel: 'foundation',
    concepts: ['catalyst timing', 'primary sources', 'event verification'],
    evidence: [/statusLabel:\s*"scheduled-confirmed"/i, /verification:\s*"verified-primary"/i, /Confirmed timing \(primary sources\)/i],
    sourceClaim: 'The published Catalyst Brief separates authoritative timing confirmation from the later conditional market interpretation.',
    candidateDefinition: 'A catalyst workflow should first verify what the event is and when it occurs using authoritative sources, then analyze possible market transmission separately.',
    candidateWhyItMatters: 'Mixing unverified timing with interpretation can turn a calendar error into a false market narrative before the event even happens.',
    candidateKeyTakeaway: 'Confirm the event from primary sources before assigning any market significance to it.',
  },
  {
    id: 'candidate-catalyst-preview-outcome-separation',
    title: 'Keep Pre-Event Scenarios Separate From Verified Outcomes',
    suggestedCollectionId: 'market-application',
    suggestedFormat: 'mistake',
    suggestedLevel: 'foundation',
    concepts: ['pre-event analysis', 'conditional scenarios', 'verified outcome'],
    evidence: [/phase:\s*"preview"/i, /pre.event, conditional/i, /No trading recommendations are provided/i],
    sourceClaim: 'The published preview is explicitly conditional and does not treat a scheduled release as a known outcome.',
    candidateDefinition: 'A pre-event brief can map scenarios and transmission channels, but it must not describe the result or market reaction as known before the release occurs.',
    candidateWhyItMatters: 'Separating preview from outcome prevents forecasts from being mislabeled as verified facts and keeps later post-event analysis auditable.',
    candidateKeyTakeaway: 'Use scenarios before the event and verified evidence after it; never collapse the two phases.',
  },
  {
    id: 'candidate-catalyst-component-breadth',
    title: 'Read Inflation Releases as a Component Mix, Not One Headline',
    suggestedCollectionId: 'rates-liquidity-policy',
    suggestedFormat: 'connection',
    suggestedLevel: 'intermediate',
    concepts: ['inflation components', 'headline inflation', 'core inflation', 'shelter', 'energy'],
    evidence: [/Headline CPI monthly change/i, /Core CPI \(ex.food & energy\)/i, /Shelter \/ owners. equivalent rent/i, /Energy \/ gasoline contribution/i],
    sourceClaim: 'The Catalyst Brief checklist treats headline, core, shelter and energy as distinct inputs to the inflation signal.',
    candidateDefinition: 'An inflation release is a mix of headline, core and major components whose contributions can diverge, so one top-line number may not describe the underlying inflation signal.',
    candidateWhyItMatters: 'Policy expectations and market pricing can react differently to persistent core pressure, shelter behavior or temporary energy swings even when the headline print looks simple.',
    candidateKeyTakeaway: 'Inspect the component mix before translating one inflation headline into a policy or market conclusion.',
  },
  {
    id: 'candidate-catalyst-rates-transmission-check',
    title: 'Use Rates as an Intermediate Check in Macro Transmission',
    suggestedCollectionId: 'rates-liquidity-policy',
    suggestedFormat: 'workflow',
    suggestedLevel: 'intermediate',
    concepts: ['Treasury yields', 'policy expectations', 'DXY', 'macro transmission'],
    evidence: [/U\.S\. rates \(Treasury yields\)/i, /DXY \/ FX/i, /focus on 2.yr and 10.yr Treasury moves/i],
    sourceClaim: 'The Catalyst Brief traces inflation information through policy expectations and Treasury yields before the dollar and other assets.',
    candidateDefinition: 'For many macro catalysts, Treasury yields and policy expectations are intermediate transmission channels between the released information and the eventual move in the dollar or other assets.',
    candidateWhyItMatters: 'Checking the rates response helps distinguish a genuine policy-path repricing from an asset move driven by positioning, liquidity or another contemporaneous factor.',
    candidateKeyTakeaway: 'Check the rates channel before assuming a macro release explains the dollar or cross-asset move.',
  },
];

for (const template of templates) {
  for (const pattern of template.evidence) {
    if (!pattern.test(previewBrief.fullText)) throw new Error(`${template.id}: Catalyst Brief evidence changed or is missing`);
  }
}

const counts = Object.fromEntries(Object.keys(dailyCardInventoryTargets).map((collectionId) => [
  collectionId,
  dailyCards.filter((card) => card.collectionId === collectionId).length,
]));
const deficits = Object.fromEntries(Object.entries(dailyCardInventoryTargets).map(([collectionId, target]) => [
  collectionId,
  Math.max(0, target - (counts[collectionId] || 0)),
]));

const candidates = templates.map((template) => {
  const potentialOverlapCardIds = overlapCardIds(template.title, template.concepts);
  return {
    id: template.id,
    title: template.title,
    suggestedCollectionId: template.suggestedCollectionId,
    suggestedFormat: template.suggestedFormat,
    suggestedLevel: template.suggestedLevel,
    suggestedAccess: 'open',
    concepts: template.concepts,
    sourceClaim: template.sourceClaim,
    candidateDefinition: template.candidateDefinition,
    candidateWhyItMatters: template.candidateWhyItMatters,
    candidateKeyTakeaway: template.candidateKeyTakeaway,
    sourceHierarchyRank: 8,
    sourceType: 'catalyst-brief-methodology',
    sourcePaths: [previewBrief.sourcePath],
    sourceEventKeys: [previewBrief.eventKey],
    sourcePhases: [previewBrief.phase],
    sourceLastReviewed: [previewBrief.lastReviewed],
    sourceNames: previewBrief.sourceNames,
    sourceEvidenceCount: 1,
    potentialOverlapCardIds,
    reviewDisposition: potentialOverlapCardIds.length ? 'resolve-overlap' : 'likely-net-new',
    evergreen: true,
    status: 'review',
    lastReviewed: null,
    productionNote: 'Review-only Catalyst Brief methodology candidate. Do not promote event dates, release values, forecasts, expected direction or realized market moves into evergreen learning content.',
  };
});

const generatedAt = new Date().toISOString();
const output = {
  generatedAt,
  sourceHierarchyRank: 8,
  sourceType: 'catalyst-brief-methodology',
  publishedBriefCount: briefs.length,
  publishedBriefPaths: briefs.map((brief) => brief.sourcePath),
  sourcePreviewPath: previewBrief.sourcePath,
  currentCollectionCounts: counts,
  currentCollectionDeficits: deficits,
  candidateCount: candidates.length,
  likelyNetNewCount: candidates.filter((candidate) => candidate.reviewDisposition === 'likely-net-new').length,
  overlapCount: candidates.filter((candidate) => candidate.reviewDisposition === 'resolve-overlap').length,
  candidates,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'candidates.json'), `${JSON.stringify(output, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'review.md'), `${[
  '# Catalyst Brief Daily Card review queue',
  '',
  `Generated: ${generatedAt}`,
  '',
  `Published Catalyst Briefs scanned: **${briefs.length}**`,
  `Evergreen methodology candidates: **${candidates.length}**`,
  `Likely net-new: **${output.likelyNetNewCount}**`,
  `Potential overlaps: **${output.overlapCount}**`,
  '',
  '## Source boundary',
  '',
  '- Hierarchy tier: **8 — Catalyst Briefs**',
  '- Source access is **Open** because published Catalyst Briefs are public.',
  '- This queue extracts only evergreen workflow/methodology concepts from a published preview.',
  '- Event dates, release values, expected direction, realized outcomes and market moves are excluded from candidate prose.',
  '- Every generated item remains `review` with `lastReviewed=null` until explicit editorial disposition.',
  '',
  '## Candidates',
  '',
  ...candidates.map((candidate) => `- **${candidate.title}** — ${candidate.suggestedCollectionId}; ${candidate.reviewDisposition}; source: ${candidate.sourcePaths.join(', ')}`),
  '',
].join('\n')}\n`);

console.log(`Catalyst Brief Daily Card queue generated: ${candidates.length} review-only candidates from ${briefs.length} published brief(s).`);
