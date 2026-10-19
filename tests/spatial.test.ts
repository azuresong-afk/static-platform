/** Пространственное движение тела: Мещерский §19, 20, 25, 40. */
import { describe, expect, it } from 'vitest';
import { norm } from '../src/modules/converging/model/forces';
import { solveCompose } from '../src/modules/spatial/model/compose';
import { solveDiff } from '../src/modules/spatial/model/diff';
import { solveEuler } from '../src/modules/spatial/model/euler';
import { solveGyro } from '../src/modules/spatial/model/gyro';
import { solveScrew } from '../src/modules/spatial/model/screw';
import { SP_PRESETS, type SpPreset, type SpState } from '../src/modules/spatial/presets';
import { taskInfo } from '../src/shared/tasks';

const deg = (r: number) => (r * 180) / Math.PI;
/** Угол при вершине аксоида по углу между ω и осью (ω может быть направлена и против образующей). */
const apex = (a: number) => 2 * Math.min(deg(a), 180 - deg(a));

export function gotOf(p: SpState): Record<string, number> | string {
  const g: Record<string, number> = {};
  switch (p.mode) {
    case 'compose': {
      const r = solveCompose(p.compose);
      if (!r.ok) return r.error;
      Object.assign(g, { we: r.we, wr: r.wr, w: norm(r.w), eps: norm(r.eps), apF: apex(r.axFixed), apM: apex(r.axMoving) });
      for (const q of r.points) {
        g['v:' + q.name] = norm(q.v);
        g['a:' + q.name] = norm(q.a);
        g['ay:' + q.name] = q.a[1];
      }
      return g;
    }
    case 'euler': {
      const r = solveEuler(p.euler);
      if (!r.ok) return r.error;
      Object.assign(g, { w: norm(r.w), eps: norm(r.eps) });
      r.w.forEach((x, i) => (g['wf' + i] = x));
      r.wBody.forEach((x, i) => (g['wb' + i] = x));
      r.eps.forEach((x, i) => (g['ef' + i] = x));
      r.R.forEach((row, i) => row.forEach((x, j) => (g[`R${i}${j}`] = x)));
      if (r.precession) Object.assign(g, { apF: 2 * deg(r.precession.fixed), apM: 2 * deg(r.precession.moving) });
      return g;
    }
    case 'diff': {
      const r = solveDiff(p.diff);
      if (!r.ok) return r.error;
      Object.assign(g, { w1: r.w1, w2: r.w2, wH: r.wH, ws: Math.abs(r.ws), wAbs: r.wAbs });
      if (r.vC != null) g.vC = r.vC;
      return g;
    }
    case 'screw': {
      const r = solveScrew(p.screw);
      if (!r.ok) return r.error;
      const red = r.red;
      Object.assign(g, { w: norm(red.R), vmin: Math.abs(red.Mstar), vx: red.M[0], vy: red.M[1], vz: red.M[2] });
      if (red.axisPoint) Object.assign(g, { ax: red.axisPoint[0], ay: red.axisPoint[1], az: red.axisPoint[2] });
      for (const q of r.points) {
        g['v:' + q.name] = norm(q.v);
        g['vx:' + q.name] = q.v[0];
        g['vy:' + q.name] = q.v[1];
        g['vz:' + q.name] = q.v[2];
      }
      return g;
    }
    case 'gyro': {
      const r = solveGyro(p.gyro);
      if (!r.ok) return r.error;
      Object.assign(g, { M: r.M, Om: r.Om });
      if (r.dN != null) g.dN = r.dN;
      if (r.N) [g.N1, g.N2] = r.N;
      if (r.prec) g.T = r.prec.T;
      if (r.alpha != null) g.alpha = r.alpha;
      return g;
    }
  }
}

describe('готовые задачи: ответы книги', () => {
  for (const [key, p0] of Object.entries(SP_PRESETS)) {
    const p = p0 as SpPreset;
    it(p.title, () => {
      const g = gotOf(p.problem);
      expect(typeof g, key + ': ' + g).toBe('object');
      if (typeof g === 'string') return;
      const scale = Math.max(1, ...Object.values(g).map(Math.abs).filter(Number.isFinite));
      for (const [k, book] of Object.entries(p.book ?? {})) {
        expect(g[k], `${key}: нет величины ${k}`).toBeDefined();
        const tol = p.tol?.[k] ?? p.relTol ?? 1e-6;
        if (Math.abs(book) < 1e-12) expect(Math.abs(g[k]), `${key} ${k}: ${g[k]} против 0`).toBeLessThan(1e-9 * scale);
        else expect(Math.abs(g[k] - book), `${key} ${k}: ${g[k]} против ${book}`).toBeLessThanOrEqual(tol * Math.abs(book));
      }
      expect(taskInfo(p.title).book).toBe('mesh');
    });
  }
});

describe('модель', () => {
  it('сложение вращений: ω — сумма, ε = ωₑ × ωᵣ, скорость точки на мгновенной оси — нуль', () => {
    const r = solveCompose(SP_PRESETS.m1905.problem.compose);
    if (!r.ok) throw new Error(r.error);
    expect(norm(r.points[0].v)).toBe(0);
    expect(r.points[0].h).toBe(0);
    expect(norm(r.eps)).toBeCloseTo(r.we * r.wr * Math.sin(Math.PI / 2), 9);
    const bad = solveCompose({ ...SP_PRESETS.m1905.problem.compose, gamma: 90 });
    expect(bad.ok).toBe(false);
  });
  it('углы Эйлера: ω, найденная по формулам, совпадает с численной производной матрицы поворота', () => {
    for (const seq of ['zxz', 'zyz', 'yzx', 'xyz', 'zyx']) {
      const pr = {
        seq,
        names: ['α', 'β', 'γ'] as [string, string, string],
        laws: ['0,3 + 0,7t', '0,4 + 0,2t^2', '1,1 − 1,3t'] as [string, string, string],
        t1: 0.6,
        point: [1, 2, 3] as [number, number, number],
      };
      const r = solveEuler(pr);
      const h = 1e-5;
      const r1 = solveEuler({ ...pr, t1: pr.t1 + h }),
        r0 = solveEuler({ ...pr, t1: pr.t1 - h });
      if (!r.ok || !r1.ok || !r0.ok) throw new Error('нет решения');
      // Ṙ·Rᵀ = [ω]×.
      const dR = r.R.map((row, i) => row.map((_, j) => (r1.R[i][j] - r0.R[i][j]) / (2 * h)));
      const W = dR.map((row) => [0, 1, 2].map((j) => row.reduce((acc, x, k) => acc + x * r.R[j][k], 0)));
      expect(W[2][1]).toBeCloseTo(r.w[0], 6);
      expect(W[0][2]).toBeCloseTo(r.w[1], 6);
      expect(W[1][0]).toBeCloseTo(r.w[2], 6);
      // ε — численная производная ω.
      r.eps.forEach((e, i) => expect(e).toBeCloseTo((r1.w[i] - r0.w[i]) / (2 * h), 5));
      // Скорость точки — производная её радиус-вектора.
      r.point!.v.forEach((v, i) => expect(v).toBeCloseTo((r1.point!.r[i] - r0.point!.r[i]) / (2 * h), 6));
    }
    expect(solveEuler({ ...SP_PRESETS.m2015.problem.euler, seq: 'zzx' }).ok).toBe(false);
  });
  it('дифференциал: формула Виллиса в обе стороны, планетарный режим', () => {
    const base = SP_PRESETS.m2522.problem.diff;
    const r = solveDiff(base);
    if (!r.ok) throw new Error(r.error);
    const back = solveDiff({ ...base, unknown: '2', wH: r.wH, w2: 0 });
    expect(back.ok && back.w2).toBeCloseTo(9, 10);
    const one = solveDiff({ ...base, unknown: '1', wH: r.wH, w1: 0 });
    expect(one.ok && one.w1).toBeCloseTo(4.5, 10);
  });
  it('винт: вращение и поступательное движение вдоль оси — винтовое движение; пара вращений — поступательное', () => {
    const r = solveScrew({ rots: [{ name: 'ω', p: [1, 0, 0], d: [0, 0, 1], w: 2 }], trans: [{ name: 'v', v: [0, 0, 3] }], O: [0, 0, 0], points: [] });
    if (!r.ok) throw new Error(r.error);
    expect(r.red.kind).toBe('dynamo');
    expect(r.red.Mstar).toBeCloseTo(3, 12);
    expect(r.red.axisPoint![0]).toBeCloseTo(1, 12);
    expect(solveScrew({ rots: [], trans: [], O: [0, 0, 0], points: [] }).ok).toBe(false);
  });
  it('гироскоп: давление по вертикали и регулярная прецессия согласованы (Ω = M/(Jω))', () => {
    const g = SP_PRESETS.m4006.problem.gyro;
    const r = solveGyro(g);
    if (!r.ok) throw new Error(r.error);
    const p = solveGyro({ ...g, task: 'precession', F: r.M, h: 1 });
    expect(p.ok && p.prec!.Om).toBeCloseTo(r.Om, 12);
  });
});

describe('текст, чертёж, файл проекта', () => {
  it('все готовые задачи: текст и чертёж без NaN, файл проекта туда-обратно', async () => {
    const { spatialDoc } = await import('../src/modules/spatial/text/solution');
    const { solveSpatial } = await import('../src/modules/spatial/model/spatial');
    const { renderSpatial } = await import('../src/modules/spatial/draw/spatial');
    const { SpStore, parseSpatial } = await import('../src/modules/spatial/ui/store');
    const { docText } = await import('./helpers/doctext');
    for (const [key, p] of Object.entries(SP_PRESETS)) {
      const out = solveSpatial(p.problem);
      for (const explain of [true, false]) expect(docText(spatialDoc(p.problem, out, { explain })), key).not.toMatch(/NaN|undefined|Infinity/);
      expect(renderSpatial(p.problem, out).svg, key).not.toMatch(/NaN|undefined/);
      const s = new SpStore({ preset: key as keyof typeof SP_PRESETS });
      const f = s.exportProject(new Date('2026-10-19T00:00:00Z'));
      const s2 = new SpStore();
      expect(s2.importProject(f.text), key).toBe(true);
      expect(s2.get().problem).toEqual(p.problem);
      expect(parseSpatial(JSON.parse(f.text).problem).ok).toBe(true);
    }
    expect(new SpStore().importProject('{"format":"statika-project","version":2,"module":"spatial","problem":{"mode":"gyro"}}')).toBe(false);
  });
  it('тексты: формулы Эйлера в буквах, Виллис, гироскопический момент', async () => {
    const { spatialDoc } = await import('../src/modules/spatial/text/solution');
    const { solveSpatial } = await import('../src/modules/spatial/model/spatial');
    const { docText } = await import('./helpers/doctext');
    const t = (k: keyof typeof SP_PRESETS) => docText(spatialDoc(SP_PRESETS[k].problem, solveSpatial(SP_PRESETS[k].problem)));
    expect(t('m2003')).toContain('ω_z = cos θ·ψ̇ + φ̇');
    expect(t('m2522')).toContain('(ω₁ − ω_H)/(ω₂ − ω_H) = −R₂r₁/(R₁r₂) = −5·5/(10·2) = −1,25');
    expect(t('m4006')).toContain('ΔN = M_г/l = 188,5/1,5 = 125,66');
    expect(t('m1905')).toContain('|ω| = 240 об/мин');
  });
});
