export const THREE_DIALS_VERSION = 2;

export const THREE_DIALS_THRESHOLDS = Object.freeze({
  dollarFlatPct: 0.10,
  yieldFlatBps: 5,
  fundingFlatBps: 3,
});

const THRESHOLD_BOUNDARY_EPSILON = 1e-9;

function finite(value, label) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }
  return value;
}

function normalizeThresholdBoundary(value, threshold) {
  const checked = finite(value, 'change');
  if (Math.abs(checked - threshold) <= THRESHOLD_BOUNDARY_EPSILON) return threshold;
  if (Math.abs(checked + threshold) <= THRESHOLD_BOUNDARY_EPSILON) return -threshold;
  return checked;
}

function classify(value, threshold, positive, negative, flat) {
  const normalizedValue = normalizeThresholdBoundary(value, threshold);
  if (normalizedValue > threshold) return positive;
  if (normalizedValue < -threshold) return negative;
  return flat;
}

export function classifyDollarChange(changePct) {
  return classify(changePct, THREE_DIALS_THRESHOLDS.dollarFlatPct, 'firmer', 'softer', 'rangebound');
}

export function classifyYieldChange(changeBps) {
  return classify(changeBps, THREE_DIALS_THRESHOLDS.yieldFlatBps, 'rising', 'falling', 'flat');
}

export function classifyFundingSpreadChange(changeBps) {
  return classify(changeBps, THREE_DIALS_THRESHOLDS.fundingFlatBps, 'tightening', 'easing', 'contained');
}

export function assessThreeDials({
  broadUsdChangePct,
  realYieldChangeBps,
  fundingSpreadChangeBps,
}) {
  const dollarDirection = classifyDollarChange(broadUsdChangePct);
  const realRateDirection = classifyYieldChange(realYieldChangeBps);
  const fundingDirection = classifyFundingSpreadChange(fundingSpreadChangeBps);

  let label = 'Mixed / transitional environment';
  if (dollarDirection === 'firmer' && fundingDirection === 'tightening') {
    label = 'Funding-led firm-dollar environment';
  } else if (
    dollarDirection === 'firmer'
    && realRateDirection === 'rising'
    && fundingDirection !== 'tightening'
  ) {
    label = 'Rate-led firm-dollar environment';
  } else if (
    dollarDirection === 'softer'
    && realRateDirection === 'falling'
    && fundingDirection === 'easing'
  ) {
    label = 'Easier soft-dollar environment';
  }

  const fundingPhrase = fundingDirection === 'tightening'
    ? 'funding pressure increased'
    : fundingDirection === 'easing'
      ? 'funding pressure eased'
      : 'funding pressure stayed contained';

  return {
    dials: {
      dollar: {
        direction: dollarDirection,
        confirmation: 'single-primary-measure',
        confidence: 'medium',
      },
      real_rates: {
        direction: realRateDirection,
        confirmation: 'single-primary-measure',
        confidence: 'medium',
      },
      funding_pressure: {
        direction: fundingDirection,
        confirmation: 'single-derived-measure',
        confidence: 'medium',
      },
    },
    interpretation: {
      label,
      sentence: `The completed week showed a ${dollarDirection} broad-dollar reading, 10-year real yields ${realRateDirection}, and ${fundingPhrase}.`,
      scope: 'Descriptive interpretation of completed observations; not a forecast or trading signal.',
    },
  };
}
