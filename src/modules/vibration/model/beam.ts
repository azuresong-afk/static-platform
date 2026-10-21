/**
 * Балка с грузами: коэффициенты влияния δᵢⱼ (Мещерский 54.29–54.33, 54.46).
 *
 * Невесомая балка постоянной жёсткости EJ длиной L на шарнирных опорах и заделках (в том числе статически
 * неопределимая: неразрезная, с заделкой и опорой). Груз — масса m, прикреплённая к оси балки в точке x; если у груза
 * есть момент инерции J относительно своего центра масс или центр масс смещён вдоль оси на e (пластинка на конце
 * консоли, 54.33), у груза две координаты: прогиб y и поворот сечения θ. Груз может стоять на вершине невесомой стойки
 * высотой h, жёстко связанной с балкой (той же жёсткости EJ, нерастяжимой; 54.36): координаты — горизонтальное смещение
 * груза x и прогиб балки в узле y; стойка — консоль, заделанная в поворачивающееся сечение балки.
 *
 * δᵢⱼ — перемещение по координате i от единичной силы (момента) по координате j. Перемещения от силы находятся
 * методом перемещений: стержневые элементы с кубическими функциями формы между опорами и грузами; для сосредоточенных
 * сил и моментов в узлах это решение точное (совпадает с интегралом Мора). Форма главного колебания — упругая линия
 * от сил инерции k²·A·v: в узлах она совпадает с формой v, между узлами — кубическая.
 */
import { cholesky, zeros, type Mat } from './linalg';

export type SupportKind = 'pin' | 'fixed';
export interface BeamSupport {
  x: number;
  kind: SupportKind;
}
export interface BeamMass {
  x: number;
  m: number;
  /** Момент инерции относительно центра масс (ось перпендикулярна плоскости изгиба). */
  J: number;
  /** Смещение центра масс вдоль оси балки от точки крепления. */
  e: number;
  /** Амплитуда возмущающей силы (поперёк оси). */
  H: number;
  /** Высота стойки, на вершине которой стоит груз (0 — груз на оси балки). */
  h?: number;
}
export interface BeamSys {
  L: number;
  EJ: number;
  supports: BeamSupport[];
  masses: BeamMass[];
}

/** Координата груза: прогиб или поворот в узле. */
export interface BeamDof {
  mass: number;
  /** y — прогиб, th — поворот сечения, u — горизонтальное смещение груза на стойке. */
  kind: 'y' | 'th' | 'u';
  /** Индекс в векторе узловых перемещений балки. */
  g: number;
}
export interface BeamModel {
  ok: true;
  xs: number[];
  dofs: BeamDof[];
  /** Матрица податливости (коэффициенты влияния) по координатам грузов. */
  delta: Mat;
  /** Матрица инерции по координатам грузов. */
  A: Mat;
  /** Перемещения всех узлов от сил по координатам грузов (для упругой линии). */
  deflect: (F: number[]) => number[];
}
export type BeamOut = BeamModel | { ok: false; error: string };

/** Перемещения узлов балки (y, θ по узлам) от узловых сил: метод перемещений. */
export function beamModel(s: BeamSys): BeamOut {
  const L = s.L,
    EJ = s.EJ;
  if (!(L > 0) || !(EJ > 0)) return { ok: false, error: 'Длина балки и жёсткость EJ — положительные.' };
  if (!s.masses.length) return { ok: false, error: 'Нужен хотя бы один груз.' };
  const inside = (x: number) => x >= -1e-12 * L && x <= L * (1 + 1e-12);
  if (![...s.supports.map((p) => p.x), ...s.masses.map((m) => m.x)].every(inside)) return { ok: false, error: `Опоры и грузы — на балке: 0 ≤ x ≤ ${L}.` };
  if (s.masses.some((m) => !(m.m > 0) || m.J < 0)) return { ok: false, error: 'Масса груза положительна, момент инерции — неотрицателен.' };
  if (s.masses.some((m) => (m.h ?? 0) < 0)) return { ok: false, error: 'Высота стойки — неотрицательная.' };
  if (s.masses.some((m) => (m.h ?? 0) > 0 && (m.J > 0 || m.e !== 0)))
    return { ok: false, error: 'Груз на стойке — точечный: без момента инерции и смещения центра масс.' };
  const tol = 1e-9 * L;
  const xs: number[] = [];
  for (const x of [0, L, ...s.supports.map((p) => p.x), ...s.masses.map((m) => m.x)].map((x) => Math.min(L, Math.max(0, x))))
    if (!xs.some((y) => Math.abs(y - x) <= tol)) xs.push(x);
  xs.sort((a, b) => a - b);
  const node = (x: number) => xs.findIndex((y) => Math.abs(y - x) <= tol);
  // Стойки: у вершины — горизонтальное смещение u и угол ψ = du/ds (s — вверх по стойке).
  const cols = s.masses.map((m, i) => ({ i, h: m.h ?? 0 })).filter((c) => c.h > 0);
  const nb = 2 * xs.length;
  const nd = nb + 2 * cols.length;
  const K = zeros(nd);
  for (let e = 0; e + 1 < xs.length; e++) {
    const l = xs[e + 1] - xs[e],
      k = EJ / l ** 3;
    const ke = [
      [12, 6 * l, -12, 6 * l],
      [6 * l, 4 * l * l, -6 * l, 2 * l * l],
      [-12, -6 * l, 12, -6 * l],
      [6 * l, 2 * l * l, -6 * l, 4 * l * l],
    ];
    const g = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) K[g[i]][g[j]] += k * ke[i][j];
  }
  // Стойка — элемент длины h: внизу u = 0 (балка нерастяжима), ψ = −θ узла (поворот против часовой стрелки сдвигает
  // вершину влево), вверху u и ψ.
  cols.forEach((c, k) => {
    const l = c.h,
      kk = EJ / l ** 3;
    const ke = [
      [4 * l * l, -6 * l, 2 * l * l],
      [-6 * l, 12, -6 * l],
      [2 * l * l, -6 * l, 4 * l * l],
    ];
    const g = [2 * node(s.masses[c.i].x) + 1, nb + 2 * k, nb + 2 * k + 1],
      sg = [-1, 1, 1];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) K[g[i]][g[j]] += kk * ke[i][j] * sg[i] * sg[j];
  });
  const fixedDof = new Set<number>();
  for (const p of s.supports) {
    const n = node(p.x);
    fixedDof.add(2 * n);
    if (p.kind === 'fixed') fixedDof.add(2 * n + 1);
  }
  const dofs: BeamDof[] = [];
  for (const [i, m] of s.masses.entries()) {
    const n = node(m.x);
    const col = cols.findIndex((c) => c.i === i);
    if (col >= 0) {
      dofs.push({ mass: i, kind: 'u', g: nb + 2 * col });
      if (!fixedDof.has(2 * n)) {
        if (dofs.some((d) => d.g === 2 * n)) return { ok: false, error: `Два груза в одной точке x = ${m.x} — объедините их.` };
        dofs.push({ mass: i, kind: 'y', g: 2 * n });
      }
      continue;
    }
    if (fixedDof.has(2 * n)) return { ok: false, error: `Груз №${i + 1} стоит над опорой — он не колеблется поперёк балки.` };
    if (dofs.some((d) => d.g === 2 * n)) return { ok: false, error: `Два груза в одной точке x = ${m.x} — объедините их.` };
    dofs.push({ mass: i, kind: 'y', g: 2 * n });
    if (m.J > 0 || m.e !== 0) {
      if (fixedDof.has(2 * n + 1)) return { ok: false, error: `Груз №${i + 1} в заделке не поворачивается.` };
      dofs.push({ mass: i, kind: 'th', g: 2 * n + 1 });
    }
  }
  const free = Array.from({ length: nd }, (_, i) => i).filter((i) => !fixedDof.has(i));
  const Kff = free.map((i) => free.map((j) => K[i][j]));
  const C = cholesky(Kff);
  if (!C) return { ok: false, error: 'Балка геометрически изменяема (может двигаться как механизм) — добавьте опоры или заделку.' };
  const solveFree = (f: number[]) => {
    const y = f.slice();
    for (let i = 0; i < y.length; i++) {
      for (let k = 0; k < i; k++) y[i] -= C[i][k] * y[k];
      y[i] /= C[i][i];
    }
    for (let i = y.length - 1; i >= 0; i--) {
      for (let k = i + 1; k < y.length; k++) y[i] -= C[k][i] * y[k];
      y[i] /= C[i][i];
    }
    return y;
  };
  const deflect = (F: number[]): number[] => {
    const f = new Array(nd).fill(0);
    dofs.forEach((d, i) => (f[d.g] += F[i]));
    const u = solveFree(free.map((i) => f[i]));
    const out = new Array(nd).fill(0);
    free.forEach((g, i) => (out[g] = u[i]));
    return out;
  };
  const n = dofs.length;
  const delta = zeros(n);
  for (let j = 0; j < n; j++) {
    const u = deflect(dofs.map((_, i) => (i === j ? 1 : 0)));
    for (let i = 0; i < n; i++) delta[i][j] = u[dofs[i].g];
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) delta[i][j] = delta[j][i] = (delta[i][j] + delta[j][i]) / 2;
  // Инерция груза с координатами (y, θ): центр масс смещается на y + e·θ, поворот θ.
  const A = zeros(n);
  dofs.forEach((d, i) => {
    const m = s.masses[d.mass];
    if (d.kind === 'y' || d.kind === 'u') A[i][i] = m.m;
    else {
      A[i][i] = m.m * m.e * m.e + m.J;
      A[i][i - 1] = A[i - 1][i] = m.m * m.e;
    }
  });
  return { ok: true, xs, dofs, delta, A, deflect };
}

/** Упругая линия по узловым перемещениям: точки (x, y) с кубической интерполяцией между узлами. */
export function elasticLine(xs: number[], u: number[], per = 24): [number, number][] {
  const pts: [number, number][] = [];
  for (let e = 0; e + 1 < xs.length; e++) {
    const l = xs[e + 1] - xs[e];
    const [y1, t1, y2, t2] = [u[2 * e], u[2 * e + 1], u[2 * e + 2], u[2 * e + 3]];
    for (let k = e ? 1 : 0; k <= per; k++) {
      const s = k / per;
      const h1 = 1 - 3 * s * s + 2 * s ** 3,
        h2 = l * (s - 2 * s * s + s ** 3),
        h3 = 3 * s * s - 2 * s ** 3,
        h4 = l * (s ** 3 - s * s);
      pts.push([xs[e] + s * l, h1 * y1 + h2 * t1 + h3 * y2 + h4 * t2]);
    }
  }
  return pts;
}
