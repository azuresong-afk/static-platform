/**
 * Движение точки по гладкой (или шероховатой) поверхности и кривой (Мещерский 31.18–31.21, 31.24, 31.26–31.30).
 *
 * Уравнение движения несвободной точки m·a = F + N (+ трение −fN·v/v); реакция N находится из проекции на нормаль,
 * закон движения — из проекции на касательную и интегралов (энергии, площадей). Вопросы:
 *  - cyl   — гладкий вертикальный цилиндр радиуса r изнутри: горизонтальная проекция движения равномерна по окружности,
 *            вертикальная — свободное падение; N = mv₀²cos²α/r (α — угол v₀ с горизонтом, ось z — вниз);
 *  - cone  — гладкий конус (вершина O внизу, ось вверх, точка на внутренней поверхности) с отталкиванием от вершины
 *            F = c·OM и, по желанию, тяжестью: s — расстояние OM по образующей, r = s sin α;
 *            r²φ̇ = const, s̈ = rφ̇² sin α + (c/m)s − g cos α; N = m(g sin α + rφ̇² cos α); численно (Рунге — Кутта);
 *  - rough — шероховатый круговой цилиндр (окружность R): снаружи от верхней точки или изнутри от нижней;
 *            u = v²: du/dφ линейно по u (касательная проекция с трением fN); остановка, сход со связи, вершина;
 *            предельные v₀ — по формулам книги и делением пополам;
 *  - wire  — математический маятник, нить которого встречает тонкую проволоку O₁ (OO₁ = h, угол β от вертикали):
 *            натяжение возрастает на mv²h/(l(l − h)); навивание — если в верхней точке малой окружности v² ≥ g(l − h);
 *  - chain — цепная линия y = a ch(x/a), сила отталкивания kmy от оси x (без тяжести): v² − ky² = const,
 *            N = m(v²a/y² − ka) (ρ = y²/a); если v₀² = ky₀², то N = 0 и ẋ = a√k;
 *  - helix — шероховатая винтовая поверхность z = aφ + f(r): движение по винтовой линии r = r₀ возможно при
 *            tg α = k√(1 + f′²(r₀)cos²α), tg α = a/r₀; скорость v = √(g r₀ f′(r₀));
 *  - alt   — маятник на высоте H: g убывает как (R/(R + H))², длину нужно уменьшить на 1 − (R/(R + H))².
 */

export type SurfAsk = 'cyl' | 'cone' | 'rough' | 'wire' | 'chain' | 'helix' | 'alt';
export interface SurfProblem {
  byWeight: boolean;
  m: number;
  g: number;
  ask: SurfAsk;
  /** rough: outer — снаружи от вершины, inner — изнутри от нижней точки. */
  side: 'outer' | 'inner';
  /** cone: учитывать силу тяжести. */
  grav: boolean;
  r: number;
  v0: number;
  /** Угол v₀ с горизонтом (cyl), половина угла раствора конуса (cone), °. */
  alpha: number;
  t1: number;
  /** Отталкивание от вершины F = c·OM (cone), Н/м. */
  c: number;
  /** OA по образующей (cone), параметр цепной линии (chain), шаг винта z = aφ (helix). */
  a: number;
  f: number;
  l: number;
  h: number;
  beta: number;
  /** chain — коэффициент силы kmy; helix — коэффициент трения. */
  k: number;
  /** helix — f′(r₀). */
  p: number;
  x0: number;
  /** Радиус Земли и высота (alt). */
  Re: number;
  H: number;
}

export interface SurfCyl {
  N: number;
  w: number;
  phi: number;
  x: number;
  y: number;
  z: number;
  /** Шаг винтовой линии за оборот — нет (ускоренное движение); время одного оборота. */
  Trev: number;
}
export interface SurfCone {
  s: number;
  r: number;
  z: number;
  phi: number;
  sd: number;
  phid: number;
  N: number;
  path: [number, number][];
  /** r(t) по шагам для графика. */
  rt: [number, number][];
}
export interface SurfRough {
  /** Что случилось: остановка (и осталась), остановка и скатывание назад, сход, вершина (inner), полоборота без событий. */
  kind: 'stop' | 'slideBack' | 'detach' | 'top' | 'none';
  phi: number;
  v: number;
  N: number;
  /** Предельная v₀: снаружи — наибольшая, чтобы остановиться; изнутри — наименьшая, чтобы дойти до верхней точки. */
  vCrit: number;
  vCritBook: number;
  phi0: number;
  curve: { phi: number; u: number; N: number }[];
}
export interface SurfWire {
  reaches: boolean;
  v: number;
  T1: number;
  T2: number;
  dT: number;
  vTop2: number;
  winds: boolean;
  alphaMin: number | null;
  dTbook: number | null;
}
export interface SurfChain {
  x: number;
  y: number;
  xd: number;
  v: number;
  N: number;
  /** v₀² = ky₀²: давление нуль, ẋ = a√k. */
  free: boolean;
  path: [number, number][];
}
export interface SurfResult {
  ok: boolean;
  errors: string[];
  mass: number;
  P: number;
  cyl?: SurfCyl;
  cone?: SurfCone;
  rough?: SurfRough;
  wire?: SurfWire;
  chain?: SurfChain;
  helix?: { tanA: number; ang: number; kNeed: number; v: number; holds: boolean | null };
  alt?: { ratio: number; gH: number };
}

const D = Math.PI / 180;

function rk4(y: number[], h: number, f: (y: number[]) => number[]): number[] {
  const k1 = f(y);
  const k2 = f(y.map((q, i) => q + (h / 2) * k1[i]));
  const k3 = f(y.map((q, i) => q + (h / 2) * k2[i]));
  const k4 = f(y.map((q, i) => q + h * k3[i]));
  return y.map((q, i) => q + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/** Шероховатая окружность: обход по φ (рад) от 0 с u = v₀²; события — остановка, сход, верхняя точка. */
export function roughRun(side: 'outer' | 'inner', R: number, f: number, g: number, v0: number, keep = false) {
  const du = (phi: number, u: number) =>
    side === 'outer' ? 2 * g * R * Math.sin(phi) - 2 * f * (g * R * Math.cos(phi) - u) : -2 * g * R * Math.sin(phi) - 2 * f * (u + g * R * Math.cos(phi));
  // Давление на поверхность на единицу массы.
  const Nm = (phi: number, u: number) => (side === 'outer' ? g * Math.cos(phi) - u / R : u / R + g * Math.cos(phi));
  const end = side === 'outer' ? Math.PI / 2 : Math.PI;
  const n = 6000,
    h = end / n;
  let u = v0 * v0,
    phi = 0;
  const curve: { phi: number; u: number; N: number }[] = [{ phi: 0, u, N: Nm(0, u) }];
  if (Nm(0, u) < 0) return { kind: 'detach' as const, phi: 0, u, curve };
  const st = (y: number[]) => [1, du(y[0], y[1])];
  const hit = (y: number[]) => y[1] <= 0 || Nm(y[0], y[1]) < 0;
  for (let i = 0; i < n; i++) {
    let nx = rk4([phi, u], h, st);
    if (hit(nx)) {
      let lo = 0,
        hi = h;
      for (let j = 0; j < 60; j++) {
        const mid = (lo + hi) / 2;
        if (hit(rk4([phi, u], mid, st))) hi = mid;
        else lo = mid;
      }
      // Что наступило: u = 0 (остановка) или N = 0 (сход со связи).
      const stop = rk4([phi, u], hi, st)[1] <= 0;
      nx = rk4([phi, u], lo, st);
      const uu = stop ? 0 : Math.max(nx[1], 0);
      curve.push({ phi: nx[0], u: uu, N: Nm(nx[0], uu) });
      // В покое точка удерживается трением, если tg φ ≤ f (φ — угол нормали с вертикалью).
      if (stop) return { kind: Math.tan(nx[0]) <= f ? ('stop' as const) : ('slideBack' as const), phi: nx[0], u: 0, curve };
      return { kind: 'detach' as const, phi: nx[0], u: uu, curve };
    }
    phi = nx[0];
    u = nx[1];
    if (keep || i % 30 === 29) curve.push({ phi, u, N: Nm(phi, u) });
  }
  return { kind: side === 'inner' ? ('top' as const) : ('none' as const), phi, u, curve };
}

export function solveSurf(p: SurfProblem): SurfResult {
  const errors: string[] = [];
  const nums = [p.m, p.g, p.r, p.v0, p.alpha, p.t1, p.c, p.a, p.f, p.l, p.h, p.beta, p.k, p.p, p.x0, p.Re, p.H];
  if (!nums.every(Number.isFinite)) errors.push('Все данные — числа.');
  if (!(p.g > 0)) errors.push('g — положительное число.');
  if (!(p.m > 0)) errors.push(p.byWeight ? 'Вес P — положительное число.' : 'Масса m — положительное число.');
  const mass = p.byWeight ? p.m / p.g : p.m;
  const P = mass * p.g;
  const base: SurfResult = { ok: false, errors, mass, P };
  if (errors.length) return base;
  const bad = (e: string): SurfResult => ({ ...base, errors: [e] });
  const g = p.g;

  if (p.ask === 'cyl') {
    if (!(p.r > 0)) return bad('Радиус цилиндра r — положительное число.');
    if (!(Math.abs(p.alpha) < 90)) return bad('Угол v₀ с горизонтом — от −90° до 90°.');
    if (!(p.t1 >= 0)) return bad('Время t₁ — неотрицательное число.');
    const vh = p.v0 * Math.cos(p.alpha * D);
    const w = vh / p.r;
    const phi = w * p.t1;
    return {
      ...base,
      ok: true,
      cyl: {
        N: (mass * vh * vh) / p.r,
        w,
        phi,
        x: p.r * Math.cos(phi),
        y: p.r * Math.sin(phi),
        z: p.v0 * Math.sin(p.alpha * D) * p.t1 + (g * p.t1 * p.t1) / 2,
        Trev: w !== 0 ? (2 * Math.PI) / Math.abs(w) : Infinity,
      },
    };
  }

  if (p.ask === 'cone') {
    if (!(p.alpha > 0 && p.alpha < 90)) return bad('Половина угла раствора конуса α — от 0 до 90°.');
    if (!(p.a > 0)) return bad('Начальное расстояние OA — положительное число.');
    if (!(p.t1 > 0)) return bad('Время t₁ — положительное число.');
    const sa = Math.sin(p.alpha * D),
      ca = Math.cos(p.alpha * D);
    const gg = p.grav ? g : 0;
    const L = p.a * sa * p.v0; // r²φ̇
    const cm = p.c / mass;
    const rhs = (y: number[]) => {
      const r = y[0] * sa;
      const pd = L / (r * r);
      return [y[1], r * pd * pd * sa + cm * y[0] - gg * ca, pd];
    };
    const n = Math.max(2000, Math.ceil(p.t1 * 2000));
    const h = p.t1 / n;
    let y = [p.a, 0, 0];
    const path: [number, number][] = [[p.a * sa, 0]];
    const rt: [number, number][] = [[0, p.a * sa]];
    for (let i = 0; i < n; i++) {
      y = rk4(y, h, rhs);
      if (!(y[0] > 1e-9) || !y.every(Number.isFinite)) return bad('Точка дошла до вершины конуса — дальше уравнения неприменимы.');
      if (i % Math.ceil(n / 400) === 0 || i === n - 1) {
        path.push([y[0] * sa, y[2]]);
        rt.push([(i + 1) * h, y[0] * sa]);
      }
    }
    const r = y[0] * sa;
    const pd = L / (r * r);
    return { ...base, ok: true, cone: { s: y[0], r, z: y[0] * ca, phi: y[2], sd: y[1], phid: pd, N: mass * (gg * sa + r * pd * pd * ca), path, rt } };
  }

  if (p.ask === 'rough') {
    if (!(p.r > 0)) return bad('Радиус R — положительное число.');
    if (!(p.f >= 0)) return bad('Коэффициент трения f — неотрицательное число.');
    if (!(p.v0 >= 0)) return bad('Начальная скорость v₀ — неотрицательное число.');
    const R = p.r,
      f = p.f;
    const run = roughRun(p.side, R, f, g, p.v0);
    const phi0 = Math.atan(f);
    // Предельная скорость делением пополам.
    let lo = 0,
      hi = p.side === 'outer' ? Math.sqrt(g * R) : Math.sqrt(g * R * (5 + 20 * f) * Math.exp(2 * Math.PI * f));
    const okOuter = (v: number) => roughRun('outer', R, f, g, v).kind === 'stop';
    const okInner = (v: number) => roughRun('inner', R, f, g, v).kind === 'top';
    for (let j = 0; j < 50; j++) {
      const mid = (lo + hi) / 2;
      if (p.side === 'outer' ? okOuter(mid) : !okInner(mid)) lo = mid;
      else hi = mid;
    }
    const k = 1 + 4 * f * f;
    const book =
      p.side === 'outer'
        ? Math.sqrt(((2 * g * R) / k) * (Math.sqrt(1 + f * f) * Math.exp(-2 * f * phi0) - (1 - 2 * f * f)))
        : Math.sqrt(((g * R) / k) * (2 * (1 - 2 * f * f) + 3 * Math.exp(2 * Math.PI * f)));
    const last = run.curve[run.curve.length - 1];
    return {
      ...base,
      ok: true,
      rough: {
        kind: run.kind,
        phi: run.phi / D,
        v: Math.sqrt(Math.max(run.u, 0)),
        N: mass * last.N,
        vCrit: (lo + hi) / 2,
        vCritBook: book,
        phi0: phi0 / D,
        curve: run.curve.map((q) => ({ phi: q.phi / D, u: q.u, N: mass * q.N })),
      },
    };
  }

  if (p.ask === 'wire') {
    if (!(p.l > 0 && p.h > 0 && p.h < p.l)) return bad('Нить l > 0, проволока внутри круга качаний: 0 < h < l.');
    if (!(p.alpha > 0 && p.alpha <= 180)) return bad('Начальный угол отклонения α — от 0 до 180°.');
    const ca = Math.cos(p.alpha * D),
      cb = Math.cos(p.beta * D);
    const v2 = 2 * g * p.l * (cb - ca);
    if (!(v2 > 0)) return { ...base, ok: true, wire: { reaches: false, v: 0, T1: 0, T2: 0, dT: 0, vTop2: 0, winds: false, alphaMin: null, dTbook: null } };
    const T1 = mass * (v2 / p.l + g * cb),
      T2 = mass * (v2 / (p.l - p.h) + g * cb);
    const vTop2 = 2 * g * (-p.l * ca + p.h * cb - (p.l - p.h));
    const arg = (p.h / p.l) * (1.5 + cb) - 1.5;
    const alphaMin = Math.abs(arg) <= 1 ? Math.acos(arg) / D : null;
    return {
      ...base,
      ok: true,
      wire: {
        reaches: true,
        v: Math.sqrt(v2),
        T1,
        T2,
        dT: T2 - T1,
        vTop2,
        winds: vTop2 >= g * (p.l - p.h),
        alphaMin,
        dTbook: alphaMin != null ? 2 * P * (p.h / p.l) * (1.5 + cb) : null,
      },
    };
  }

  if (p.ask === 'chain') {
    if (!(p.a > 0)) return bad('Параметр цепной линии a — положительное число.');
    if (!(p.k >= 0)) return bad('Коэффициент k — неотрицательное число.');
    if (!(p.t1 >= 0)) return bad('Время t₁ — неотрицательное число.');
    const a = p.a,
      k = p.k;
    const y0 = a * Math.cosh(p.x0 / a);
    const v0 = p.v0 * Math.cosh(p.x0 / a); // p.v0 — ẋ₀
    const C = v0 * v0 - k * y0 * y0;
    const sgn = p.v0 >= 0 ? 1 : -1;
    const xd = (x: number) => {
      const ch = Math.cosh(x / a);
      return (sgn * Math.sqrt(Math.max(C + k * a * a * ch * ch, 0))) / ch;
    };
    const n = Math.max(1000, Math.ceil(p.t1 * 1000)),
      h = p.t1 / n;
    let x = p.x0;
    const path: [number, number][] = [[x, y0]];
    for (let i = 0; i < n; i++) {
      x = rk4([x], h, (q) => [xd(q[0])])[0];
      if (!Number.isFinite(x) || Math.abs(x / a) > 50) return bad('Точка уходит слишком далеко: уменьшите t₁.');
      if (i % Math.ceil(n / 300) === 0) path.push([x, a * Math.cosh(x / a)]);
    }
    const y = a * Math.cosh(x / a);
    const v2 = C + k * y * y;
    path.push([x, y]);
    return {
      ...base,
      ok: true,
      chain: { x, y, xd: xd(x), v: Math.sqrt(Math.max(v2, 0)), N: mass * a * (v2 / (y * y) - k), free: Math.abs(C) <= 1e-9 * Math.max(1, v0 * v0), path },
    };
  }

  if (p.ask === 'helix') {
    if (!(p.r > 0)) return bad('Радиус винтовой линии r₀ — положительное число.');
    if (!(p.p > 0)) return bad('Наклон профиля f′(r₀) — положительное число (поверхность поднимается от оси).');
    const tanA = p.a / p.r;
    const ang = Math.atan(tanA);
    const kNeed = tanA / Math.sqrt(1 + p.p * p.p * Math.cos(ang) ** 2);
    return {
      ...base,
      ok: true,
      helix: { tanA, ang: ang / D, kNeed, v: Math.sqrt(g * p.r * p.p), holds: p.k > 0 ? Math.abs(p.k - kNeed) <= 1e-3 * kNeed : null },
    };
  }

  if (!(p.Re > 0 && p.H >= 0)) return bad('Радиус Земли R > 0, высота H ≥ 0.');
  const q = (p.Re / (p.Re + p.H)) ** 2;
  return { ...base, ok: true, alt: { ratio: 1 - q, gH: g * q } };
}
