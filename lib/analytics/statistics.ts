/**
 * Core statistical primitives.
 * Uses simple-statistics for well-tested implementations; supplements with
 * time-series and decomposition helpers not in that library.
 * All functions are pure — no side effects, no DB access.
 */

import {
  mean as ssMean,
  median as ssMedian,
  standardDeviation,
  quantile,
  sampleCorrelation,
  linearRegression as ssLinearRegression,
  linearRegressionLine,
  rSquared,
} from "simple-statistics";

// ── Basic descriptive ─────────────────────────────────────────────────────────

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return ssMean(values);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  return ssMedian(values);
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  return standardDeviation(values);
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  return quantile(values, p);
}

export function quartiles(values: number[]): { q1: number; q2: number; q3: number; iqr: number } {
  if (values.length === 0) return { q1: 0, q2: 0, q3: 0, iqr: 0 };
  const q1 = quantile(values, 0.25);
  const q2 = quantile(values, 0.5);
  const q3 = quantile(values, 0.75);
  return { q1, q2, q3, iqr: q3 - q1 };
}

export function zScore(value: number, mu: number, sigma: number): number {
  if (sigma === 0) return 0;
  return (value - mu) / sigma;
}

/** Coefficient of variation = stdDev / |mean|. Returns 0 if mean is 0. */
export function coefficientOfVariation(values: number[]): number {
  const m = mean(values);
  if (m === 0) return 0;
  return stdDev(values) / Math.abs(m);
}

// ── Time-series smoothing ─────────────────────────────────────────────────────

/** Simple centred moving average. First and last ⌊window/2⌋ values are NaN. */
export function movingAverage(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const start = i - half;
    const end = i + half;
    if (start < 0 || end >= values.length) return NaN;
    const slice = values.slice(start, end + 1);
    return ssMean(slice);
  });
}

/** Single exponential smoothing. α closer to 1 = more weight on recent values. */
export function exponentialSmoothing(values: number[], alpha: number): number[] {
  if (values.length === 0) return [];
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

// ── Correlation & regression ──────────────────────────────────────────────────

export function correlation(x: number[], y: number[]): number {
  if (x.length < 2 || x.length !== y.length) return 0;
  try {
    return sampleCorrelation(x, y);
  } catch {
    return 0;
  }
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  residuals: number[];
}

export function linearRegression(x: number[], y: number[]): LinearRegressionResult {
  if (x.length < 2 || x.length !== y.length) {
    return { slope: 0, intercept: mean(y), r2: 0, residuals: y.map(() => 0) };
  }
  const points = x.map((xi, i) => [xi, y[i]] as [number, number]);
  try {
    const lr = ssLinearRegression(points);
    const lineFn = linearRegressionLine(lr);
    const r2 = rSquared(points, lineFn);
    const residuals = y.map((yi, i) => yi - lineFn(x[i]));
    return { slope: lr.m, intercept: lr.b, r2, residuals };
  } catch {
    return { slope: 0, intercept: mean(y), r2: 0, residuals: y.map(() => 0) };
  }
}

// ── Outlier detection ─────────────────────────────────────────────────────────

/**
 * Returns indices of outliers.
 * IQR method: outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR]
 * Z-score method: |z| > 3
 */
export function detectOutliers(values: number[], method: "iqr" | "zscore"): number[] {
  if (method === "iqr") {
    const { q1, q3, iqr } = quartiles(values);
    const lo = q1 - 1.5 * iqr;
    const hi = q3 + 1.5 * iqr;
    return values.reduce<number[]>((acc, v, i) => {
      if (v < lo || v > hi) acc.push(i);
      return acc;
    }, []);
  } else {
    const mu = mean(values);
    const sigma = stdDev(values);
    return values.reduce<number[]>((acc, v, i) => {
      if (Math.abs(zScore(v, mu, sigma)) > 3) acc.push(i);
      return acc;
    }, []);
  }
}

// ── Seasonal decomposition ────────────────────────────────────────────────────

export interface DecompositionResult {
  trend: number[];        // centred moving average (NaN at edges)
  seasonal: number[];     // repeating seasonal pattern
  residual: number[];     // remainder after trend + seasonal removed
}

/**
 * Classical additive decomposition: Y = trend + seasonal + residual.
 * Uses a centred moving average of length `period` for the trend component.
 * Requires at least 2 full periods of data.
 */
export function seasonalDecompose(values: number[], period: number): DecompositionResult {
  const n = values.length;
  if (n < period * 2) {
    const zeros = values.map(() => NaN);
    return { trend: zeros, seasonal: zeros, residual: zeros };
  }

  // Trend: centred moving average
  const trend = movingAverage(values, period);

  // Detrend
  const detrended = values.map((v, i) => (isNaN(trend[i]) ? NaN : v - trend[i]));

  // Seasonal: average detrended at each phase within the period
  const seasonalFactors: number[] = new Array(period).fill(0);
  const counts: number[] = new Array(period).fill(0);
  for (let i = 0; i < n; i++) {
    if (!isNaN(detrended[i])) {
      seasonalFactors[i % period] += detrended[i];
      counts[i % period]++;
    }
  }
  const avgFactors = seasonalFactors.map((s, j) => (counts[j] > 0 ? s / counts[j] : 0));

  // Centre the seasonal factors so they sum to zero
  const factorMean = ssMean(avgFactors);
  const centredFactors = avgFactors.map((f) => f - factorMean);

  // Expand seasonal to full length
  const seasonal = values.map((_, i) => centredFactors[i % period]);

  // Residual
  const residual = values.map((v, i) =>
    isNaN(trend[i]) ? NaN : v - trend[i] - seasonal[i]
  );

  return { trend, seasonal, residual };
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Running cumulative sum. */
export function cumsum(values: number[]): number[] {
  let acc = 0;
  return values.map((v) => (acc += v));
}

/** Normalise values to [0, 1] range. */
export function normalise(values: number[]): number[] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi === lo) return values.map(() => 0);
  return values.map((v) => (v - lo) / (hi - lo));
}
