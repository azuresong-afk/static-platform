/**
 * Движение точки по окружности в вертикальной плоскости (Мещерский 26.5–26.10, 31.1–31.4, 31.14–31.23; Яблонский Д.6).
 *
 * Связь гладкая: нить, внутренняя поверхность (петля, желоб), внешняя поверхность (купол, выпуклый мост) или двусторонняя
 * (стержень, колечко на проволоке). Положение — угол φ от нижней точки окружности против часовой стрелки: точка
 * (R sin φ, −R cos φ) относительно центра, высота над нижней точкой y = R(1 − cos φ). Силы: тяжесть и, по желанию,
 * пружина (упругая нить) от неподвижной точки A: F = −c(|AM| − L₀)·AM/|AM|.
 *
 * Интеграл энергии: v² = v₀² − 2g(y − y₀) − (2/m)(Π_пр(φ) − Π_пр(φ₀)), Π_пр = c(|AM| − L₀)²/2.
 * Уравнение в проекции на нормаль (к центру): m v²/R = N − mg cos φ + F_пр·n, n = (−sin φ, cos φ) ⇒
 *   N = m v²/R + mg cos φ − F_пр·n.
 * N — проекция реакции связи на направление к центру: у нити это натяжение (N ≥ 0), у внутренней поверхности —
 * давление на неё (N ≥ 0); у внешней поверхности реакция направлена от центра, давление равно −N ≥ 0; двусторонняя
 * связь — любой знак. Отрыв (ослабление нити) — там, где N обращается в нуль; остановка — где v = 0.
 */
export type CircleLink = 'thread' | 'inner' | 'outer' | 'rod';
export interface CircleProblem {
  byWeight: boolean;
  /** Масса (или вес). */
  m: number;
  g: number;
  R: number;
  link: CircleLink;
  /** Начальное положение, ° от нижней точки против часовой стрелки; скорость, «+» — в сторону роста φ. */
  phi0: number;
  v0: number;
  /** Пружина от неподвижной точки A (координаты относительно центра), жёсткость и длина без натяжения. */
  spring: boolean;
  ax: number;
  ay: number;
  c: number;
  L0: number;
  /** Что ищем: состояние в положении φ₁; где точка остановится или сойдёт со связи; наименьшую v₀ для полного оборота. */
  ask: 'at' | 'detach' | 'full';
  phi1: number;
}
export interface CircleEvent {
  /** Остановка (v = 0), отрыв (N = 0) или полный оборот без того и другого. */
  kind: 'stop' | 'detach' | 'round';
  /** Угол события, ° (без приведения к 0…360: со знаком направления движения). */
  phi: number;
  v: number;
  N: number;
}
export interface CircleResult {
  ok: boolean;
  errors: string[];
  mass: number;
  /** Вес mg. */
  P: number;
  /** Направление движения: +1 — рост φ, −1 — убывание, 0 — точка покоится (равновесие). */
  dir: number;
  /** v₀ = 0 в положении неустойчивого равновесия: движение — после ничтожно малого толчка в сторону роста φ. */
  push: boolean;
  /** Касательная сила в начальный момент (если v₀ = 0 — по ней выбирается направление). */
  Ft0: number;
  N0: number;
  /** Событие по ходу движения и, если точка остановилась, — после поворота назад. */
  fwd: CircleEvent | null;
  back: CircleEvent | null;
  /** Двусторонняя связь: первое по ходу движения положение, где реакция меняет знак (N = 0). */
  zero: { phi: number; v: number } | null;
  at: { phi: number; v: number; N: number; reached: boolean; onReturn: boolean } | null;
  full: { possible: boolean; v0min: number | null; h: number | null } | null;
  /**
   * N(φ) на обороте вокруг начального положения (φ₀ − 180° … φ₀ + 180°) — там, куда точка доходит по энергии (v² ≥ 0,
   * связный участок с φ₀); holds = false — связь там уже не удерживает (после отрыва формула неприменима).
   */
  curve: { phi: number; N: number; holds: boolean }[];
}

const rad = (a: number) => (a * Math.PI) / 180;
const STEP = 0.05; // шаг обхода, °

/** Допустима ли реакция для односторонней связи. */
export const holds = (link: CircleLink, N: number) => (link === 'rod' ? true : link === 'outer' ? N <= 0 : N >= 0);

export function circleModel(pr: CircleProblem) {
  const mass = pr.byWeight ? pr.m / pr.g : pr.m;
  const P = mass * pr.g;
  const pos = (phi: number): [number, number] => [pr.R * Math.sin(rad(phi)), -pr.R * Math.cos(rad(phi))];
  const spring = (phi: number): { F: [number, number]; E: number } => {
    if (!pr.spring || !pr.c) return { F: [0, 0], E: 0 };
    const [x, y] = pos(phi);
    const dx = x - pr.ax,
      dy = y - pr.ay;
    const L = Math.hypot(dx, dy);
    if (L < 1e-15) return pr.L0 === 0 ? { F: [0, 0], E: 0 } : { F: [NaN, NaN], E: (pr.c * pr.L0 * pr.L0) / 2 };
    const k = (-pr.c * (L - pr.L0)) / L;
    return { F: [k * dx, k * dy], E: (pr.c * (L - pr.L0) ** 2) / 2 };
  };
  const y = (phi: number) => pr.R * (1 - Math.cos(rad(phi)));
  const E0 = spring(pr.phi0).E;
  const v2 = (phi: number, v0 = pr.v0) => v0 * v0 - 2 * pr.g * (y(phi) - y(pr.phi0)) - (2 / mass) * (spring(phi).E - E0);
  const N = (phi: number, vv2: number) => {
    const F = spring(phi).F;
    const n: [number, number] = [-Math.sin(rad(phi)), Math.cos(rad(phi))];
    return (mass * vv2) / pr.R + mass * pr.g * Math.cos(rad(phi)) - (F[0] * n[0] + F[1] * n[1]);
  };
  /** Касательная сила (в сторону роста φ). */
  const Ft = (phi: number) => {
    const F = spring(phi).F;
    const t: [number, number] = [Math.cos(rad(phi)), Math.sin(rad(phi))];
    return -mass * pr.g * Math.sin(rad(phi)) + F[0] * t[0] + F[1] * t[1];
  };
  return { mass, P, pos, spring, y, v2, N, Ft };
}

/** Допуск для v² = 0 (масштаб — кинетическая и потенциальная энергия на единицу массы). */
function v2tol(pr: CircleProblem, md: ReturnType<typeof circleModel>, v0: number): number {
  const sp = pr.spring && pr.c ? (pr.c * (pr.R + Math.hypot(pr.ax, pr.ay) + pr.L0) ** 2) / md.mass : 0;
  return 1e-12 * (v0 * v0 + pr.g * pr.R + sp);
}

/**
 * Обход окружности от φ₀ в направлении dir до первого события (не больше оборота). При v₀ = 0 (толчок из неустойчивого
 * равновесия) скорость снова обращается в нуль лишь в исходном положении, через оборот, — точка приближается к нему
 * асимптотически: событие «остановка» при φ₀ ± 360°.
 */
function walk(pr: CircleProblem, md: ReturnType<typeof circleModel>, dir: number, v0: number): CircleEvent {
  const tol = v2tol(pr, md, v0);
  const bad = (phi: number) => {
    const w = md.v2(phi, v0);
    return w < -tol || !holds(pr.link, md.N(phi, Math.max(w, 0)));
  };
  const n = Math.round(360 / STEP);
  let prev = pr.phi0;
  for (let i = 1; i <= n; i++) {
    const phi = pr.phi0 + dir * i * STEP;
    if (bad(phi) || (i === 1 && bad(pr.phi0))) {
      // Начальное положение уже недопустимо (например, купол при большой скорости) — событие в φ₀.
      let lo = prev,
        hi = phi;
      if (bad(pr.phi0)) hi = lo = pr.phi0;
      for (let it = 0; it < 80 && lo !== hi; it++) {
        const m = (lo + hi) / 2;
        if (bad(m)) hi = m;
        else lo = m;
      }
      const at = (lo + hi) / 2;
      const w = md.v2(at, v0);
      const Nn = md.N(at, Math.max(w, 0));
      // Что наступило: связь перестала удерживать при v² ≥ 0 — отрыв, иначе — остановка.
      const kind: CircleEvent['kind'] = !holds(pr.link, md.N(hi, Math.max(md.v2(hi, v0), 0))) && md.v2(hi, v0) >= -tol ? 'detach' : 'stop';
      return { kind, phi: at, v: Math.sqrt(Math.max(w, 0)), N: Nn };
    }
    prev = phi;
  }
  if (v0 === 0) return { kind: 'stop', phi: pr.phi0 + dir * 360, v: 0, N: md.N(pr.phi0, 0) };
  return { kind: 'round', phi: pr.phi0 + dir * 360, v: Math.abs(v0), N: md.N(pr.phi0, v0 * v0) };
}

/** Первое по ходу движения (на дуге span, °) положение, где N меняет знак. */
function zeroN(pr: CircleProblem, md: ReturnType<typeof circleModel>, dir: number, span: number): { phi: number; v: number } | null {
  const N = (phi: number) => md.N(phi, Math.max(md.v2(phi), 0));
  const n = Math.floor(span / STEP + 1e-9);
  let a = pr.phi0,
    Na = N(a);
  for (let i = 1; i <= n + 1; i++) {
    const b = i <= n ? pr.phi0 + dir * i * STEP : pr.phi0 + dir * span;
    const Nb = N(b);
    if (Na === 0 && i === 1) {
      a = b;
      Na = Nb;
      continue;
    }
    if (Na * Nb <= 0 && Nb !== Na) {
      let lo = a,
        hi = b;
      for (let it = 0; it < 80; it++) {
        const m = (lo + hi) / 2;
        if (N(m) * Na > 0) lo = m;
        else hi = m;
      }
      const phi = (lo + hi) / 2;
      return { phi, v: Math.sqrt(Math.max(md.v2(phi), 0)) };
    }
    a = b;
    Na = Nb;
  }
  return null;
}

export function solveCircle(pr: CircleProblem): CircleResult {
  const errors: string[] = [];
  if (!(pr.m > 0)) errors.push('Масса (вес) точки — положительное число.');
  if (!(pr.g > 0)) errors.push('Ускорение свободного падения g — положительное число.');
  if (!(pr.R > 0)) errors.push('Радиус окружности — положительное число.');
  if (pr.spring && (pr.c < 0 || pr.L0 < 0)) errors.push('Жёсткость пружины и её длина без натяжения не могут быть отрицательными.');
  const empty: CircleResult = {
    ok: false,
    errors,
    mass: 0,
    P: 0,
    dir: 0,
    push: false,
    Ft0: 0,
    N0: 0,
    fwd: null,
    back: null,
    zero: null,
    at: null,
    full: null,
    curve: [],
  };
  if (errors.length) return empty;
  const md = circleModel(pr);
  const N0 = md.N(pr.phi0, pr.v0 * pr.v0);
  const Ft0 = md.Ft(pr.phi0);
  if (!Number.isFinite(N0) || !Number.isFinite(Ft0))
    return { ...empty, errors: ['Пружина закреплена в самой точке и имеет ненулевую длину — направление её силы не определено.'] };
  const scale = Math.max(1e-300, md.P, Math.abs(N0));
  let dir = Math.abs(pr.v0) > 1e-12 ? Math.sign(pr.v0) : Math.abs(Ft0) > 1e-12 * scale ? Math.sign(Ft0) : 0;
  // Равновесие при v₀ = 0: неустойчивое, если касательная сила при отклонении направлена в сторону отклонения.
  const d = 1e-3;
  const push = dir === 0 && pr.v0 === 0 && md.Ft(pr.phi0 + d) - md.Ft(pr.phi0 - d) > 1e-9 * scale;
  if (push) dir = 1;
  let fwd: CircleEvent | null = null,
    back: CircleEvent | null = null;
  if (dir !== 0) {
    fwd = walk(pr, md, dir, push ? 0 : pr.v0);
    // Остановилась (и связь держит) — движется обратно до своего события.
    const span = Math.abs(fwd.phi - pr.phi0);
    if (fwd.kind === 'stop' && span > 1e-9 && span < 360 - 1e-9) back = walk(pr, md, -dir, pr.v0);
  }
  const zero = pr.link === 'rod' && fwd ? zeroN(pr, md, dir, fwd.kind === 'round' ? 360 : Math.abs(fwd.phi - pr.phi0)) : null;
  let at: CircleResult['at'] = null;
  if (pr.ask === 'at') {
    const along = (d: number) => ((((pr.phi1 - pr.phi0) * d) % 360) + 360) % 360;
    const w = md.v2(pr.phi1);
    const res = (reached: boolean, onReturn: boolean) => ({ phi: pr.phi1, v: Math.sqrt(Math.max(w, 0)), N: md.N(pr.phi1, Math.max(w, 0)), reached, onReturn });
    if (dir === 0) at = res(Math.abs(along(1)) < 1e-9, false);
    else {
      const df = along(dir);
      const ef = fwd!.kind === 'round' ? Infinity : Math.abs(fwd!.phi - pr.phi0);
      if (df <= ef + 1e-9) at = res(true, false);
      else if (back) {
        const db = along(-dir);
        at = res(db <= (back.kind === 'round' ? Infinity : Math.abs(back.phi - pr.phi0)) + 1e-9, true);
      } else at = res(false, false);
    }
  }
  let full: CircleResult['full'] = null;
  if (pr.ask === 'full') {
    const d = dir || 1;
    const rounds = (v: number) => walk(pr, md, d, d * v).kind === 'round';
    if (pr.link === 'outer') full = { possible: false, v0min: null, h: null };
    else {
      let lo = 0,
        hi = Math.max(1, Math.sqrt((md.P / md.mass) * pr.R));
      while (!rounds(hi) && hi < 1e6) hi *= 2;
      if (!rounds(hi)) full = { possible: false, v0min: null, h: null };
      else {
        for (let it = 0; it < 80; it++) {
          const m = (lo + hi) / 2;
          if (rounds(m)) hi = m;
          else lo = m;
        }
        // Высота, с которой точка без начальной скорости приобретает эту скорость в φ₀ (над нижней точкой).
        full = { possible: true, v0min: hi, h: pr.spring ? null : md.y(pr.phi0) + (hi * hi) / (2 * pr.g) };
      }
    }
  }
  const curve: CircleResult['curve'] = [];
  // От φ₀ в обе стороны, пока v² ≥ 0.
  const side = (d: number) => {
    const out: CircleResult['curve'] = [];
    for (let k = 1; k <= 180; k++) {
      const a = pr.phi0 + d * k;
      const w = md.v2(a);
      if (w < 0) break;
      const Nn = md.N(a, w);
      out.push({ phi: a, N: Nn, holds: holds(pr.link, Nn) });
    }
    return out;
  };
  curve.push(...side(-1).reverse(), { phi: pr.phi0, N: N0, holds: holds(pr.link, N0) }, ...side(1));
  return { ok: true, errors: [], mass: md.mass, P: md.P, dir, push, Ft0, N0, fwd, back, zero, at, full, curve };
}
