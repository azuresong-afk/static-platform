/**
 * Составные задачи динамики точки — движение из нескольких этапов (Мещерский 31.4, 31.11–31.13, 31.17).
 *
 * На каждом этапе — свои силы и свой метод: по связи — теорема об изменении кинетической энергии и нормальная
 * проекция (давление, отрыв), после отрыва — свободный полёт по параболе, на пружине — гармоническое колебание.
 * Конечное состояние одного этапа — начальное для следующего. Вопросы:
 *  - loop  — петля радиуса r с разрывом DC (∠BOD = ∠BOC = α от верхней точки B): на участке DC — парабола;
 *            v_D² = gr/cos α (полёт от D до C), h = r(1 + cos α + 1/(2cos α)), наименьшая h = r(1 + √2) при α = 45°;
 *  - jump  — трамплин: спуск по эстакаде высотой h под углом α с трением f — v_C² = 2gh(1 − f ctg α), толчок vᵧ
 *            вверх, полёт до линии приземления под углом β: t = 2(vᵧ + v_C tg β)/g, дальность l = v_C t/cos β;
 *  - plate — груз падает с высоты H на плиту с пружиной и сжимает её на h: жёсткость c = 2P(H + h)/h², k = √(c/m),
 *            время сжатия T = (π/2 + ψ)/k, tg ψ = h/(2√(H(H + h))), импульс пружины S = P(T + √(2H/g));
 *  - fly   — осколок маховика: наибольшая дальность на том же уровне s = v²/g (вылет под 45°), ω = v/R;
 *  - slack — маятник на нити: где натяжение обращается в нуль (как в режиме «движение по окружности»), затем
 *            парабола до нового натяжения нити (|OM| = l).
 */
import { solveCircle } from './circle';

export type StageAsk = 'loop' | 'jump' | 'plate' | 'fly' | 'slack';
export interface StageProblem {
  byWeight: boolean;
  m: number;
  g: number;
  ask: StageAsk;
  /** Радиус петли (loop), маховика (fly), длина нити (slack). */
  r: number;
  /** Угол разрыва петли, наклон эстакады, °. */
  alpha: number;
  /** Высота пуска для проверки петли (0 — не проверять), высота эстакады, сжатие пружины. */
  h: number;
  f: number;
  vy: number;
  beta: number;
  H: number;
  s: number;
  /** Маятник: начальный угол от нижней точки (°), скорость («+» — в сторону роста угла). */
  phi0: number;
  v0: number;
}

export interface StageLoop {
  hNeed: number;
  vD: number;
  tFly: number;
  apex: number;
  hMin: number;
  /** Проверка заданной высоты: скорость в D и дальность полёта (нужна 2r sin α). */
  check: { vD: number; range: number; gap: number; ok: boolean } | null;
}
export interface StageJump {
  vC: number;
  t: number;
  x: number;
  y: number;
  l: number;
  vLand: number;
}
export interface StagePlate {
  c: number;
  k: number;
  v: number;
  delta: number;
  psi: number;
  T: number;
  S: number;
  Fmax: number;
}
export interface StageSlack {
  phi: number;
  v: number;
  M: [number, number];
  V: [number, number];
  /** Высота точки M над центром O. */
  hM: number;
  /** Парабола в осях с началом в M: y = x·tg θ − x²·q. */
  tanT: number;
  q: number;
  t: number;
  end: [number, number];
  path: [number, number][];
}
export interface StageResult {
  ok: boolean;
  errors: string[];
  mass: number;
  P: number;
  loop?: StageLoop;
  jump?: StageJump;
  plate?: StagePlate;
  fly?: { v: number; omega: number; rpm: number };
  slack?: StageSlack;
}

const D = Math.PI / 180;

export function solveStages(p: StageProblem): StageResult {
  const errors: string[] = [];
  const nums = [p.m, p.g, p.r, p.alpha, p.h, p.f, p.vy, p.beta, p.H, p.s, p.phi0, p.v0];
  if (!nums.every(Number.isFinite)) errors.push('Все данные — числа.');
  if (!(p.g > 0)) errors.push('g — положительное число.');
  if (!(p.m > 0)) errors.push(p.byWeight ? 'Вес P — положительное число.' : 'Масса m — положительное число.');
  const mass = p.byWeight ? p.m / p.g : p.m;
  const P = mass * p.g;
  const base: StageResult = { ok: false, errors, mass, P };
  if (errors.length) return base;
  const bad = (e: string): StageResult => ({ ...base, errors: [e] });
  const g = p.g;

  if (p.ask === 'loop') {
    if (!(p.r > 0)) return bad('Радиус петли r — положительное число.');
    if (!(p.alpha > 0 && p.alpha < 90)) return bad('Угол разрыва α — от 0 до 90°.');
    const ca = Math.cos(p.alpha * D),
      sa = Math.sin(p.alpha * D);
    const v2 = (g * p.r) / ca;
    const vD = Math.sqrt(v2);
    let check: StageLoop['check'] = null;
    if (p.h > 0) {
      const w2 = 2 * g * (p.h - p.r * (1 + ca));
      const range = w2 > 0 ? (w2 * 2 * sa * ca) / g : 0;
      check = { vD: Math.sqrt(Math.max(w2, 0)), range, gap: 2 * p.r * sa, ok: w2 > 0 && Math.abs(range - 2 * p.r * sa) <= 1e-9 * p.r };
    }
    return {
      ...base,
      ok: true,
      loop: { hNeed: p.r * (1 + ca + 1 / (2 * ca)), vD, tFly: (2 * vD * sa) / g, apex: (v2 * sa * sa) / (2 * g), hMin: p.r * (1 + Math.SQRT2), check },
    };
  }

  if (p.ask === 'jump') {
    if (!(p.alpha > 0 && p.alpha < 90)) return bad('Наклон эстакады α — от 0 до 90°.');
    if (!(p.h > 0)) return bad('Высота эстакады h — положительное число.');
    if (!(p.f >= 0)) return bad('Коэффициент трения f — неотрицательное число.');
    if (!(p.beta >= 0 && p.beta < 90)) return bad('Наклон линии приземления β — от 0 до 90°.');
    const w2 = 2 * g * p.h * (1 - p.f / Math.tan(p.alpha * D));
    if (!(w2 > 0)) return bad('С трением f ≥ tg α лыжник не скатывается.');
    const vC = Math.sqrt(w2);
    const tb = Math.tan(p.beta * D);
    const t = (2 * (p.vy + vC * tb)) / g;
    if (!(t > 0)) return bad('Лыжник не долетает до линии приземления.');
    const x = vC * t,
      y = p.vy * t - (g * t * t) / 2;
    return { ...base, ok: true, jump: { vC, t, x, y, l: Math.hypot(x, y), vLand: Math.hypot(vC, p.vy - g * t) } };
  }

  if (p.ask === 'plate') {
    if (!(p.H >= 0 && p.h > 0)) return bad('Высота падения H ≥ 0, сжатие пружины h > 0.');
    const c = (2 * P * (p.H + p.h)) / (p.h * p.h);
    const k = Math.sqrt(c / mass);
    const v = Math.sqrt(2 * g * p.H);
    const psi = Math.atan(p.h / (2 * Math.sqrt(p.H * (p.H + p.h))));
    const T = (Math.PI / 2 + psi) / k;
    return { ...base, ok: true, plate: { c, k, v, delta: P / c, psi: psi / D, T, S: P * T + mass * v, Fmax: c * p.h } };
  }

  if (p.ask === 'fly') {
    if (!(p.s > 0 && p.r > 0)) return bad('Дальность s и радиус маховика R — положительные числа.');
    const v = Math.sqrt(g * p.s);
    const w = v / p.r;
    return { ...base, ok: true, fly: { v, omega: w, rpm: (w * 30) / Math.PI } };
  }

  if (!(p.r > 0)) return bad('Длина нити l — положительное число.');
  const cr = solveCircle({
    byWeight: p.byWeight,
    m: p.m,
    g,
    R: p.r,
    link: 'thread',
    phi0: p.phi0,
    v0: p.v0,
    spring: false,
    ax: 0,
    ay: 0,
    c: 0,
    L0: 0,
    ask: 'detach',
    phi1: 0,
  });
  if (!cr.ok) return bad(cr.errors[0] ?? 'Проверьте данные маятника.');
  const ev = cr.fwd;
  if (!ev || ev.kind !== 'detach') return bad('Нить не ослабевает: груз качается (или проходит всю окружность) с натянутой нитью.');
  const f = ev.phi * D;
  const M: [number, number] = [p.r * Math.sin(f), -p.r * Math.cos(f)];
  const V: [number, number] = [cr.dir * ev.v * Math.cos(f), cr.dir * ev.v * Math.sin(f)];
  const at = (t: number): [number, number] => [M[0] + V[0] * t, M[1] + V[1] * t - (g * t * t) / 2];
  const d2 = (t: number) => {
    const q = at(t);
    return q[0] * q[0] + q[1] * q[1] - p.r * p.r;
  };
  // Внутри круга |OM| < l; ищем первый возврат на окружность.
  const Tmax = (2 * (Math.abs(V[1]) + Math.sqrt(V[1] * V[1] + 4 * g * p.r))) / g + 1;
  const n = 20000;
  let t0 = 1e-9 * Tmax,
    tEnd = NaN;
  for (let i = 1; i <= n; i++) {
    const t1 = (Tmax * i) / n;
    if (d2(t0) < 0 && d2(t1) >= 0) {
      let lo = t0,
        hi = t1;
      for (let j = 0; j < 80; j++) {
        const mid = (lo + hi) / 2;
        if (d2(mid) < 0) lo = mid;
        else hi = mid;
      }
      tEnd = (lo + hi) / 2;
      break;
    }
    t0 = t1;
  }
  if (!Number.isFinite(tEnd)) return bad('Нить не натягивается снова.');
  const path: [number, number][] = [];
  for (let i = 0; i <= 120; i++) path.push(at((tEnd * i) / 120));
  const vh = V[0];
  const tanT = V[1] / vh;
  return {
    ...base,
    ok: true,
    slack: {
      phi: ev.phi,
      v: ev.v,
      M,
      V,
      hM: M[1],
      tanT: vh !== 0 ? Math.abs(tanT) : Infinity,
      q: vh !== 0 ? g / (2 * vh * vh) : Infinity,
      t: tEnd,
      end: at(tEnd),
      path,
    },
  };
}
