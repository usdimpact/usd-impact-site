const directionLabels = {
  firmer: 'firmer',
  softer: 'softer',
  mixed: 'mixed or rangebound',
};

const confirmationLabels = {
  tightening: 'supports a tighter-dollar or stress interpretation',
  easing: 'supports an easier-dollar interpretation',
  mixed: 'is mixed or inconclusive',
};

export function classifyDxyScenario({ dxy, broad, confirmation }) {
  if (!directionLabels[dxy] || !directionLabels[broad] || !confirmationLabels[confirmation]) {
    throw new Error('Invalid DXY practice input.');
  }

  let classification;

  if (dxy === 'firmer' && broad === 'firmer') {
    classification = {
      status: 'confirmed-firmer',
      heading: 'Broadly confirmed firmer-dollar reading',
      summary: 'DXY and broad USD point in the same firmer direction. The move is wider than one legacy basket, subject to the confirmation layer.',
      nextCheck: 'Identify whether rates, funding stress or relative growth is the dominant driver before discussing an asset.',
    };
  } else if (dxy === 'softer' && broad === 'softer') {
    classification = {
      status: 'confirmed-softer',
      heading: 'Broadly confirmed softer-dollar reading',
      summary: 'DXY and broad USD point in the same softer direction. The move is wider than one legacy basket, subject to the confirmation layer.',
      nextCheck: 'Check whether lower real rates and easier liquidity support the same interpretation.',
    };
  } else if (dxy === 'firmer' && broad !== 'firmer') {
    classification = {
      status: 'basket-led-firmer',
      heading: 'Possible basket-led firmer DXY move',
      summary: 'DXY is firmer without matching broad-dollar confirmation. A euro-, yen- or other basket-specific move may be carrying too much of the headline signal.',
      nextCheck: 'Inspect the broad index, bilateral pairs and funding evidence before calling this a global dollar tightening.',
    };
  } else if (dxy === 'softer' && broad !== 'softer') {
    classification = {
      status: 'basket-led-softer',
      heading: 'Possible basket-led softer DXY move',
      summary: 'DXY is softer without matching broad-dollar confirmation. The visible basket may be overstating global easing.',
      nextCheck: 'Check whether trade-weighted partners and funding conditions are actually receiving dollar relief.',
    };
  } else if (broad === 'firmer' && dxy !== 'firmer') {
    classification = {
      status: 'broad-pressure-understated',
      heading: 'Broad dollar pressure may be understated by DXY',
      summary: 'Broad USD is firmer while DXY is not. Pressure outside the six-currency basket may be more important than the headline index suggests.',
      nextCheck: 'Examine trade-partner currencies, import-cost pressure and funding conditions.',
    };
  } else if (broad === 'softer' && dxy !== 'softer') {
    classification = {
      status: 'broad-easing-understated',
      heading: 'Broad dollar easing may be understated by DXY',
      summary: 'Broad USD is softer while DXY is not. The legacy basket may be missing relief across a wider set of trading partners.',
      nextCheck: 'Check whether real rates, credit and risk appetite confirm easier conditions.',
    };
  } else {
    classification = {
      status: 'mixed',
      heading: 'Mixed or unresolved dollar picture',
      summary: 'Neither measure provides a coherent directional confirmation. Do not force a regime label from incomplete evidence.',
      nextCheck: 'Extend the observation window and identify whether rates, stress or one bilateral pair is creating the disagreement.',
    };
  }

  const expectedConfirmation = classification.status.includes('firmer') || classification.status.includes('pressure')
    ? 'tightening'
    : classification.status.includes('softer') || classification.status.includes('easing')
      ? 'easing'
      : 'mixed';

  const confirmationAligned = confirmation === expectedConfirmation || expectedConfirmation === 'mixed';
  const confirmationNote = confirmationAligned
    ? `The confirmation layer ${confirmationLabels[confirmation]}.`
    : `The confirmation layer ${confirmationLabels[confirmation]}, so confidence should be reduced and the divergence investigated.`;

  return {
    ...classification,
    dxyLabel: directionLabels[dxy],
    broadLabel: directionLabels[broad],
    confirmationLabel: confirmationLabels[confirmation],
    confirmationAligned,
    confirmationNote,
  };
}

const fieldMetadata = {
  dollar: {
    label: 'Dollar direction',
    chapterNumber: 3,
    reason: 'Recheck whether DXY and broad USD are being treated as the same object.',
  },
  realRates: {
    label: 'Real-rate pressure',
    chapterNumber: 11,
    reason: 'Recheck the rate evidence and whether nominal yields are being mistaken for real yields.',
  },
  liquidity: {
    label: 'Liquidity stress',
    chapterNumber: 11,
    reason: 'Recheck credit, volatility and funding evidence instead of relying on one liquidity proxy.',
  },
};

export function compareWeeklyReading(userReading, referenceReading) {
  const fields = Object.keys(fieldMetadata);
  const missing = fields.filter((field) => !userReading[field] || !referenceReading[field]);
  if (missing.length > 0) {
    throw new Error(`Missing weekly comparison fields: ${missing.join(', ')}`);
  }

  const differences = fields
    .filter((field) => userReading[field] !== referenceReading[field])
    .map((field) => ({
      field,
      ...fieldMetadata[field],
      userValue: userReading[field],
      referenceValue: referenceReading[field],
    }));

  const matches = fields.length - differences.length;
  let status;
  let heading;
  let summary;

  if (matches === fields.length) {
    status = 'aligned';
    heading = 'Aligned three-dial reading';
    summary = 'Your three dial selections match the deterministic completed-week classifications. This shows process alignment, not predictive accuracy. Your dominant-driver hypothesis remains separate and unscored.';
  } else if (matches >= 2) {
    status = 'partly-aligned';
    heading = 'Partly aligned three-dial reading';
    summary = 'Your reading shares most of the deterministic dial classifications but contains a useful disagreement. Review it before changing the narrative. The driver hypothesis remains unscored.';
  } else {
    status = 'materially-different';
    heading = 'Materially different three-dial reading';
    summary = 'Your reading differs on most deterministic dials. Treat this as a diagnostic prompt and return to the relevant framework chapters. The driver hypothesis remains unscored.';
  }

  return {
    status,
    heading,
    summary,
    matches,
    total: fields.length,
    differences,
  };
}
