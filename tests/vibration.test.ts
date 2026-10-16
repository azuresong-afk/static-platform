/** Малые колебания систем с несколькими степенями свободы (Мещерский §54). */
import { describe, expect, it } from 'vitest';
import { beamModel } from '../src/modules/vibration/model/beam';
import { eigenSym } from '../src/modules/vibration/model/linalg';
import { freeCoefs, modalMotion, solveVib, type VibResult } from '../src/modules/vibration/model/vibration';
import { VIB_PRESETS, type VibPreset } from '../src/modules/vibration/presets';
import { taskInfo } from '../src/shared/tasks';

function got(r: VibResult, links?: { len: number }[]): Record<string, number> {
  const g: Record<string, number> = {};
  const { D, E } = freeCoefs(r);
  r.modes.forEach((m, s) => {
    g['k' + (s + 1)] = m.k;
    if (m.k > 0) g['T' + (s + 1)] = (2 * Math.PI) / m.k;
    if (m.h != null) g['h' + (s + 1)] = m.h;
    m.shape.forEach((a, i) => m.shape.forEach((b, j) => (g[`r${s + 1}_${i + 1}_${j + 1}`] = a / b)));
    const node = m.nodes.find((x) => x.at === 'link');
    if (node && node.at === 'link' && links) g['node' + (s + 1)] = node.t * links[node.i].len;
  });
  r.sys.names.forEach((_, j) =>
    r.modes.forEach((__, s) => {
      g[`D${j + 1}_${s + 1}`] = D[j][s];
      g[`E${j + 1}_${s + 1}`] = E[j][s];
    }),
  );
  if (r.forced) r.forced.re.forEach((x, j) => (g['X' + (j + 1)] = x));
  if (r.zeroAt) r.zeroAt.p.forEach((p, i) => (g['z' + (i + 1)] = p));
  if (r.sys.info.src === 'absorber') {
    g.m2 = r.sys.info.m2;
    g.c2 = r.sys.info.c2;
  }
  return g;
}

describe('готовые задачи: ответы книги', () => {
  for (const [key, p0] of Object.entries(VIB_PRESETS)) {
    const p = p0 as VibPreset;
    it(p.title, () => {
      const r = solveVib(p.problem);
      expect(r.ok, key + (!r.ok ? r.error : '')).toBe(true);
      if (!r.ok) return;
      const g = got(r, p.problem.src === 'chain' ? p.problem.chain.links : undefined);
      for (const [k, book] of Object.entries(p.book ?? {})) {
        const tol = p.tol?.[k] ?? p.relTol ?? 1e-6;
        expect(g[k], `${key}: нет величины ${k}`).toBeDefined();
        if (Math.abs(book) < 1e-12)
          expect(Math.abs(g[k]), `${k}: ${g[k]} против 0`).toBeLessThan(1e-9 * Math.max(1, ...Object.values(g).map(Math.abs).filter(Number.isFinite)));
        else expect(Math.abs(g[k] - book), `${key} ${k}: ${g[k]} против ${book}`).toBeLessThanOrEqual(tol * Math.abs(book));
      }
      expect(taskInfo(p.title)).toMatchObject({ book: 'mesh', group: 'mesh:54' });
    });
  }
});

describe('расхождения с книгой (README)', () => {
  it('54.27: первая частота 58,8 с⁻¹ (книга — 54,8), почти как без колёс (54.28: 58,7)', () => {
    const r = solveVib(VIB_PRESETS.m5427.problem);
    const r28 = solveVib(VIB_PRESETS.m5428.problem);
    if (!r.ok || !r28.ok) throw new Error('нет решения');
    expect(r.modes[1].k).toBeCloseTo(58.797, 2);
    expect(r28.modes[1].k).toBeGreaterThan(r.modes[1].k);
    expect(r28.modes[1].k - r.modes[1].k).toBeLessThan(0.01);
  });
  it('54.33: k₁ = 0,864√(3EJ/(ml³)) и O₁A = 0,638l (книга — 0,804 и 0,612); k₂ и O₂A совпадают', () => {
    const r = solveVib(VIB_PRESETS.m5433.problem);
    if (!r.ok) throw new Error('нет решения');
    expect(r.modes[0].k / Math.sqrt(3)).toBeCloseTo(0.8638, 3);
    expect(r.modes[0].shape[0] / r.modes[0].shape[1]).toBeCloseTo(0.6376, 3);
    expect(r.modes[1].k / Math.sqrt(3)).toBeCloseTo(20.71, 2);
  });
  it('54.30, 54.46, 54.17: расхождения в третьей значащей цифре', () => {
    const k = (key: 'm5430' | 'm5446', s: number) => {
      const r = solveVib(VIB_PRESETS[key].problem);
      return r.ok ? r.modes[s].k : NaN;
    };
    expect(k('m5430', 1)).toBeCloseTo(27.106, 2);
    expect(k('m5446', 2)).toBeCloseTo(41.606, 2);
    const r = solveVib(VIB_PRESETS.m5417.problem);
    if (!r.ok) throw new Error('нет решения');
    expect(freeCoefs(r).E[1][0]).toBeCloseTo(0.5075, 3);
  });
});

describe('модель', () => {
  it('обобщённая задача на собственные значения: C·v = λA·v, vᵀAv = 1', () => {
    const A = [
      [4, 1, 0.5],
      [1, 3, 0.2],
      [0.5, 0.2, 2],
    ];
    const C = [
      [10, -4, 0],
      [-4, 8, -3],
      [0, -3, 5],
    ];
    const e = eigenSym(C, A)!;
    e.lam.forEach((l, s) => {
      const v = e.vec[s];
      const Cv = C.map((row) => row.reduce((acc, x, j) => acc + x * v[j], 0));
      const Av = A.map((row) => row.reduce((acc, x, j) => acc + x * v[j], 0));
      Cv.forEach((x, i) => expect(x).toBeCloseTo(l * Av[i], 10));
      expect(v.reduce((acc, x, i) => acc + x * Av[i], 0)).toBeCloseTo(1, 10);
    });
    expect(
      eigenSym(C, [
        [1, 0, 0],
        [0, 0, 0],
        [0, 0, 1],
      ]),
    ).toBeNull();
  });
  it('коэффициенты влияния: формулы сопромата для простых балок', () => {
    const ss = beamModel({
      L: 3,
      EJ: 2,
      supports: [
        { x: 0, kind: 'pin' },
        { x: 3, kind: 'pin' },
      ],
      masses: [
        { x: 1, m: 1, J: 0, e: 0, H: 0 },
        { x: 2.5, m: 1, J: 0, e: 0, H: 0 },
      ],
    });
    if (!ss.ok) throw new Error(ss.error);
    // δ(x, a) для балки на двух опорах: P·b·x(l² − b² − x²)/(6EJl), x ≤ a.
    const dl = (x: number, a: number) => ((3 - a) * x * (9 - (3 - a) ** 2 - x * x)) / (6 * 2 * 3);
    expect(ss.delta[0][0]).toBeCloseTo((1 * 1 * 2 * 2) / (3 * 2 * 3), 12);
    expect(ss.delta[0][1]).toBeCloseTo(dl(1, 2.5), 12);
    const cant = beamModel({ L: 2, EJ: 3, supports: [{ x: 0, kind: 'fixed' }], masses: [{ x: 2, m: 1, J: 1, e: 0, H: 0 }] });
    if (!cant.ok) throw new Error(cant.error);
    expect(cant.delta[0][0]).toBeCloseTo(8 / 9, 12);
    expect(cant.delta[0][1]).toBeCloseTo(4 / 6, 12);
    expect(cant.delta[1][1]).toBeCloseTo(2 / 3, 12);
    const ff = beamModel({
      L: 1,
      EJ: 1,
      supports: [
        { x: 0, kind: 'fixed' },
        { x: 1, kind: 'fixed' },
      ],
      masses: [{ x: 0.5, m: 1, J: 0, e: 0, H: 0 }],
    });
    if (!ff.ok) throw new Error(ff.error);
    expect(ff.delta[0][0]).toBeCloseTo(1 / 192, 12);
    expect(beamModel({ L: 1, EJ: 1, supports: [{ x: 0, kind: 'pin' }], masses: [{ x: 1, m: 1, J: 0, e: 0, H: 0 }] }).ok).toBe(false);
  });
  it('54.34: закон движения под постоянным моментом — по формуле книги и численно', () => {
    const p = VIB_PRESETS.m5434.problem;
    const r = solveVib(p);
    if (!r.ok || !r.sim) throw new Error('нет решения');
    const J = 2,
      c = 800,
      M = 10,
      k = Math.sqrt((2 * c) / J);
    for (const t of [0.05, 0.17, 0.4]) {
      const q = modalMotion(r, t);
      expect(q[0]).toBeCloseTo((M * t * t) / (4 * J) + (M / (4 * c)) * (1 - Math.cos(k * t)), 10);
      expect(q[1]).toBeCloseTo((M * t * t) / (4 * J) - (M / (4 * c)) * (1 - Math.cos(k * t)), 10);
    }
    const i = r.sim.t.length - 1;
    expect(r.sim.q[0][i]).toBeCloseTo(modalMotion(r, r.sim.t[i])[0], 6);
  });
  it('численное интегрирование совпадает с движением в главных координатах (54.45, 54.4)', () => {
    for (const key of ['m5445', 'm544'] as const) {
      const r = solveVib(VIB_PRESETS[key].problem);
      if (!r.ok || !r.sim) throw new Error('нет решения');
      r.sim.t.forEach((t, i) => {
        if (i % 97) return;
        const q = modalMotion(r, t);
        q.forEach((x, j) => expect(Math.abs(r.sim!.q[j][i] - x)).toBeLessThan(1e-7));
      });
    }
  });
  it('вынужденные колебания с сопротивлением: установившаяся амплитуда совпадает с интегрированием', () => {
    const p = structuredClone(VIB_PRESETS.m5438.problem);
    p.chain.links[0].b = 8;
    p.chain.links[1].b = 3;
    p.tEnd = 30;
    const r = solveVib(p);
    if (!r.ok || !r.sim || !r.forced) throw new Error('нет решения');
    expect(r.damping).toBe('coupled');
    const n = r.sim.t.length;
    const tail = r.sim.q[1].slice(Math.floor(n * 0.85));
    const amp = (Math.max(...tail) - Math.min(...tail)) / 2;
    expect(amp).toBeCloseTo(r.forced.amp[1], 4);
  });
  it('54.47: выше 2√(c/m) амплитуды убывают от массы к массе с чередованием знака, ниже — нет', () => {
    const at = (p: number) => {
      const pr = structuredClone(VIB_PRESETS.m5447.problem);
      pr.force.p = p;
      const r = solveVib(pr);
      if (!r.ok || !r.forced) throw new Error('нет решения');
      return r.forced.re;
    };
    const hi = at(24);
    hi.slice(1).forEach((x, i) => {
      expect(Math.abs(x)).toBeLessThan(Math.abs(hi[i]));
      expect(Math.sign(x)).toBe(-Math.sign(hi[i]));
    });
    const lo = at(12);
    expect(Math.abs(lo[5])).toBeGreaterThan(Math.abs(lo[0]) * 0.3);
  });
  it('гаситель: амплитуда нагруженной координаты — нуль при p² = c₂₂/a₂₂ (54.40)', () => {
    const r = solveVib(VIB_PRESETS.m5414.problem);
    if (!r.ok || !r.forced || !r.zeroAt) throw new Error('нет решения');
    expect(r.zeroAt.k).toBe(0);
    expect(r.zeroAt.p[0]).toBeCloseTo(4, 10);
    expect(Math.abs(r.forced.re[0])).toBeLessThan(1e-12);
  });
  it('резонанс без сопротивления и ошибки ввода', () => {
    const p = structuredClone(VIB_PRESETS.m5438.problem);
    const r0 = solveVib(p);
    if (!r0.ok) throw new Error('нет решения');
    p.force.p = r0.modes[0].k;
    const r = solveVib(p);
    expect(r.ok && r.resonance).toBe(0);
    const e = structuredClone(VIB_PRESETS.m549.problem);
    e.energy.coords[0].eq = 0.3;
    const bad = solveVib(e);
    expect(!bad.ok && bad.field).toBe('eq');
    e.energy.coords[0].eq = 0;
    e.energy.T = "m l^2 φ1'^2/2 + m φ1' φ2 + m φ2'^2/2";
    const gy = solveVib(e);
    expect(!gy.ok && gy.error).toMatch(/гироскоп/);
    e.energy.T = "m l^2 φ1'^2/2";
    const sing = solveVib(e);
    expect(!sing.ok && sing.error).toMatch(/инерционных/);
  });
  it('система по T и Π совпадает с линеаризацией «Уравнений Лагранжа»', async () => {
    const { solveLagrange } = await import('../src/modules/lagrange/model/lagrange');
    const p = VIB_PRESETS.m549.problem.energy;
    const lg = solveLagrange({ coords: p.coords.map((c) => ({ name: c.name, q0: 0, v0: 0, eq: 0, Q: '' })), params: p.params, T: p.T, P: p.P, tEnd: 0 });
    const r = solveVib(VIB_PRESETS.m549.problem);
    if (!lg.ok || !lg.small || !r.ok) throw new Error('нет решения');
    lg.small.w2.forEach((w2, i) => expect(Math.sqrt(w2)).toBeCloseTo(r.modes[i].k, 9));
  });
});

describe('текст, чертёж, файл проекта', () => {
  it('все готовые задачи: текст и чертёж без NaN, файл проекта открывается без потерь', async () => {
    const { vibDoc } = await import('../src/modules/vibration/text/solution');
    const { renderVib } = await import('../src/modules/vibration/draw/vib');
    const { VibStore, parseVib } = await import('../src/modules/vibration/ui/store');
    const { docText } = await import('./helpers/doctext');
    for (const [key, p] of Object.entries(VIB_PRESETS)) {
      const r = solveVib(p.problem);
      for (const explain of [true, false]) expect(docText(vibDoc(p.problem, r, { explain })), key).not.toMatch(/NaN|undefined|Infinity/);
      expect(renderVib(p.problem, r).svg, key).not.toMatch(/NaN|undefined/);
      const s = new VibStore({ preset: key as keyof typeof VIB_PRESETS });
      const f = s.exportProject(new Date('2026-10-16T00:00:00Z'));
      const s2 = new VibStore();
      expect(s2.importProject(f.text)).toBe(true);
      expect(s2.get().problem).toEqual(p.problem);
      expect(parseVib(JSON.parse(f.text).problem).ok).toBe(true);
    }
    expect(new VibStore().importProject('{"format":"statika-project","version":2,"module":"vibration","problem":{"src":"beam"}}')).toBe(false);
  });
  it('54.29: текст — коэффициенты влияния дробями, частоты, формы; 54.37 — масса и жёсткость гасителя', async () => {
    const { vibDoc } = await import('../src/modules/vibration/text/solution');
    const { docText } = await import('./helpers/doctext');
    const t = docText(vibDoc(VIB_PRESETS.m5429.problem, solveVib(VIB_PRESETS.m5429.problem)));
    expect(t).toContain('δ₁₁ = 4/243·L³/(EJ)');
    expect(t).toContain('δ₁₂ = 7/486·L³/(EJ)');
    expect(t).toContain('k₁ = 5,6921 рад/с');
    const a = docText(vibDoc(VIB_PRESETS.m5437.problem, solveVib(VIB_PRESETS.m5437.problem)));
    expect(a).toContain('c₂ = H/A = 10/0,002 = 5000');
    expect(a).toContain('[гашение колебаний]');
  });
  it('отмена и строки цепочки', async () => {
    const { VibStore } = await import('../src/modules/vibration/ui/store');
    const s = new VibStore({ preset: 'm5445' });
    s.addBody();
    expect(s.get().problem.chain.bodies.length).toBe(4);
    expect(s.get().problem.chain.links.length).toBe(5);
    s.removeBody(0);
    expect(s.get().problem.chain.bodies.length).toBe(3);
    expect(s.get().problem.chain.links.length).toBe(4);
    s.undo();
    s.undo();
    expect(s.get().problem).toEqual(VIB_PRESETS.m5445.problem);
    expect(s.get().preset).toBe('m5445');
  });
});
