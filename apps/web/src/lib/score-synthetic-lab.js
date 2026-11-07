/**
 * USD Impact Score Lab: fictional arithmetic exercise only.
 * No network, storage, production inputs, historical calibrations,
 * market observations, data providers or Score publication.
 */
export const SYNTHETIC_FIXTURE_ID = 'SIMULADO-2099-SEIS-SEMANAS';
export const SYNTHETIC_HISTORY = Object.freeze([900, 900, 1000, 1100, 1100]);
export const SYNTHETIC_MIN = 500;
export const SYNTHETIC_MAX = 1500;
export const SYNTHETIC_STEP = 10;
export const Z_CLIP = 3.5;

export const SYNTHETIC_DRIVERS = Object.freeze([
  Object.freeze({ id: 'DXY', label: 'Dólar (factor DXY conceptual)', weight: +0.125, exampleX: 1120 }),
  Object.freeze({ id: 'WTI', label: 'WTI (factor conceptual)', weight: -0.125, exampleX: 1040 }),
  Object.freeze({ id: 'SPX', label: 'S&P 500 (factor conceptual)', weight: -0.125, exampleX: 960 }),
  Object.freeze({ id: 'VIX', label: 'VIX (factor conceptual)', weight: +0.125, exampleX: 1170 }),
  Object.freeze({ id: 'BTC', label: 'Bitcoin (factor conceptual)', weight: -0.125, exampleX: 1060 }),
  Object.freeze({ id: 'GOLD', label: 'Oro (factor conceptual)', weight: -0.125, exampleX: 940 }),
  Object.freeze({ id: 'UST_2Y', label: 'Tesoro EE. UU. 2 años (conceptual)', weight: +0.125, exampleX: 1080 }),
  Object.freeze({ id: 'UST_10Y', label: 'Tesoro EE. UU. 10 años (conceptual)', weight: +0.125, exampleX: 1030 }),
]);

function requireSyntheticInputs(values) {
  if (!Array.isArray(values) || values.length !== SYNTHETIC_DRIVERS.length) {
    throw new TypeError('Se requieren exactamente ocho valores ficticios.');
  }
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isInteger(value)
        || value < SYNTHETIC_MIN || value > SYNTHETIC_MAX
        || value % SYNTHETIC_STEP !== 0) {
      throw new RangeError('Valor ficticio fuera del rango y paso permitido.');
    }
  }
}

export function sampleMean(series) {
  if (!Array.isArray(series) || series.length < 2
      || series.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError('La muestra requiere al menos dos números finitos.');
  }
  return series.reduce((total, value) => total + value, 0) / series.length;
}

export function sampleStd(series) {
  const mean = sampleMean(series);
  const squareSum = series.reduce((total, value) => total + (value - mean) ** 2, 0);
  const result = Math.sqrt(squareSum / (series.length - 1)); // ddof=1, as in pandas
  if (!Number.isFinite(result) || result <= 0) {
    throw new RangeError('La desviación estándar muestral debe ser positiva.');
  }
  return result;
}

export function clipZ(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('No se admiten valores z no finitos.');
  }
  return Math.max(-Z_CLIP, Math.min(Z_CLIP, value));
}

export function syntheticRegime(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) throw new TypeError('Puntuación inválida');
  if (score >= 1.0) return 'Ejemplo de dólar fuerte';
  if (score >= 0.3) return 'Ejemplo de dólar firme';
  if (score >= -0.3) return 'Ejemplo neutral / transicional';
  if (score >= -1.0) return 'Ejemplo de dólar suave';
  return 'Ejemplo de dólar débil';
}

/** All six fictional weeks, including the hypothetical sixth, enter mean/std. */
export function evaluateSyntheticLab(values = SYNTHETIC_DRIVERS.map(d => d.exampleX)) {
  requireSyntheticInputs(values);
  const rows = SYNTHETIC_DRIVERS.map((driver, index) => {
    const x = values[index];
    const series = [...SYNTHETIC_HISTORY, x];
    const mean = sampleMean(series);
    const std = sampleStd(series);
    const rawZ = (x - mean) / std;
    const z = clipZ(rawZ);
    return Object.freeze({
      id: driver.id, label: driver.label, x, mean, std, rawZ, z,
      weight: driver.weight, contribution: z * driver.weight,
    });
  });
  const score = rows.reduce((total, row) => total + row.contribution, 0);
  return Object.freeze({
    fixture: SYNTHETIC_FIXTURE_ID, rows: Object.freeze(rows), score,
    regime: syntheticRegime(score), synthetic: true, realMarketScore: false,
  });
}

/** Spreadsheet-ready six-week fictional input, with no real dates or data. */
export function syntheticCsv(values = SYNTHETIC_DRIVERS.map(d => d.exampleX)) {
  requireSyntheticInputs(values);
  const rows = [['factor_ficticio', 'peso', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6']];
  SYNTHETIC_DRIVERS.forEach((driver, index) => {
    rows.push([driver.id, String(driver.weight), ...SYNTHETIC_HISTORY.map(String), String(values[index])]);
  });
  return rows.map(row => row.join(',')).join('\n') + '\n';
}
