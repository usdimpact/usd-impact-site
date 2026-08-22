function compact(items = [], limit = 3) {
  return items.filter(Boolean).slice(0, limit);
}

function canonicalUrl(baseUrl, card) {
  const base = String(baseUrl || "https://usd-impact.com").replace(/\/$/, "");
  return `${base}/learn/${card.slug}`;
}

export function toWebsiteCard(card) {
  return {
    ...card,
    sections: [
      { id: "definition", label: "What it is", value: card.definition },
      { id: "why", label: "Why it matters", value: card.whyItMatters },
      card.example ? { id: "example", label: "Example", value: card.example } : null,
      card.commonMistake ? { id: "mistake", label: "Common mistake", value: card.commonMistake } : null,
      { id: "watch", label: "What to watch", value: card.whatToWatch || [] },
      { id: "takeaway", label: "Key takeaway", value: card.keyTakeaway },
    ].filter(Boolean),
  };
}

export function toEmailCard(card, options = {}) {
  const url = canonicalUrl(options.baseUrl, card);
  return {
    subject: `USD Impact Daily: ${card.shortTitle || card.title}`,
    preview: card.hook,
    text: [
      `USD IMPACT DAILY — ${card.title}`,
      "",
      card.hook,
      "",
      `WHAT IT IS\n${card.definition}`,
      "",
      `WHY IT MATTERS\n${card.whyItMatters}`,
      card.commonMistake ? `\nCOMMON MISTAKE\n${card.commonMistake}` : "",
      compact(card.whatToWatch).length ? `\nWHAT TO WATCH\n${compact(card.whatToWatch).map((item) => `• ${item}`).join("\n")}` : "",
      "",
      `KEY TAKEAWAY\n${card.keyTakeaway}`,
      "",
      `Learn more: ${url}`,
      "",
      "Educational and informational purposes only. Not investment advice.",
    ].filter(Boolean).join("\n"),
    url,
  };
}

export function toTelegramCard(card, options = {}) {
  const url = canonicalUrl(options.baseUrl, card);
  return [
    `USD Impact Daily — ${card.shortTitle || card.title}`,
    "",
    card.definition,
    "",
    `Why it matters: ${card.whyItMatters}`,
    compact(card.whatToWatch, 2).length ? `\nWatch: ${compact(card.whatToWatch, 2).join(" • ")}` : "",
    "",
    `Takeaway: ${card.keyTakeaway}`,
    "",
    url,
    "",
    "Educational only. Not investment advice.",
  ].filter(Boolean).join("\n");
}

export function toWhatsAppCard(card, options = {}) {
  const url = canonicalUrl(options.baseUrl, card);
  return [
    `USD Impact Daily — ${card.shortTitle || card.title}`,
    "",
    card.definition,
    "",
    `Why it matters: ${card.whyItMatters}`,
    "",
    `Remember: ${card.keyTakeaway}`,
    "",
    url,
  ].join("\n");
}

export function toSocialCard(card, options = {}) {
  const url = canonicalUrl(options.baseUrl, card);
  return [
    card.hook,
    "",
    card.keyTakeaway,
    card.commonMistake ? `\nCommon mistake: ${card.commonMistake}` : "",
    "",
    url,
    "",
    "Educational only. Not investment advice.",
  ].filter(Boolean).join("\n");
}

export function buildChannelPack(card, options = {}) {
  return {
    website: toWebsiteCard(card),
    email: toEmailCard(card, options),
    telegram: toTelegramCard(card, options),
    whatsapp: toWhatsAppCard(card, options),
    social: toSocialCard(card, options),
  };
}
