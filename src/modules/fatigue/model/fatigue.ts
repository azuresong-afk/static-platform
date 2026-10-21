/**
 * Усталостная прочность (Антонов, гл. 11).
 *
 * Цикл (п. 11.2): σ_m = (σ_max + σ_min)/2, σ_a = (σ_max − σ_min)/2, R = σ_min/σ_max.
 * Коэффициент снижения предела выносливости детали K_D ≥ 1 (предел выносливости детали σ₋₁D = σ₋₁/K_D):
 *   п. 11.5 — K_D = K_σ/(K_F·K_d·β);  п. 11.6 (с поверхностным упрочнением) — K_D = (K_σ/K_d + 1/K_F − 1)/K_v.
 *   В п. 11.5 пособия обозначено K = K_F·K_d·β/K_σ < 1 (σ̄₋₁ = σ₋₁·K), а в формулах пп. 11.6–11.7 K ≥ 1 умножает
 *   амплитуду — это обратная величина; здесь везде K_D ≥ 1.
 * Запас (п. 11.7): n_σ = σ₋₁/(K_D·σ_a + ψ_σ·σ_m), ψ_σ = σ₋₁/σ_в — по прямой предельных циклов A₀B₀
 *   σ_a/σ₋₁ + σ_m/σ_в = 1; так же n_τ (ψ_τ = τ₋₁/τ_в или 0,5ψ_σ); совместное действие — формула Гафа и Полларда
 *   1/n² = 1/n_σ² + 1/n_τ². Первое приближение п. 11.5 (без коэффициентов детали): 1/n = σ_a/σ₋₁ + σ_m/σ_т.
 */
export type CycleMode = 'minmax' | 'ma';
export interface Cycle {
  on: boolean;
  mode: CycleMode;
  max: number;
  min: number;
  m: number;
  a: number;
}
export interface FatigueProblem {
  /** Предел прочности, текучести (0 — не задан), пределы выносливости при симметричном цикле, МПа. */
  sigB: number;
  sigT: number;
  sig1: number;
  tau1: number;
  /** Предел прочности при сдвиге τ_в (0 — ψ_τ = 0,5ψ_σ). */
  tauB: number;
  sigma: Cycle;
  tau: Cycle;
  /** Формула коэффициента K_D: п. 11.5 (произведение) или п. 11.6 (с упрочнением K_v). */
  kMode: 'mult' | 'surf';
  Ks: number;
  Kt: number;
  KF: number;
  Kd: number;
  beta: number;
  Kv: number;
  /** Требуемый запас [n]. */
  nAllow: number;
}
export interface CycleResult {
  max: number;
  min: number;
  m: number;
  a: number;
  /** R = σ_min/σ_max (null — σ_max = 0). */
  R: number | null;
  kind: string;
  KD: number;
  /** Предел выносливости детали. */
  limD: number;
  psi: number;
  n: number;
}
export interface FatigueResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  sigma: CycleResult | null;
  tau: CycleResult | null;
  /** Общий запас (по одному виду напряжений — он же). */
  n: number;
  /** Первое приближение п. 11.5 (по нормальным напряжениям, если задан σ_т). */
  n1: number | null;
  okN: boolean;
}

/** Характеристики цикла по заданию. */
export function cycleOf(c: Cycle): { max: number; min: number; m: number; a: number; R: number | null; kind: string } {
  const max = c.mode === 'minmax' ? Math.max(c.max, c.min) : c.m + Math.abs(c.a);
  const min = c.mode === 'minmax' ? Math.min(c.max, c.min) : c.m - Math.abs(c.a);
  const m = (max + min) / 2,
    a = (max - min) / 2;
  // Коэффициент асимметрии — как в пособии: R = σ_min/σ_max (алгебраические наименьшее и наибольшее).
  const R = Math.abs(max) > 1e-12 ? min / max : null;
  const sc = Math.max(Math.abs(max), Math.abs(min), 1e-300);
  const kind =
    a <= 1e-12 * sc
      ? 'постоянное напряжение (статическое нагружение)'
      : Math.abs(m) <= 1e-12 * sc
        ? 'симметричный цикл (R = −1)'
        : Math.abs(min) <= 1e-12 * sc || Math.abs(max) <= 1e-12 * sc
          ? 'пульсационный (отнулевой) цикл (R = 0)'
          : 'асимметричный цикл';
  return { max, min, m, a, R, kind };
}

/** Коэффициент снижения предела выносливости детали K_D ≥ 1. */
export function kD(pr: FatigueProblem, Kconc: number): number {
  return pr.kMode === 'mult' ? Kconc / (pr.KF * pr.Kd * pr.beta) : (Kconc / pr.Kd + 1 / pr.KF - 1) / pr.Kv;
}

export function solveFatigue(pr: FatigueProblem): FatigueResult {
  const errors: string[] = [],
    warnings: string[] = [];
  if (!pr.sigma.on && !pr.tau.on) errors.push('Задайте цикл нормальных или касательных напряжений.');
  if (!(pr.sigB > 0)) errors.push('Предел прочности σ_в — положительное число.');
  if (pr.sigma.on && !(pr.sig1 > 0)) errors.push('Предел выносливости σ₋₁ — положительное число.');
  if (pr.tau.on && !(pr.tau1 > 0)) errors.push('Предел выносливости τ₋₁ — положительное число.');
  if (pr.sigT < 0 || pr.tauB < 0) errors.push('σ_т и τ_в — неотрицательные числа (0 — не заданы).');
  for (const [v, name] of [
    [pr.KF, 'K_F'],
    [pr.Kd, 'K_d'],
    [pr.beta, 'β'],
    [pr.Kv, 'K_v'],
    [pr.Ks, 'K_σ'],
    [pr.Kt, 'K_τ'],
  ] as const)
    if (!(v > 0)) errors.push(`Коэффициент ${name} — положительное число.`);
  if (!(pr.nAllow > 0)) errors.push('Требуемый запас [n] — положительное число.');
  const empty: FatigueResult = { ok: false, errors, warnings, sigma: null, tau: null, n: 0, n1: null, okN: false };
  if (errors.length) return empty;
  const psiS = pr.sig1 / pr.sigB;
  const one = (c: Cycle, lim: number, Kc: number, psi: number): CycleResult => {
    const cy = cycleOf(c);
    const KD = kD(pr, Kc);
    const den = KD * cy.a + psi * cy.m;
    return { ...cy, KD, limD: lim / KD, psi, n: den > 0 ? lim / den : Infinity };
  };
  const sigma = pr.sigma.on ? one(pr.sigma, pr.sig1, pr.Ks, psiS) : null;
  const tau = pr.tau.on ? one(pr.tau, pr.tau1, pr.Kt, pr.tauB > 0 ? pr.tau1 / pr.tauB : 0.5 * psiS) : null;
  for (const [c, name] of [
    [sigma, 'σ'],
    [tau, 'τ'],
  ] as const) {
    if (!c) continue;
    if (c.KD < 1) warnings.push(`K_D для ${name} получился меньше 1 — проверьте коэффициенты (обычно K_σ ≥ 1, K_F, K_d, β ≤ 1).`);
    if (c.m < 0)
      warnings.push(`Среднее напряжение цикла ${name} отрицательное (сжатие): формула п. 11.7 построена для σ_m ≥ 0 и при сжатии даёт завышенный запас.`);
    if (!Number.isFinite(c.n)) warnings.push(`По ${name} переменной составляющей нет — запас по выносливости не ограничен.`);
  }
  const ns = sigma?.n ?? Infinity,
    nt = tau?.n ?? Infinity;
  const n = Number.isFinite(ns) && Number.isFinite(nt) ? (ns * nt) / Math.hypot(ns, nt) : Math.min(ns, nt);
  let n1: number | null = null;
  if (sigma && pr.sigT > 0) {
    const d = sigma.a / pr.sig1 + sigma.m / pr.sigT;
    n1 = d > 0 ? 1 / d : Infinity;
  }
  return { ok: true, errors: [], warnings, sigma, tau, n, n1, okN: n >= pr.nAllow };
}
