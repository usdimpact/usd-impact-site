export const THREE_DIALS_VERSION = 1;

export const THREE_DIALS_THRESHOLDS = Object.freeze({
  dollarFlatPct: 0.10,
  yieldFlatBps: 5,
  hyOasFlatBps: 10,
  vixFlatPoints: 1.0,
  fundingFlatBps: 3,
});

function finite(value, label) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }
  return value;
}

function classify(value, threshold, positive, negative, flat) {
  finite(value, 'change');
  if (value > threshold) return positive;
  if (value < -threshold) return negative;
  return flat;
}

export function classifyDollarChange(changePct) {
  return classify(
    changePct,
    THREE_DIALS_THRESHOLDS.dollarFlatPct,
    'firmer',
    'softer',
    'rangebound',
  );
}

export function classifyYieldChange(changeBps) {
  return classify(
    changeBps,
    THREE_DIALS_THRESHOLDS.yieldFlatBps,
    'rising',
    'falling',
    'flat',
  );
}

export function classifyHyOasChange(changeBps) {
  return classify(
    changeBps,
    THREE_DIALS_THRESHOLDS.hyOasFlatBps,
    'tightening',
    'easing',
    'contained',
  );
}

export function classifyVixChange(changePoints) {
  return classify(
    changePoints,
    THREE_DIALS_THRESHOLDS.vixFlatPoints,
    'tightening',
    'easing',
    'contained',
  );
}

export function classifyFundingSpreadChange(changeBps) {
  return classify(
    changeBps,
    THREE_DIALS_THRESHOLDS.fundingFlatBps,
    'tightening',
    'easing',
    'contained',
  );
}

function confidenceFromConfirmation(confirmation) {
  if (confirmation === 'confirmed' || confirmation === 'broad') return 'high';
  if (confirmation === 'mixed' || confirmation === 'narrow') return 'medium';
  return 'low';
}

export function assessThreeDials({
  dxyChangePct,
  broadUsdChangePct,
  realYieldChangeBps,
  nominalYieldChangeBps,
  hyOasChangeBps,
  vixChangePoints,
  fundingSpreadChangeBps,
}) {
  const dollarDirection = classifyDollarChange(dxyChangePct);
  const broadDirection = classifyDollarChange(broadUsdChangePct);
  const dollarConfirmation = dollarDirection === broadDirection
    ? 'confirmed'
    : (dollarDirection === 'rangebound' || broadDirection === 'rangebound')
      ? 'mixed'
      : 'divergent';

  const realRateDirection = classifyYieldChange(realYieldChangeBps);
  const nominalDirection = classifyYieldChange(nominalYieldChangeBps);
  const rateEvidenceConfirmation = realRateDirection === nominalDirection
    ? 'confirmed'
    : (realRateDirection === 'flat' || nominalDirection === 'flat')
      ? 'mixed'
      : 'divergent';

  let dollarRateConfirmation = 'unclear';
  if (dollarDirection !== 'rangebound' && realRateDirection !== 'flat') {
    dollarRateConfirmation = (
      (dollarDirection === 'firmer' && realRateDirection === 'rising')
      || (dollarDirection === 'softer' && realRateDirection === 'falling')
    ) ? 'reinforces' : 'contradicts';
  }

  const stressSignals = [
    classifyHyOasChange(hyOasChangeBps),
    classifyVixChange(vixChangePoints),
    classifyFundingSpreadChange(fundingSpreadChangeBps),
  ];
  const tighteningCount = stressSignals.filter((value) => value === 'tightening').length;
  const easingCount = stressSignals.filter((value) => value === 'easing').length;

  let liquidityDirection = 'mixed';
  let liquidityConfirmation = 'unclear';
  if (tighteningCount >= 2) {
    liquidityDirection = 'tightening';
    liquidityConfirmation = tighteningCount === 3 ? 'broad' : 'narrow';
  } else if (easingCount >= 2) {
    liquidityDirection = 'easing';
    liquidityConfirmation = easingCount === 3 ? 'broad' : 'narrow';
  } else if (stressSignals.every((value) => value === 'contained')) {
    liquidityDirection = 'contained';
    liquidityConfirmation = 'broad';
  }

  const dials = {
    dollar: {
      direction: dollarDirection,
      breadth_direction: broadDirection,
      confirmation: dollarConfirmation,
      confidence: confidenceFromConfirmation(dollarConfirmation),
    },
    real_rates: {
      direction: realRateDirection,
      nominal_direction: nominalDirection,
      evidence_confirmation: rateEvidenceConfirmation,
      dollar_confirmation: dollarRateConfirmation,
      confidence: confidenceFromConfirmation(rateEvidenceConfirmation),
    },
    liquidity_stress: {
      direction: liquidityDirection,
      confirmation: liquidityConfirmation,
      confidence: confidenceFromConfirmation(liquidityConfirmation),
      component_directions: {
        high_yield_oas: stressSignals[0],
        vix: stressSignals[1],
        sofr_iorb_spread: stressSignals[2],
      },
    },
  };

  let label = 'Mixed / transitional environment';
  if (dollarDirection === 'firmer' && liquidityDirection === 'tightening') {
    label = 'Stress-led firm-dollar environment';
  } else if (
    dollarDirection === 'firmer'
    && realRateDirection === 'rising'
    && liquidityDirection !== 'tightening'
  ) {
    label = 'Rate-led firm-dollar environment';
  } else if (
    dollarDirection === 'softer'
    && realRateDirection === 'falling'
    && liquidityDirection === 'easing'
  ) {
    label = 'Easier soft-dollar environment';
  }

  const liquidityPhrase = liquidityDirection === 'tightening'
    ? 'liquidity stress increased'
    : liquidityDirection === 'easing'
      ? 'liquidity stress eased'
      : liquidityDirection === 'contained'
        ? 'liquidity stress stayed contained'
        : 'liquidity-stress evidence was mixed';

  const sentence = `The completed week showed a ${dollarDirection} DXY reading with ${dollarConfirmation} broad-dollar confirmation, 10-year real yields ${realRateDirection}, and ${liquidityPhrase}.`;

  return {
    dials,
    interpretation: {
      label,
      sentence,
      scope: 'Descriptive interpretation of completed observations; not a forecast or trading signal.',
    },
  };
}
