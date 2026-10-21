/**
 * Равновесие при равномерном вращении — относительный покой точки (тела) в системе, вращающейся вокруг вертикальной
 * оси (Мещерский 26.5–26.7, 26.9, 26.21, 26.27, 26.29, 26.31–26.35, 31.10, 31.25, 41.24–41.26).
 *
 * Точка движется по окружности радиуса R равномерно: ускорение v²/R = ω²R направлено к центру. По принципу Даламбера
 * к силам добавляется центробежная сила инерции mω²R от оси, и задача становится статической. Вопросы:
 *  - bank   — вираж, возвышение рельса, наклон велосипедиста, подвесной вагон: tg α* = v²/(gR) — наклон, при котором
 *             сила (давление) перпендикулярна полотну; на вираже с трением f — наименьшая и наибольшая скорость
 *             v² = gR(tg α ∓ f)/(1 ± f tg α); показание пружинных весов в вагоне N = m√(g² + v⁴/R²);
 *  - cone   — конический маятник (нить длиной l): ω² = g/(l cos θ), T = mg/cos θ = mω²l; сферический маятник,
 *             описывающий горизонтальную окружность радиуса r: v₀ = r√(g/z₀), z₀ = √(l² − r²);
 *  - vert   — равномерное движение по вертикальной окружности: натяжение (давление) внизу m(g + v²/R), вверху
 *             m(v²/R − g); наименьшая ω, при которой рвётся нить; ω, при которой исчезает давление вверху;
 *  - spring — груз в радиальной направляющей с пружиной к оси: mω²r = c(r − r_s), r_s — радиус, при котором пружина
 *             не напряжена; найти r, c, ω или c и r_s по двум состояниям (предохранительный выключатель);
 *  - rods   — тонкие однородные стержни на шарнире вала (тахометр): плечи a и b под углом γ; момент сил тяжести
 *             уравновешен моментом центробежных сил инерции:
 *             (g/2)Σ lᵢ² sin θᵢ = (ω²/3)Σ lᵢ³ sin θᵢ cos θᵢ, θ₁ = φ, θ₂ = φ − γ (углы от вертикали вниз);
 *  - tube   — форма трубки, в которой шарик в любом месте в относительном покое: y = ω²x²/(2g) + c.
 */

export type SpinAsk = 'bank' | 'cone' | 'vert' | 'spring' | 'rods' | 'tube';
export interface SpinProblem {
  byWeight: boolean;
  m: number;
  g: number;
  ask: SpinAsk;
  /** Что ищем внутри вопроса: bank — angle | speed | radius; cone — theta | omega | radius; vert — N | break | top; spring — r | c | c2 | omega; rods — phi | omega. */
  find: string;
  R: number;
  v: number;
  /** Наклон полотна, °; трение; ширина колеи; показание весов в долях веса. */
  alpha: number;
  f: number;
  d: number;
  k: number;
  /** Нить конического маятника, угол с вертикалью (°), угловая скорость, радиус окружности. */
  l: number;
  theta: number;
  omega: number;
  r: number;
  /** Разрывное натяжение; диаметр колеса (скорость тепловоза). */
  T: number;
  D: number;
  /** Пружина: жёсткость, радиус без напряжения; второе состояние. */
  c: number;
  rs: number;
  r2: number;
  w2: number;
  /** Стержни: плечи, угол между ними (°), угол плеча a с вертикалью (°). */
  a: number;
  b: number;
  gamma: number;
  phi: number;
  /** Трубка: абсцисса точки. */
  x1: number;
}

export interface SpinBank {
  /** v²/(gR) = tg α*. */
  q: number;
  alphaStar: number;
  Ntot: number;
  h: number;
  vIdeal: number;
  vMin: number;
  /** Infinity — ограничения сверху нет (f tg α ≥ 1). */
  vMax: number;
  N: number;
  /** Нужная сила трения, «+» — вниз по откосу (к центру). */
  Ffr: number;
  fNeed: number;
  Rfound: number;
  tilt: number;
}
export interface SpinCone {
  theta: number;
  r: number;
  z0: number;
  omega: number;
  v: number;
  T: number;
  period: number;
  /** ω² l ≤ g: при данной ω нить остаётся вертикальной. */
  hangs: boolean;
}
export interface SpinVert {
  omega: number;
  v: number;
  Nb: number;
  Nt: number;
  /** Скорость тепловоза ωD/2, если задан диаметр колеса. */
  vTrain: number | null;
}
export interface SpinSpring {
  r: number;
  c: number;
  rs: number;
  omega: number;
  /** Сила пружины (предварительное натяжение) в первом состоянии. */
  F: number;
}
export interface SpinRods {
  phi: number;
  omega: number;
  /** Все положения относительного равновесия при данной ω, ° и устойчивость. */
  roots: { phi: number; stable: boolean }[];
  /** Реакция шарнира: вертикальная составляющая, горизонтальная (от оси), модуль. */
  Nv: number;
  Nh: number;
  N: number;
  /** Моменты на единицу погонной массы при найденном φ: сил тяжести и центробежных сил. */
  Mg: number;
  Mc: number;
}
export interface SpinResult {
  ok: boolean;
  errors: string[];
  mass: number;
  P: number;
  bank?: SpinBank;
  cone?: SpinCone;
  vert?: SpinVert;
  spring?: SpinSpring;
  rods?: SpinRods;
  tube?: { y: number; slope: number; ang: number };
}

const D = Math.PI / 180;
export const FINDS: Record<SpinAsk, string[]> = {
  bank: ['angle', 'speed', 'radius'],
  cone: ['theta', 'omega', 'radius'],
  vert: ['N', 'break', 'top'],
  spring: ['r', 'c', 'c2', 'omega'],
  rods: ['phi', 'omega'],
  tube: ['y'],
};

/** Моменты сил тяжести и центробежных сил стержней (на единицу погонной массы, без ω²). */
export function rodMoments(a: number, b: number, gamma: number, g: number, phi: number) {
  const t1 = phi * D,
    t2 = (phi - gamma) * D;
  return {
    G: (g / 2) * (a * a * Math.sin(t1) + b * b * Math.sin(t2)),
    C: (a ** 3 * Math.sin(t1) * Math.cos(t1) + b ** 3 * Math.sin(t2) * Math.cos(t2)) / 3,
    /** Σ lᵢ²/2 sin θᵢ — статический момент масс относительно оси (на единицу погонной массы). */
    S: (a * a * Math.sin(t1) + b * b * Math.sin(t2)) / 2,
  };
}

export function solveSpin(p: SpinProblem): SpinResult {
  const errors: string[] = [];
  const nums = [p.m, p.g, p.R, p.v, p.alpha, p.f, p.d, p.k, p.l, p.theta, p.omega, p.r, p.T, p.D, p.c, p.rs, p.r2, p.w2, p.a, p.b, p.gamma, p.phi, p.x1];
  if (!nums.every(Number.isFinite)) errors.push('Все данные — числа.');
  if (!(p.g > 0)) errors.push('g — положительное число.');
  if (!(p.m > 0)) errors.push(p.byWeight ? 'Вес P — положительное число.' : 'Масса m — положительное число.');
  if (!FINDS[p.ask]?.includes(p.find)) errors.push('Не выбрано, что искать.');
  const mass = p.byWeight ? p.m / p.g : p.m;
  const P = mass * p.g;
  const base: SpinResult = { ok: false, errors, mass, P };
  if (errors.length) return base;
  const bad = (e: string): SpinResult => ({ ...base, errors: [e] });
  const g = p.g;

  if (p.ask === 'bank') {
    if (p.find === 'radius') {
      if (!(p.v > 0)) return bad('Скорость v — положительное число.');
      if (!(p.k > 1)) return bad('Показание весов больше веса: k = N/P > 1.');
      const an = Math.sqrt(p.k * p.k - 1) * g;
      const R = (p.v * p.v) / an;
      return {
        ...base,
        ok: true,
        bank: {
          q: an / g,
          alphaStar: Math.atan(an / g) / D,
          Ntot: p.k * P,
          h: 0,
          vIdeal: p.v,
          vMin: NaN,
          vMax: NaN,
          N: p.k * P,
          Ffr: 0,
          fNeed: 0,
          Rfound: R,
          tilt: Math.acos(1 / p.k) / D,
        },
      };
    }
    if (!(p.R > 0)) return bad('Радиус закругления R — положительное число.');
    if (!(p.v >= 0)) return bad('Скорость v — неотрицательное число.');
    const q = (p.v * p.v) / (g * p.R);
    const alphaStar = Math.atan(q) / D;
    const Ntot = mass * Math.hypot(g, (p.v * p.v) / p.R);
    if (p.find === 'angle') {
      if (!(p.d >= 0)) return bad('Ширина колеи d — неотрицательное число.');
      return {
        ...base,
        ok: true,
        bank: {
          q,
          alphaStar,
          Ntot,
          h: p.d * Math.sin(alphaStar * D),
          vIdeal: p.v,
          vMin: NaN,
          vMax: NaN,
          N: Ntot,
          Ffr: 0,
          fNeed: q,
          Rfound: p.R,
          tilt: alphaStar,
        },
      };
    }
    if (!(p.alpha >= 0 && p.alpha < 90)) return bad('Наклон полотна α — от 0 до 90°.');
    if (!(p.f >= 0)) return bad('Коэффициент трения f — неотрицательное число.');
    const ta = Math.tan(p.alpha * D),
      sa = Math.sin(p.alpha * D),
      ca = Math.cos(p.alpha * D);
    const lo = (ta - p.f) / (1 + p.f * ta);
    const den = 1 - p.f * ta;
    const vMin = lo > 0 ? Math.sqrt(g * p.R * lo) : 0;
    const vMax = den > 0 ? Math.sqrt((g * p.R * (ta + p.f)) / den) : Infinity;
    const an = (p.v * p.v) / p.R;
    const N = mass * (g * ca + an * sa);
    const Ffr = mass * (an * ca - g * sa);
    return {
      ...base,
      ok: true,
      bank: {
        q,
        alphaStar,
        Ntot,
        h: 0,
        vIdeal: Math.sqrt(g * p.R * ta),
        vMin,
        vMax,
        N,
        Ffr,
        fNeed: N > 0 ? Math.abs(Ffr) / N : Infinity,
        Rfound: p.R,
        tilt: p.alpha,
      },
    };
  }

  if (p.ask === 'cone') {
    if (!(p.l > 0)) return bad('Длина нити l — положительное число.');
    if (p.find === 'theta') {
      if (!(p.theta > 0 && p.theta < 90)) return bad('Угол нити с вертикалью θ — от 0 до 90°.');
      const th = p.theta * D;
      const z0 = p.l * Math.cos(th),
        r = p.l * Math.sin(th);
      const w = Math.sqrt(g / z0);
      return { ...base, ok: true, cone: { theta: p.theta, r, z0, omega: w, v: w * r, T: P / Math.cos(th), period: (2 * Math.PI) / w, hangs: false } };
    }
    if (p.find === 'omega') {
      if (!(p.omega > 0)) return bad('Угловая скорость ω — положительное число.');
      const w = p.omega;
      if (w * w * p.l <= g) return { ...base, ok: true, cone: { theta: 0, r: 0, z0: p.l, omega: w, v: 0, T: P, period: (2 * Math.PI) / w, hangs: true } };
      const cth = g / (w * w * p.l);
      const th = Math.acos(cth);
      return {
        ...base,
        ok: true,
        cone: {
          theta: th / D,
          r: p.l * Math.sin(th),
          z0: p.l * cth,
          omega: w,
          v: w * p.l * Math.sin(th),
          T: mass * w * w * p.l,
          period: (2 * Math.PI) / w,
          hangs: false,
        },
      };
    }
    if (!(p.r > 0 && p.r < p.l)) return bad('Радиус окружности r — от 0 до длины нити l.');
    const z0 = Math.sqrt(p.l * p.l - p.r * p.r);
    const w = Math.sqrt(g / z0);
    return {
      ...base,
      ok: true,
      cone: { theta: Math.asin(p.r / p.l) / D, r: p.r, z0, omega: w, v: w * p.r, T: (P * p.l) / z0, period: (2 * Math.PI) / w, hangs: false },
    };
  }

  if (p.ask === 'vert') {
    if (!(p.R > 0)) return bad('Радиус окружности R — положительное число.');
    let w: number;
    if (p.find === 'N') {
      if (!(p.v >= 0)) return bad('Скорость v — неотрицательное число.');
      w = p.v / p.R;
    } else if (p.find === 'break') {
      if (!(p.T > P)) return bad('Разрывное натяжение T больше веса: иначе нить рвётся и в покое.');
      w = Math.sqrt((p.T / mass - g) / p.R);
    } else w = Math.sqrt(g / p.R);
    const an = w * w * p.R;
    return { ...base, ok: true, vert: { omega: w, v: w * p.R, Nb: mass * (g + an), Nt: mass * (an - g), vTrain: p.D > 0 ? (w * p.D) / 2 : null } };
  }

  if (p.ask === 'spring') {
    if (!(p.rs >= 0)) return bad('Радиус r_s, при котором пружина не напряжена, — неотрицательное число.');
    if (p.find === 'r') {
      if (!(p.c > 0 && p.omega >= 0)) return bad('Жёсткость c > 0, ω ≥ 0.');
      const mw = mass * p.omega * p.omega;
      if (!(p.c > mw)) return bad('c ≤ mω²: пружина не удерживает груз — он уходит к ободу.');
      const r = (p.c * p.rs) / (p.c - mw);
      return { ...base, ok: true, spring: { r, c: p.c, rs: p.rs, omega: p.omega, F: mw * r } };
    }
    if (!(p.r > 0)) return bad('Радиус r — положительное число.');
    if (p.find === 'c') {
      if (!(p.r > p.rs)) return bad('Пружина растянута: r > r_s.');
      const mw = mass * p.omega * p.omega;
      return { ...base, ok: true, spring: { r: p.r, c: (mw * p.r) / (p.r - p.rs), rs: p.rs, omega: p.omega, F: mw * p.r } };
    }
    if (p.find === 'omega') {
      if (!(p.c > 0 && p.r > p.rs)) return bad('Жёсткость c > 0, пружина растянута: r > r_s.');
      const w = Math.sqrt((p.c * (p.r - p.rs)) / (mass * p.r));
      return { ...base, ok: true, spring: { r: p.r, c: p.c, rs: p.rs, omega: w, F: p.c * (p.r - p.rs) } };
    }
    if (!(p.r2 > p.r)) return bad('Во втором состоянии груз дальше от оси: r₂ > r.');
    const F1 = mass * p.omega * p.omega * p.r,
      F2 = mass * p.w2 * p.w2 * p.r2;
    const c = (F2 - F1) / (p.r2 - p.r);
    if (!(c > 0)) return bad('По двум состояниям жёсткость не положительна: проверьте ω и r.');
    return { ...base, ok: true, spring: { r: p.r, c, rs: p.r - F1 / c, omega: p.omega, F: F1 } };
  }

  if (p.ask === 'rods') {
    if (!(p.a > 0 && p.b >= 0)) return bad('Плечо a > 0, плечо b ≥ 0.');
    if (!(p.gamma > 0 && p.gamma <= 180)) return bad('Угол между плечами γ — от 0 до 180°.');
    const rho = mass / (p.a + p.b);
    const at = (phi: number, w: number): SpinRods => {
      const M = rodMoments(p.a, p.b, p.gamma, g, phi);
      const Nh = rho * w * w * M.S;
      return { phi, omega: w, roots: [], Nv: P, Nh, N: Math.hypot(P, Nh), Mg: M.G, Mc: w * w * M.C };
    };
    if (p.find === 'omega') {
      const M = rodMoments(p.a, p.b, p.gamma, g, p.phi);
      const w2 = M.G / M.C;
      if (!(Number.isFinite(w2) && w2 > 0)) return bad('При таком угле φ относительное равновесие невозможно ни при какой ω.');
      return { ...base, ok: true, rods: at(p.phi, Math.sqrt(w2)) };
    }
    if (!(p.omega >= 0)) return bad('Угловая скорость ω — неотрицательное число.');
    const w = p.omega;
    const F = (phi: number) => {
      const M = rodMoments(p.a, p.b, p.gamma, g, phi);
      return M.G - w * w * M.C;
    };
    // Корни F(φ) = 0 на (−180°, 180°]: перебор с шагом 0,05° и деление пополам.
    const roots: { phi: number; stable: boolean }[] = [];
    const step = 0.05;
    let f0 = F(-180);
    for (let x = -180 + step; x <= 180 + 1e-9; x += step) {
      const f1 = F(x);
      if (f0 === 0 || f0 * f1 < 0) {
        let lo = x - step,
          hi = x;
        if (f0 !== 0)
          for (let j = 0; j < 60; j++) {
            const mid = (lo + hi) / 2;
            if (F(lo) * F(mid) <= 0) hi = mid;
            else lo = mid;
          }
        const r = f0 === 0 ? x - step : (lo + hi) / 2;
        // Устойчиво, если при отклонении момент возвращает: F растёт с φ.
        roots.push({ phi: Math.abs(r) < 1e-9 ? 0 : r, stable: F(r + 0.01) - F(r - 0.01) > 0 });
      }
      f0 = f1;
    }
    const pick = roots.find((q) => q.stable && q.phi > 1e-6) ?? roots.find((q) => q.stable) ?? roots[0];
    if (!pick) return bad('Положений относительного равновесия нет.');
    return { ...base, ok: true, rods: { ...at(pick.phi, w), roots } };
  }

  if (!(p.omega > 0)) return bad('Угловая скорость ω — положительное число.');
  const k2 = (p.omega * p.omega) / g;
  return { ...base, ok: true, tube: { y: (k2 * p.x1 * p.x1) / 2, slope: k2 * p.x1, ang: Math.atan(k2 * p.x1) / D } };
}
