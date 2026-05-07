// ── Lanczos log-gamma ─────────────────────────────────────────────────────────

const LG_G = 7;
const LG_P = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

export function logGamma(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = LG_P[0];
  const t = x + LG_G + 0.5;
  for (let i = 1; i < LG_G + 2; i++) a += LG_P[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// ── Negative Binomial (mean=lambda, dispersion=k) ─────────────────────────────
// PMF: P(X=x) = Γ(x+k)/(Γ(k)·x!) · (k/(k+λ))^k · (λ/(k+λ))^x

export function nbLogPMF(x: number, lambda: number, k: number): number {
  if (lambda <= 0 || k <= 0) return -Infinity;
  const p = k / (k + lambda);
  return (
    logGamma(x + k) -
    logGamma(k) -
    logGamma(x + 1) +
    k * Math.log(p) +
    x * Math.log(1 - p)
  );
}

export function nbPMF(x: number, lambda: number, k: number): number {
  return Math.exp(nbLogPMF(x, lambda, k));
}

// CDF by summing PMF (discrete, iterative — fine for SMB demand ranges)
export function nbCDF(xMax: number, lambda: number, k: number): number {
  let cum = 0;
  for (let i = 0; i <= xMax; i++) {
    cum += nbPMF(i, lambda, k);
    if (cum >= 1 - 1e-10) return 1;
  }
  return cum;
}

// Quantile: smallest x s.t. CDF(x) >= p
export function nbQuantile(p: number, lambda: number, k: number): number {
  let cum = 0;
  for (let x = 0; x <= 10_000; x++) {
    cum += nbPMF(x, lambda, k);
    if (cum >= p) return x;
  }
  return 10_000;
}

// ── Poisson quantile (fallback for non-dispersed data) ────────────────────────

function poissonPMF(x: number, lambda: number): number {
  return Math.exp(x * Math.log(lambda) - lambda - logGamma(x + 1));
}

export function poissonQuantile(p: number, lambda: number): number {
  let cum = 0;
  for (let x = 0; x <= 10_000; x++) {
    cum += poissonPMF(x, lambda);
    if (cum >= p) return x;
  }
  return 10_000;
}

// ── EWMA ──────────────────────────────────────────────────────────────────────

export function ewmaUpdate(prevLambda: number, latestSales: number, alpha = 0.3): number {
  return alpha * latestSales + (1 - alpha) * prevLambda;
}

// ── Demand classification (Croston / Syntetos-Boylan) ────────────────────────
// ADI = average inter-demand interval (1 / fraction-of-nonzero-days)
// CV² = variance(nonzero demands) / mean(nonzero demands)²

export type DemandPattern = 'smooth' | 'erratic' | 'intermittent' | 'lumpy' | 'sparse';

export interface DailyDemand {
  qty: number;
  stocked_out: boolean; // true = stock was zero, demand is right-censored
}

export function classifyDemandPattern(days: DailyDemand[]): DemandPattern {
  const nonZero = days.filter((d) => d.qty > 0).map((d) => d.qty);
  if (nonZero.length < 10) return 'sparse';

  const adi = days.length / nonZero.length;

  const mean = nonZero.reduce((s, v) => s + v, 0) / nonZero.length;
  const variance =
    nonZero.reduce((s, v) => s + (v - mean) ** 2, 0) / (nonZero.length - 1);
  const cv2 = variance / (mean ** 2 || 1);

  if (adi < 1.32 && cv2 < 0.49) return 'smooth';
  if (adi >= 1.32 && cv2 < 0.49) return 'intermittent';
  if (adi < 1.32 && cv2 >= 0.49) return 'erratic';
  return 'lumpy';
}

// ── NB fitting (method of moments) ───────────────────────────────────────────

export interface NBFitResult {
  lambda: number;
  k: number;              // large (e.g. 1000) = essentially Poisson
  fit_quality: number;    // 0-1
  data_points: number;
  censored_days: number;
  demand_pattern: DemandPattern;
  warning?: string;
}

export function fitNegativeBinomial(days: DailyDemand[]): NBFitResult {
  const n = days.length;
  const censored_days = days.filter((d) => d.stocked_out).length;

  // Non-censored observations for fitting
  const obs = days.filter((d) => !d.stocked_out).map((d) => d.qty);
  const nObs = obs.length;

  const demand_pattern = classifyDemandPattern(days);
  const warning = demand_pattern === 'sparse' ? 'sparse_data'
    : demand_pattern === 'lumpy' ? 'requires_review'
    : censored_days / n > 0.3 ? 'high_censoring'
    : undefined;

  if (nObs < 5 || demand_pattern === 'sparse') {
    return { lambda: 1, k: 1, fit_quality: 0, data_points: n, censored_days, demand_pattern, warning: 'sparse_data' };
  }

  // Method of moments
  const rawMean = obs.reduce((s, v) => s + v, 0) / nObs;
  const rawVariance =
    nObs > 1
      ? obs.reduce((s, v) => s + (v - rawMean) ** 2, 0) / (nObs - 1)
      : rawMean;

  // Censored demand correction: inflate mean by 1/(1 - fraction_censored)
  const fractionCensored = censored_days / n;
  const lambda = fractionCensored > 0.05 ? rawMean / (1 - fractionCensored) : rawMean;

  // Dispersion: k = λ² / (s² - λ);  if s² ≤ λ → Poisson limit
  const vmr = rawVariance / Math.max(rawMean, 1e-9); // variance-to-mean ratio
  const k = vmr > 1.05 ? (lambda * lambda) / Math.max(rawVariance - lambda, 1e-6) : 1000;

  // EWMA-update lambda using most recent 30 days
  const recent = days.slice(-30).filter((d) => !d.stocked_out).map((d) => d.qty);
  const recentMean = recent.length > 0
    ? recent.reduce((s, v) => s + v, 0) / recent.length
    : lambda;
  const lambdaEwma = ewmaUpdate(lambda, recentMean, 0.3);

  // Fit quality: data adequacy × model suitability
  const dataAdequacy = Math.min(1, nObs / 90);
  const modelSuitability = vmr > 1.2 ? 1.0 : vmr > 1.0 ? 0.8 : 0.6;
  const fit_quality = dataAdequacy * modelSuitability;

  return {
    lambda: Math.max(0.01, lambdaEwma),
    k: Math.max(0.01, k),
    fit_quality,
    data_points: n,
    censored_days,
    demand_pattern,
    warning,
  };
}

// ── Lead-time demand distribution ─────────────────────────────────────────────
// Convolution: sum of L i.i.d. NB(λ,k) ~ NB(L·λ, L·k)

export interface LTDResult {
  mean: number;
  std_dev: number;
  p50: number;
  p95: number;
  quantile: (p: number) => number;
  cdf: (x: number) => number;
  using_poisson: boolean;
}

export function leadTimeDemandDistribution(
  lambda: number,
  k: number,
  leadTimeDays: number,
): LTDResult {
  const ltdLambda = lambda * leadTimeDays;
  const ltdK = k * leadTimeDays;
  const using_poisson = k >= 999;

  const std_dev = using_poisson
    ? Math.sqrt(ltdLambda)
    : Math.sqrt(ltdLambda + ltdLambda ** 2 / ltdK);

  const qFn = using_poisson
    ? (p: number) => poissonQuantile(p, ltdLambda)
    : (p: number) => nbQuantile(p, ltdLambda, ltdK);

  const cdfFn = using_poisson
    ? (x: number) => { let c = 0; for (let i = 0; i <= x; i++) c += poissonPMF(i, ltdLambda); return c; }
    : (x: number) => nbCDF(x, ltdLambda, ltdK);

  return {
    mean: ltdLambda,
    std_dev,
    p50: qFn(0.50),
    p95: qFn(0.95),
    quantile: qFn,
    cdf: cdfFn,
    using_poisson,
  };
}

// ── Newsvendor optimization ───────────────────────────────────────────────────
// CR = Cu / (Cu + Co);  optimal stock = quantile(CR)

export interface NewsvendorResult {
  optimal_stock: number;
  critical_ratio: number;
  expected_stockouts: number;
  expected_overstock: number;
}

export function newsvendorOptimalStock(
  ltd: LTDResult,
  underageCost: number,   // Cu = lost gross profit per unit
  overageCost: number,    // Co = holding cost per unit per period
): NewsvendorResult {
  const cu = Math.max(0.01, underageCost);
  const co = Math.max(0.001, overageCost);
  const critical_ratio = cu / (cu + co);

  const optimal_stock = ltd.quantile(critical_ratio);
  const expected_stockouts = Math.max(0, ltd.mean - optimal_stock * ltd.cdf(optimal_stock));
  const expected_overstock = Math.max(0, optimal_stock - ltd.mean);

  return { optimal_stock, critical_ratio, expected_stockouts, expected_overstock };
}

// ── Probabilistic reorder point ───────────────────────────────────────────────

export function calculateProbabilisticROP(
  ltd: LTDResult,
  serviceLevel: number,
): { rop: number; expected_units_short: number } {
  const rop = ltd.quantile(serviceLevel);
  const expected_units_short = Math.max(0, ltd.mean - rop);
  return { rop, expected_units_short };
}
