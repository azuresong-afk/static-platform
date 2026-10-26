/** Тело с неподвижной точкой: сложение вращений, углы Эйлера, кинематический винт (Мещерский §19, 20, 25). */
import { describe, expect, it } from 'vitest';
import { solveEuler, type EulerProblem, type EulerResult } from '../src/modules/fixedpoint/model/euler';
import { solveScheme, type SchemeProblem, type SchemeResult } from '../src/modules/fixedpoint/model/scheme';
import { solveScrew, type ScrewResult } from '../src/modules/fixedpoint/model/screw';
import { renderEuler, renderScheme, renderScrew } from '../src/modules/fixedpoint/draw/fixedpoint';
import { eulerDoc, schemeDoc, screwDoc } from '../src/modules/fixedpoint/text/solution';
import { FpStore, parseFp } from '../src/modules/fixedpoint/ui/store';
import { docText } from './helpers/doctext';
import { angleDeg, cross, norm, vadd, vsub } from '../src/modules/fixedpoint/model/vec';
import { solveCalc } from '../src/modules/fixedpoint/model/calc';
import { calcDoc } from '../src/modules/fixedpoint/text/calc';
import { renderCalc } from '../src/modules/fixedpoint/draw/calc';
import { bd, ct, euler, FP_PRESETS, inp, pt, scheme } from '../src/modules/fixedpoint/presets';
import { taskInfo } from '../src/shared/tasks';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
const acute = (a: number) => (a > 90 ? 180 - a : a);

export function gotScheme(r: SchemeResult): Record<string, number> {
  const g: Record<string, number> = {};
  for (const b of r.bodies) {
    g[`W:${b.name}`] = norm(b.W);
    g[`w:${b.name}`] = Math.abs(b.w);
    g[`E:${b.name}`] = norm(b.E);
    g[`Wx:${b.name}`] = acute(angleDeg(b.W, [1, 0, 0]));
    g[`Wax:${b.name}`] = angleDeg(b.W, b.e);
    if (b.aks) Object.assign(g, { [`fix:${b.name}`]: b.aks.fix, [`mov:${b.name}`]: b.aks.mov });
  }
  for (const p of r.points) {
    Object.assign(g, {
      [`v:${p.name}`]: norm(p.v),
      [`a:${p.name}`]: norm(p.a),
      [`ax:${p.name}`]: Math.abs(p.a[0]),
      [`ay:${p.name}`]: Math.abs(p.a[1]),
      [`az:${p.name}`]: Math.abs(p.a[2]),
    });
  }
  return g;
}
export function gotEuler(r: EulerResult): Record<string, number> {
  const g: Record<string, number> = { w: r.w, e: r.e };
  for (let i = 0; i < 3; i++) Object.assign(g, { [`wF${i}`]: r.wF[i], [`wB${i}`]: r.wB[i], [`eF${i}`]: r.eF[i], [`eB${i}`]: r.eB[i] });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) g[`c${i}${j}`] = r.R[j][i];
  if (r.aks) Object.assign(g, { fix: r.aks.fix, mov: r.aks.mov });
  if (r.point) Object.assign(g, { v: norm(r.point.vF), a: norm(r.point.aF) });
  return g;
}
export function gotScrew(r: ScrewResult): Record<string, number> {
  const g: Record<string, number> = { W: norm(r.Om), vO: norm(r.vO), vmin: r.vmin };
  if (r.axisP) Object.assign(g, { ax: r.axisP[0], ay: r.axisP[1], az: r.axisP[2] });
  for (const p of r.points)
    Object.assign(
      g,
      { [`v:${p.name}`]: norm(p.v), [`vx:${p.name}`]: p.v[0], [`vy:${p.name}`]: p.v[1], [`vz:${p.name}`]: p.v[2] },
      p.d != null ? { [`d:${p.name}`]: p.d } : {},
    );
  return g;
}

describe('готовые задачи: ответы книги', () => {
  for (const [key, p] of Object.entries(FP_PRESETS))
    it(p.title, () => {
      let got: Record<string, number>;
      let text: string, svg: string;
      if (p.problem.mode === 'scheme') {
        const r = solveScheme(p.problem.scheme);
        expect(r.ok, key + r.errors.join()).toBe(true);
        expect(r.notes, key).toEqual([]);
        got = gotScheme(r);
        text = docText(schemeDoc(p.problem.scheme, r, { explain: true }));
        svg = renderScheme(p.problem.scheme, r).svg;
      } else if (p.problem.mode === 'euler') {
        const r = solveEuler(p.problem.euler);
        expect(r.ok, key + r.errors.join()).toBe(true);
        got = gotEuler(r);
        text = docText(eulerDoc(p.problem.euler, r, { explain: true }));
        svg = renderEuler(p.problem.euler, r).svg;
      } else if (p.problem.mode === 'calc') {
        const r = solveCalc(p.problem.calc);
        expect(r.ok, key + r.errors.join()).toBe(true);
        got = r.get;
        text = docText(calcDoc(p.problem.calc, r, { explain: true }));
        svg = renderCalc(r).svg;
      } else {
        const r = solveScrew(p.problem.screw);
        expect(r.ok, key + r.errors.join()).toBe(true);
        got = gotScrew(r);
        text = docText(screwDoc(p.problem.screw, r, { explain: true }));
        svg = renderScrew(p.problem.screw, r).svg;
      }
      expect(text).not.toMatch(/NaN|undefined|Infinity|\[object/);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      const rel = (p as { relTol?: number }).relTol ?? 0.005;
      for (const [k, book] of Object.entries((p as { book?: Record<string, number> }).book ?? {})) {
        expect(got[k], `${key}: нет ${k}`).toBeDefined();
        const val = p.problem.mode === 'calc' || /^(c\d\d|wF|wB|eF|eB|vx|vy|vz|ax$|ay$|az$)/.test(k) ? got[k] : Math.abs(got[k]);
        expect(Math.abs(val - book), `${key} ${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(Math.abs(book) < 1e-12 ? 1e-9 : rel * Math.abs(book));
      }
      const par = /Мещерский (\d+)\./.exec(p.title)?.[1];
      if (par) expect(taskInfo(p.title)).toMatchObject({ book: 'mesh', group: `mesh:${par}` });
      else expect(taskInfo(p.title)).toMatchObject({ book: 'yab' });
    });
});

/** Случайная схема: стойка → водило (ось через O) → звено (ось через O), касание звена со стойкой и с колесом на оси стойки. */
function randomScheme(rnd: () => number): SchemeProblem {
  const a1 = rnd() * 360,
    a2 = rnd() * 360,
    a3 = rnd() * 360;
  return scheme({
    unit: 'cm',
    bodies: [bd(1, 'водило', 0, a1), bd(2, 'тело', 1, a2), bd(3, 'колесо', 0, a3)],
    points: [
      pt(1, 'K', 'polar', 1 + rnd() * 5, rnd() * 360),
      pt(2, 'P', 'polar', 1 + rnd() * 5, rnd() * 360),
      pt(3, 'M', 'xy', rnd() * 6 - 3, rnd() * 6 - 3, { body: 2, z: rnd() * 4 - 2 }),
    ],
    contacts: [ct(2, 0, 1), ct(2, 3, 2)],
    inputs: [inp('rel', 1, rnd() * 10 - 5, { d: rnd() * 4 - 2 })],
  });
}

describe('схема: свойства решения', () => {
  it('скорости в точках касания равны, формула Ривальса совпадает со сложением ускорений', () => {
    const rnd = rng(11);
    let n = 0;
    for (let i = 0; i < 300; i++) {
      const pr = randomScheme(rnd);
      const r = solveScheme(pr);
      if (!r.ok) continue;
      n++;
      const body = r.bodies[1];
      const K = r.pos.get(1)!;
      // Касание со стойкой: точка тела в K неподвижна.
      const vK = cross(body.W, vsub(K, body.O!));
      expect(norm(vK)).toBeLessThan(1e-9 * (1 + norm(body.W)) * 10);
      // Касание с колесом: скорости совпадают.
      const P = r.pos.get(2)!;
      const wheel = r.bodies[2];
      const vb = cross(body.W, vsub(P, body.O!)),
        vw = cross(wheel.W, vsub(P, wheel.A));
      expect(norm(vsub(vb, vw))).toBeLessThan(1e-8 * (1 + norm(vb)));
      // Точка M: Ривальс = сложение по уровням.
      const m = r.points[0];
      expect(norm(vsub(vadd(m.rot!, m.cen!), m.a))).toBeLessThan(1e-8 * (1 + norm(m.a)));
      expect(body.kind).toBe('point');
    }
    expect(n).toBeGreaterThan(250);
  });
  it('мало условий и противоречивые условия — понятные ошибки', () => {
    const pr = scheme({ bodies: [bd(1, '1', 0, 90), bd(2, '2', 1, 0)], inputs: [inp('rel', 1, 1)] });
    expect(solveScheme(pr).errors.join()).toMatch(/Не хватает условий: вращение звена 2/);
    pr.inputs.push(inp('rel', 2, 1), inp('rel', 2, 2));
    expect(solveScheme(pr).errors.join()).toMatch(/противоречат/);
  });
  it('модуль ускорения как данное — только при одной степени свободы', () => {
    const pr = scheme({ bodies: [bd(1, '1', 0, 90), bd(2, '2', 1, 0)], points: [pt(1, 'A', 'xy', 1, 1, { body: 2 })], inputs: [inp('acc', 2, 5, { p: 1 })] });
    expect(solveScheme(pr).errors.join()).toMatch(/одной степенью свободы/);
  });
});

describe('углы Эйлера: свойства', () => {
  const seqs = ['zxz', 'zyz', 'plane', 'ship', 'custom'] as const;
  it('ω — из производной матрицы поворота, ε — производная ω; проекции на оси тела — Rᵀω', () => {
    const rnd = rng(5);
    for (let i = 0; i < 60; i++) {
      const seq = seqs[i % seqs.length];
      const k = [1 + rnd(), 1 + rnd(), 1 + rnd()].map((x) => x.toFixed(3).replace('.', ','));
      const pr: EulerProblem = euler({
        seq,
        a1: 2,
        a2: 3,
        a3: 2,
        q1: `${k[0]} sin t`,
        q2: `0,3 + ${k[1]}t`,
        q3: `${k[2]}t^2`,
        t1: rnd() * 2,
        mx: 1,
        my: 2,
        mz: -1,
      });
      const r = solveEuler(pr);
      expect(r.ok).toBe(true);
      const h = 1e-5;
      const ra = solveEuler({ ...pr, t1: pr.t1 - h }),
        rb = solveEuler({ ...pr, t1: pr.t1 + h });
      // Ṙ Rᵀ = [ω]×.
      const Rd = r.R.map((row, a) => row.map((_, b) => (rb.R[a][b] - ra.R[a][b]) / (2 * h)));
      const S = [0, 1, 2].map((a) => [0, 1, 2].map((b) => Rd[a][0] * r.R[b][0] + Rd[a][1] * r.R[b][1] + Rd[a][2] * r.R[b][2]));
      expect(S[2][1]).toBeCloseTo(r.wF[0], 5);
      expect(S[0][2]).toBeCloseTo(r.wF[1], 5);
      expect(S[1][0]).toBeCloseTo(r.wF[2], 5);
      for (let c = 0; c < 3; c++) expect((rb.wF[c] - ra.wF[c]) / (2 * h)).toBeCloseTo(r.eF[c], 5);
      // Скорость точки — производная её положения.
      for (let c = 0; c < 3; c++) expect((rb.point!.rF[c] - ra.point!.rF[c]) / (2 * h)).toBeCloseTo(r.point!.vF[c], 5);
      expect(norm(r.wB)).toBeCloseTo(r.w, 10);
    }
  });
  it('символьные формулы z–x–z — классические', () => {
    const r = solveEuler(euler({ seq: 'zxz', q1: 't', q2: '1', q3: '2t', t1: 0.3 }));
    expect(r.sym.wB).toEqual(['ψ̇ sin θ sin φ + θ̇ cos φ', 'ψ̇ sin θ cos φ − θ̇ sin φ', 'ψ̇ cos θ + φ̇']);
    expect(r.sym.wF[2]).toBe('ψ̇ + φ̇ cos θ');
  });
  it('ошибка в законе угла — сообщение', () => {
    expect(solveEuler(euler({ q1: 'sin(', q2: '1', q3: 't' })).errors.join()).toMatch(/Закон ψ/);
  });
});

describe('кинематический винт: свойства', () => {
  it('у точек оси скорость наименьшая и направлена по Ω; v·Ω одинаково для всех точек', () => {
    const rnd = rng(3);
    for (let i = 0; i < 100; i++) {
      const items = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ({
        kind: (rnd() < 0.7 ? 'rot' : 'tr') as 'rot' | 'tr',
        x: rnd() * 4 - 2,
        y: rnd() * 4 - 2,
        z: rnd() * 4 - 2,
        px: rnd() * 4 - 2,
        py: rnd() * 4 - 2,
        pz: rnd() * 4 - 2,
      }));
      const r = solveScrew({ unit: 'm', items, points: [{ name: 'A', x: rnd(), y: rnd(), z: rnd() }] });
      if (!r.axisP) continue;
      const vAx = vadd(r.vO, cross(r.Om, r.axisP));
      expect(norm(vAx)).toBeCloseTo(Math.abs(r.vmin), 8);
      expect(norm(cross(vAx, r.Om))).toBeLessThan(1e-8 * (1 + norm(vAx) * norm(r.Om)));
      const vA = r.points[0].v;
      expect((vA[0] * r.Om[0] + vA[1] * r.Om[1] + vA[2] * r.Om[2]) / norm(r.Om)).toBeCloseTo(r.vmin, 8);
    }
  });
});

describe('файл проекта и история', () => {
  it('сохранение и открытие без потерь во всех режимах', () => {
    for (const k of ['m2512', 'm2015', 'm2529'] as const) {
      const a = new FpStore({ preset: k });
      const { text } = a.exportProject(new Date('2026-10-01'));
      const b = new FpStore({ preset: 'm191' });
      expect(b.importProject(text, 'f.json')).toBe(true);
      expect(b.get().problem).toEqual(a.get().problem);
    }
    expect(parseFp({ mode: 'scheme', scheme: { unit: 'km' } }).ok).toBe(false);
  });
  it('удаление звена убирает его касания и условия; отмена возвращает', () => {
    const s = new FpStore({ preset: 'm2512' });
    const before = s.get().problem;
    s.removeBody(4);
    expect(s.get().problem.scheme.contacts).toEqual([]);
    expect(solveScheme(s.get().problem.scheme).errors.join()).toMatch(/кривошип IV/);
    s.undo();
    expect(s.get().problem).toEqual(before);
  });
});
