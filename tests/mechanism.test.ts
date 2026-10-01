/** Плоский механизм: ответы Мещерского §16, 18 и независимые проверки. */
import { describe, expect, it } from 'vitest';
import { solveMech, type MechProblem, type MechResult } from '../src/modules/mechanism/model/mech';
import { MECH_PRESETS } from '../src/modules/mechanism/presets';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};
const hyp = (v: [number, number]) => Math.hypot(v[0], v[1]);

export function pick(r: MechResult, key: string): number {
  const [k, a, b] = key.split('.');
  const P = (n: string) => r.points.find((p) => p.name === n)!;
  const B = (n: string) => r.bodies.find((p) => p.name === n)!;
  if (k === 'v') return hyp(P(a).v);
  if (k === 'a') return hyp(P(a).a);
  if (k === 'w') return Math.abs(B(a).omega);
  if (k === 'e') return Math.abs(B(a).eps);
  if (k === 'icrx') return B(a).icr![0];
  if (k === 'icry') return B(a).icr![1];
  if (k === 'K') {
    const q = B(a).ica!,
      p = P(b).pos;
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return NaN;
}

describe('Мещерский §16, 18', () => {
  for (const [key, p] of Object.entries(MECH_PRESETS))
    it(p.title, () => {
      const r = solveMech(p.problem as MechProblem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) {
        const got = pick(r, k);
        expect(Math.abs(got - book), `${k}: ${got} против ${book}`).toBeLessThanOrEqual(tol(book));
      }
    });
});

const crankP = (phi: number, w = 15, e = 0): MechProblem => ({ ...(MECH_PRESETS.m189.problem as MechProblem), points: (MECH_PRESETS.m189.problem as MechProblem).points.map((p) => (p.name === 'A' ? { ...p, def: { k: 'polar', from: 'O', L: '40', ang: String(phi) } } : p)), drives: [{ k: 'omega', b: 'OA', w: String(w), e: String(e) }] });

describe('плоский механизм: независимые проверки', () => {
  it('18.9: при φ = 0 и 180° — w_B и расстояние до центра ускорений', () => {
    const r0 = solveMech(crankP(0));
    expect(pick(r0, 'a.B')).toBeCloseTo(10800, 6);
    expect(pick(r0, 'K.AB.B')).toBeCloseTo(1200, 6);
    const r180 = solveMech(crankP(180));
    expect(pick(r180, 'a.B')).toBeCloseTo(7200, 6);
    expect(pick(r180, 'K.AB.B')).toBeCloseTo(800, 6);
  });
  it('16.15: положение II — шатун движется поступательно, v_M = 754', () => {
    const r = solveMech({ ...(MECH_PRESETS.m1615.problem as MechProblem), points: (MECH_PRESETS.m1615.problem as MechProblem).points.map((p) => (p.name === 'A' ? { ...p, def: { k: 'polar', from: 'O', L: '40', ang: '90' } } : p)) });
    expect(pick(r, 'w.AB')).toBe(0);
    expect(pick(r, 'v.M')).toBeCloseTo(754, 0);
    expect(r.bodies.find((b) => b.name === 'AB')!.icr).toBeNull();
  });
  it('кривошипно-шатунный: скорость и ускорение ползуна = производные x_B(t) (численно), при ε ≠ 0', () => {
    const R = 40,
      L = 200,
      w = 3,
      e = 2;
    const xB = (f: number) => R * Math.cos(f) + Math.sqrt(L * L - (R * Math.sin(f)) ** 2);
    for (const deg of [17, 64, 133, 250]) {
      const f = (deg * Math.PI) / 180,
        h = 1e-4;
      // φ(t) = f + wt + εt²/2: dx/dt = x′w, d²x/dt² = x″w² + x′ε.
      const d1 = (xB(f + h) - xB(f - h)) / (2 * h),
        d2 = (xB(f + h) - 2 * xB(f) + xB(f - h)) / (h * h);
      const r = solveMech(crankP(deg, w, e));
      const B = r.points.find((p) => p.name === 'B')!;
      expect(B.v[0]).toBeCloseTo(d1 * w, 4);
      expect(B.a[0]).toBeCloseTo(d2 * w * w + d1 * e, 2);
    }
  });
  it('скорости точек согласуются с МЦС: |v| = |ω|·PM', () => {
    const r = solveMech(MECH_PRESETS.m1812.problem as MechProblem);
    const AB = r.bodies.find((b) => b.name === 'AB')!;
    for (const n of ['A', 'B']) {
      const p = r.points.find((q) => q.name === n)!;
      expect(hyp(p.v)).toBeCloseTo(Math.abs(AB.omega) * Math.hypot(p.pos[0] - AB.icr![0], p.pos[1] - AB.icr![1]), 9);
    }
  });
  it('18.13: кривошип вертикален — ω = 0, формулы книги', () => {
    const { r: rr, l, h, w } = { r: 10, l: 40, h: 15, w: 2 };
    const pr = MECH_PRESETS.m1813.problem as MechProblem;
    const r = solveMech({ ...pr, points: pr.points.map((p) => (p.name === 'A' ? { ...p, def: { k: 'xy', x: '0', y: '10' } } : p)) });
    expect(pick(r, 'w.AB')).toBe(0);
    const q = Math.sqrt(l * l - (rr + h) ** 2);
    expect(pick(r, 'e.AB')).toBeCloseTo((rr * w * w) / q, 9);
    expect(pick(r, 'v.B')).toBeCloseTo(rr * w, 9);
    expect(pick(r, 'a.B')).toBeCloseTo((rr * (rr + h) * w * w) / q, 9);
  });
  it('15.3, 15.4: планетарные передачи — ω шестерёнки (R/r ± 1)ω кривошипа, ускорение точки касания', () => {
    const R = 30,
      r = 10;
    const ext = solveMech({
      points: [{ name: 'O', def: { k: 'xy', x: '0', y: '0' } }, { name: 'A', def: { k: 'xy', x: String(R + r), y: '0' } }, { name: 'P', def: { k: 'xy', x: String(R), y: '0' } }],
      bodies: [{ name: 'OA', pts: ['O', 'A'] }, { name: 'шест', pts: ['A', 'P'] }],
      cons: [{ k: 'fixed', p: 'O' }, { k: 'gear', b1: 'шест', c1: 'A', r1: String(r), b2: '', c2: 'O', r2: String(R), int: false }],
      drives: [{ k: 'omega', b: 'OA', w: '2', e: '0' }],
    });
    expect(ext.ok, ext.errors.join()).toBe(true);
    const sh = ext.bodies.find((b) => b.name === 'шест')!;
    expect(sh.omega).toBeCloseTo((R / r + 1) * 2, 10);
    // Точка касания — МЦС, её ускорение ω²·rR/(R + r) к центру шестерёнки.
    const P = ext.points.find((p) => p.name === 'P')!;
    expect(hyp(P.v)).toBeCloseTo(0, 9);
    expect(P.a[0]).toBeCloseTo((sh.omega ** 2 * r * R) / (R + r), 8);
    const int = solveMech({
      points: [{ name: 'O', def: { k: 'xy', x: '0', y: '0' } }, { name: 'A', def: { k: 'xy', x: String(R - r), y: '0' } }],
      bodies: [{ name: 'OA', pts: ['O', 'A'] }, { name: 'шест', pts: ['A'] }],
      cons: [{ k: 'fixed', p: 'O' }, { k: 'gear', b1: 'шест', c1: 'A', r1: String(r), b2: '', c2: 'O', r2: String(R), int: true }],
      drives: [{ k: 'omega', b: 'OA', w: '2', e: '0' }],
    });
    expect(int.bodies.find((b) => b.name === 'шест')!.omega).toBeCloseTo(-(R / r - 1) * 2, 10);
  });
  it('16.30: катушка — v = uR/(R − r)', () => {
    const R = 0.5,
      r = 0.2,
      u = 1;
    const res = solveMech({
      points: [{ name: 'O', def: { k: 'xy', x: '0', y: String(R) } }, { name: 'B', def: { k: 'xy', x: '0', y: String(R - r) } }],
      bodies: [{ name: 'катушка', pts: ['O', 'B'] }],
      cons: [{ k: 'roll', b: 'катушка', c: 'O', r: String(R), ang: '0' }],
      drives: [{ k: 'proj', p: 'B', ang: '0', v: String(u), a: '0' }],
    });
    expect(pick(res, 'v.O')).toBeCloseTo((u * R) / (R - r), 12);
  });
  it('подвижность и сообщения', () => {
    const cr = MECH_PRESETS.m1615.problem as MechProblem;
    expect(solveMech(cr).dof).toBe(1);
    expect(solveMech(MECH_PRESETS.m1621.problem as MechProblem).dof).toBe(1);
    const under = solveMech({ ...cr, drives: [] });
    expect(under.ok).toBe(false);
    const over = solveMech({ ...cr, drives: [...cr.drives, { k: 'proj', p: 'B', ang: '0', v: '5', a: '0' }] });
    expect(over.errors.join()).toMatch(/противоречат/);
    const free = solveMech({ ...cr, cons: [{ k: 'fixed', p: 'O' }] });
    expect(free.errors.join()).toMatch(/не определён/);
    expect(solveMech({ ...cr, points: [...cr.points, { name: 'X', def: { k: 'two', p1: 'O', L1: '1', p2: 'B', L2: '1', side: 1 } }] }).errors.join()).toMatch(/не пересекаются/);
  });
});

import { MechStore, parseMech } from '../src/modules/mechanism/ui/store';
import { renderMech } from '../src/modules/mechanism/draw/mech';
import { mechDoc } from '../src/modules/mechanism/text/solution';
import type { MechPresetKey } from '../src/modules/mechanism/presets';

describe('плоский механизм: файл, чертёж, текст, редактор', () => {
  for (const key of Object.keys(MECH_PRESETS) as MechPresetKey[])
    it(`${key}: файл туда-обратно, чертёж и решение без NaN`, () => {
      const s = new MechStore({ preset: key });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const s2 = new MechStore();
      expect(s2.importProject(text)).toBe(true);
      expect(s2.get().problem).toEqual(s.get().problem);
      const p = s.get().problem,
        r = solveMech(p);
      for (const x of [renderMech(p, r, 'v').svg, renderMech(p, r, 'a').svg, JSON.stringify(mechDoc(p, r, { explain: true }))]) expect(x).not.toMatch(/NaN|undefined|Infinity/);
    });
  it('переименование точки и звена меняет ссылки', () => {
    const s = new MechStore({ preset: 'm1615' });
    s.renamePoint(1, 'K');
    s.renameBody(1, 'шатун');
    const p = s.get().problem;
    expect(p.bodies.map((b) => b.pts.join())).toEqual(['O,K', 'K,B,M']);
    expect(p.points.find((q) => q.name === 'B')!.def).toMatchObject({ from: 'K' });
    expect(solveMech(p).ok).toBe(true);
    expect(solveMech(p).bodies.find((b) => b.name === 'шатун')!.omega).toBeCloseTo(-1.2 * Math.PI, 9);
    s.undo();
    s.undo();
    expect(s.get().preset).toBe('m1615');
  });
  it('правка элементов и отмена', () => {
    const s = new MechStore({ preset: 'm1615' });
    s.addPoint();
    s.addBody();
    s.toggleBodyPt(2, 'M');
    s.addCons('slider');
    s.addDrive('proj');
    expect(solveMech(s.get().problem).errors.join()).toMatch(/противоречат|не определён|точка/i);
    for (let i = 0; i < 5; i++) s.undo();
    expect(solveMech(s.get().problem).ok).toBe(true);
  });
  it('чужой файл и испорченный механизм', () => {
    expect(new MechStore().importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'gears', problem: {} }))).toBe(false);
    expect(parseMech({ points: [{ name: 'A', def: { k: 'zzz' } }], bodies: [], cons: [], drives: [] }).ok).toBe(false);
  });
});
