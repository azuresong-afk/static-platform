/** Геометрия масс: ответы Мещерского §34, формулы тел и независимая проверка суммированием по сетке. */
import { describe, expect, it } from 'vitest';
import { centralTensor, solveInertia, unit, type IPart, type IProblem, type M3, type V3 } from '../src/modules/inertia/model/inertia';
import { INERTIA_PRESETS, type InertiaPresetKey } from '../src/modules/inertia/presets';
import { renderInertia } from '../src/modules/inertia/draw/inertia';
import { inertiaDoc } from '../src/modules/inertia/text/solution';
import { InertiaStore, parseInertia } from '../src/modules/inertia/ui/store';

/** Допуск: две единицы последнего напечатанного знака; для значений по формуле — 1e-9. */
const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};

describe('Мещерский §34', () => {
  for (const [key, p] of Object.entries(INERTIA_PRESETS).filter(([, x]) => 'book' in x))
    it(p.title, () => {
      const r = solveInertia(p.problem as IProblem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const got: Record<string, number> = { J: r.J, rho: r.rho!, Jx: r.Jxyz[0], Jy: r.Jxyz[1], Jz: r.Jxyz[2], Jxy: r.Jprod[0], Jyz: r.Jprod[1], Jzx: r.Jprod[2] };
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(tol(book));
    });
  it('мутация: без слагаемого Штейнера 34.21 не сходится', () => {
    const pr = structuredClone(INERTIA_PRESETS.m3421.problem) as IProblem;
    pr.A = pr.parts[0].c;
    expect(Math.abs(solveInertia(pr).J - INERTIA_PRESETS.m3421.book.J)).toBeGreaterThan(0.01);
  });
  it('34.26: главные моменты эксцентричного диска в O — J_x, J_y, J_z', () => {
    const r = solveInertia(INERTIA_PRESETS.m3427.problem as IProblem);
    const b = INERTIA_PRESETS.m3427.book;
    const want = [b.Jx, b.Jy, b.Jz].sort((a, c) => a - c);
    r.principal.vals.forEach((v, i) => expect(v).toBeCloseTo(want[i], 12));
  });
  it('центральный момент системы: J = J_C + M d² (теорема Штейнера для всей системы)', () => {
    const r = solveInertia(INERTIA_PRESETS.m3421.problem as IProblem);
    const d = Math.hypot(r.C![0] - 0, r.C![1] + 0.1);
    expect(r.J).toBeCloseTo(r.Jc! + r.M * d * d, 12);
  });
});

/** Точки тела в локальных осях (ось симметрии — z, центр масс в начале) и их доли массы. */
function samples(q: IPart): { pts: V3[]; w: number[] } {
  const pts: V3[] = [],
    w: number[] = [];
  const N = 60,
    p = q.p;
  const add = (x: V3, wt: number) => (pts.push(x), w.push(wt));
  switch (q.kind) {
    case 'rod':
      for (let i = 0; i < 2000; i++) add([0, 0, -p.l / 2 + (p.l * (i + 0.5)) / 2000], 1);
      break;
    case 'ring':
      for (let i = 0; i < 2000; i++) add([p.R * Math.cos((2 * Math.PI * i) / 2000), p.R * Math.sin((2 * Math.PI * i) / 2000), 0], 1);
      break;
    case 'disk':
    case 'tube':
    case 'cone': {
      const r0 = q.kind === 'tube' ? p.r : 0;
      for (let k = 0; k < N; k++) {
        const z = -p.h / 2 + (p.h * (k + 0.5)) / N;
        const zc = q.kind === 'cone' ? -p.h / 4 + (p.h * (k + 0.5)) / N : z;
        const Rz = q.kind === 'cone' ? p.R * (1 - (p.h * (k + 0.5)) / N / p.h) : p.R;
        for (let i = 0; i < N; i++) {
          const rr = r0 + ((Rz - r0) * (i + 0.5)) / N;
          for (let j = 0; j < 4 * N; j++) {
            const t = (2 * Math.PI * j) / (4 * N);
            add([rr * Math.cos(t), rr * Math.sin(t), zc], rr * (Rz - r0));
          }
        }
      }
      break;
    }
    case 'sphere':
    case 'hball':
    case 'shell': {
      const r0 = q.kind === 'hball' ? p.r : q.kind === 'shell' ? p.R : 0;
      const nr = q.kind === 'shell' ? 1 : N;
      for (let i = 0; i < nr; i++) {
        const rr = q.kind === 'shell' ? p.R : r0 + ((p.R - r0) * (i + 0.5)) / N;
        for (let k = 0; k < N; k++) {
          const th = (Math.PI * (k + 0.5)) / N;
          for (let j = 0; j < 2 * N; j++) {
            const f = (2 * Math.PI * j) / (2 * N);
            add([rr * Math.sin(th) * Math.cos(f), rr * Math.sin(th) * Math.sin(f), rr * Math.cos(th)], rr * rr * Math.sin(th));
          }
        }
      }
      break;
    }
    case 'box':
      for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) for (let k = 0; k < 30; k++) add([p.a * ((i + 0.5) / 30 - 0.5), p.b * ((j + 0.5) / 30 - 0.5), p.c * ((k + 0.5) / 30 - 0.5)], 1);
      break;
  }
  return { pts, w };
}
function frame(u: V3): [V3, V3, V3] {
  const e3 = unit(u);
  const t: V3 = Math.abs(e3[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = unit([t[1] * e3[2] - t[2] * e3[1], t[2] * e3[0] - t[0] * e3[2], t[0] * e3[1] - t[1] * e3[0]]);
  const e2: V3 = [e3[1] * e1[2] - e3[2] * e1[1], e3[2] * e1[0] - e3[0] * e1[2], e3[0] * e1[1] - e3[1] * e1[0]];
  return [e1, e2, e3];
}

describe('формулы тел против суммирования по сетке', () => {
  const u: V3 = [0.3, -0.5, 0.8];
  const cases: IPart[] = [
    { kind: 'rod', m: 2, c: [0, 0, 0], u, p: { l: 1.3 }, s: 1 },
    { kind: 'ring', m: 2, c: [0, 0, 0], u, p: { R: 0.7 }, s: 1 },
    { kind: 'disk', m: 2, c: [0, 0, 0], u, p: { R: 0.5, h: 0.9 }, s: 1 },
    { kind: 'tube', m: 2, c: [0, 0, 0], u, p: { R: 0.5, r: 0.3, h: 0.4 }, s: 1 },
    { kind: 'cone', m: 2, c: [0, 0, 0], u, p: { R: 0.5, h: 1.2 }, s: 1 },
    { kind: 'sphere', m: 2, c: [0, 0, 0], u, p: { R: 0.5 }, s: 1 },
    { kind: 'hball', m: 2, c: [0, 0, 0], u, p: { R: 0.5, r: 0.35 }, s: 1 },
    { kind: 'shell', m: 2, c: [0, 0, 0], u, p: { R: 0.5 }, s: 1 },
    { kind: 'box', m: 2, c: [0, 0, 0], u: [0, 0, 1], p: { a: 0.3, b: 0.8, c: 0.5 }, s: 1 },
  ];
  for (const q of cases)
    it(q.kind, () => {
      const { pts, w } = samples(q);
      const W = w.reduce((a, b) => a + b, 0);
      const F = q.kind === 'box' ? ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as [V3, V3, V3]) : frame(q.u);
      const I: M3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const mc: V3 = [0, 0, 0];
      pts.forEach((x, n) => {
        const g: V3 = [0, 1, 2].map((i) => x[0] * F[0][i] + x[1] * F[1][i] + x[2] * F[2][i]) as V3;
        const dm = (q.m * w[n]) / W;
        const r2 = g[0] ** 2 + g[1] ** 2 + g[2] ** 2;
        for (let i = 0; i < 3; i++) {
          mc[i] += dm * g[i];
          for (let j = 0; j < 3; j++) I[i][j] += dm * ((i === j ? r2 : 0) - g[i] * g[j]);
        }
      });
      mc.forEach((v) => expect(Math.abs(v)).toBeLessThan(2e-3));
      const T = centralTensor(q, q.m);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(Math.abs(T[i][j] - I[i][j]), `${i}${j}: ${T[i][j]} ~ ${I[i][j]}`).toBeLessThan(3e-3 * (Math.abs(T[0][0]) + Math.abs(T[2][2])));
    });
});

describe('геометрия масс: файл проекта, чертёж и текст', () => {
  for (const [key, p] of Object.entries(INERTIA_PRESETS)) {
    it(`${key}: файл туда-обратно, чертёж и решение без NaN`, () => {
      const s = new InertiaStore({ preset: key as InertiaPresetKey });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const s2 = new InertiaStore();
      expect(s2.importProject(text)).toBe(true);
      expect(s2.get().problem).toEqual(p.problem);
      const r = solveInertia(p.problem as IProblem);
      for (const t of [renderInertia(p.problem as IProblem, r).svg, JSON.stringify(inertiaDoc(p.problem as IProblem, r, { explain: true }))]) expect(t).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
  it('ошибки данных и чужой файл', () => {
    const s = new InertiaStore();
    expect(s.importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'centroid', problem: {} }))).toBe(false);
    expect(parseInertia({ parts: [{ kind: 'disk' }], A: [0, 0, 0], axis: [0, 0, 1] }).ok).toBe(false);
    const pr = structuredClone(INERTIA_PRESETS.m3421.problem) as IProblem;
    pr.parts[1].s = -1;
    pr.parts[1].m = 5;
    const r = solveInertia(pr);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(inertiaDoc(pr, r))).toContain('Масса системы');
  });
  it('редактирование и отмена', () => {
    const s = new InertiaStore();
    s.addPart();
    s.typePart(2, 'c0', 0.5);
    expect(s.get().problem.parts[2].c[0]).toBe(0.5);
    s.endSession('p:2:c0');
    s.undo();
    s.undo();
    expect(s.get().problem.parts.length).toBe(2);
  });
});
