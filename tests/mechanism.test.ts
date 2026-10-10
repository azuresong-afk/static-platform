/** Плоский механизм: ответы Мещерского §16, 18 и независимые проверки. */
import { describe, expect, it } from 'vitest';
import { type MechProblem } from '../src/modules/mechanism/model/mech';
import { solveMech, type MechSolution } from '../src/modules/mechanism/model/solve';
import { MECH_PRESETS } from '../src/modules/mechanism/presets';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};
const hyp = (v: [number, number]) => Math.hypot(v[0], v[1]);

export function pick(r: MechSolution, key: string): number {
  const [k, a, b] = key.split('.');
  const P = (n: string) => r.points.find((p) => p.name === n)!;
  const B = (n: string) => r.bodies.find((p) => p.name === n)!;
  if (k === 'v') return hyp(P(a).v);
  if (k === 'a') return hyp(P(a).a);
  if (k === 'w') return Math.abs(B(a).omega);
  if (k === 'e') return Math.abs(B(a).eps);
  if (k === 'icrx') return B(a).icr![0];
  if (k === 'icry') return B(a).icr![1];
  if (k === 'rho') {
    const q = P(a);
    return hyp(q.v) ** 3 / Math.abs(q.v[0] * q.a[1] - q.v[1] * q.a[0]);
  }
  if (k === 'vr') return Math.abs(r.guides.find((g) => g.p === a)!.vr);
  if (k === 'ar') return Math.abs(r.guides.find((g) => g.p === a)!.ar);
  if (k === 'X') return r.forces!.X!;
  if (k === 'T') return r.forces!.T;
  if (k === 'W') return r.energy!.lam!;
  if (k === 'K') {
    const q = B(a).ica!,
      p = P(b).pos;
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return NaN;
}

describe('Мещерский §16, 18, 22, 23, 38, 46', () => {
  for (const [key, p] of Object.entries(MECH_PRESETS))
    it(p.title, () => {
      const r = solveMech(p.problem as MechProblem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      expect(r.extraErrors, key).toEqual([]);
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

const at = (key: MechPresetKey2, phi: number, patch: Partial<MechProblem> = {}) => {
  const pr = MECH_PRESETS[key].problem as MechProblem;
  return solveMech({ ...pr, param: { ...(pr.param ?? { from: '0', to: '360', val: '0' }), val: String(phi) }, ...patch });
};
type MechPresetKey2 = keyof typeof MECH_PRESETS;
const P = (r: MechSolution, n: string) => r.points.find((p) => p.name === n)!;

describe('кулисный камень: остальные положения и независимые проверки', () => {
  it('23.22–23.23: φ = 0, 180°, 270°', () => {
    const r0 = at('m2322', 0);
    expect(pick(r0, 'e.O1B')).toBeCloseTo(0, 9);
    expect(pick(r0, 'ar.A')).toBeCloseTo(154.3, 1);
    expect(r0.guides[0].vr).toBeCloseTo(0, 9);
    const r180 = at('m2322', 180);
    expect(r180.guides[0].ar).toBeCloseTo(1080, 6);
    const r270 = at('m2322', 270);
    const k = r270.bodies.find((b) => b.name === 'O1B')!;
    expect(Math.abs(k.eps)).toBeCloseTo(1.2096, 4);
    expect(Math.sign(k.eps)).toBe(-Math.sign(k.omega)); // вращение замедленное
  });
  it('кориолисово ускорение: ускорения = производные скоростей по времени (численно по φ)', () => {
    for (const key of ['m2322', 'm2221', 'm1627', 'm2325'] as MechPresetKey2[])
      for (const phi of [23, 137, 251]) {
        const r = at(key, phi),
          h = 1e-4;
        const rp = at(key, phi + h),
          rm = at(key, phi - h);
        // φ̇ — по любой подвижной точке: v = (dX/dφ)·φ̇.
        const name = r.points.filter((q) => !q.aux).sort((a, b) => hyp(b.v) - hyp(a.v))[0].name;
        const dX = (P(rp, name).pos[0] - P(rm, name).pos[0]) / ((2 * h * Math.PI) / 180),
          dY = (P(rp, name).pos[1] - P(rm, name).pos[1]) / ((2 * h * Math.PI) / 180);
        const pd = (P(r, name).v[0] * dX + P(r, name).v[1] * dY) / (dX * dX + dY * dY);
        for (const q of r.points.filter((x) => !x.aux)) {
          const ax = ((P(rp, q.name).v[0] - P(rm, q.name).v[0]) / ((2 * h * Math.PI) / 180)) * pd,
            ay = ((P(rp, q.name).v[1] - P(rm, q.name).v[1]) / ((2 * h * Math.PI) / 180)) * pd;
          const sc = Math.max(1, hyp(q.a));
          expect(Math.abs(ax - q.a[0]) / sc, `${key} φ=${phi} ${q.name}`).toBeLessThan(1e-5);
          expect(Math.abs(ay - q.a[1]) / sc, `${key} φ=${phi} ${q.name}`).toBeLessThan(1e-5);
        }
      }
  });
  it('22.21: нижнее положение и O₁A ⊥ кулисе', () => {
    expect(pick(at('m2221', 270), 'w.кулиса')).toBeCloseTo(1.5, 9);
    expect(pick(at('m2221', (Math.asin(-3 / 7) * 180) / Math.PI), 'w.кулиса')).toBeCloseTo(0, 9);
  });
  it('16.27: положения II, III; 23.25: w_x = 0 при φ = 0, 180°', () => {
    expect(pick(at('m1627', 180), 'v.B')).toBeCloseTo(10, 9);
    // Скорость скольжения штока и вращение вокруг O₁ (B не доходит до O₁ на AO₁ − 60).
    const d = Math.hypot(60, 12);
    expect(pick(at('m1627', 90), 'v.B')).toBeCloseTo(Math.hypot((60 * 60) / d, ((60 * 12) / d / d) * (d - 60)), 9);
    expect(pick(at('m2325', 0), 'a.M')).toBeCloseTo(0, 9);
    expect(pick(at('m2325', 180), 'a.M')).toBeCloseTo(0, 9);
  });
  it('кулиса, поступательно движущаяся (38.3): x кулисы = a cos φ', () => {
    const r = at('m383', 40);
    expect(P(r, 'K').v[0]).toBeCloseTo(-0.2 * 10 * Math.sin((40 * Math.PI) / 180), 12);
    expect(r.bodies.find((b) => b.name === 'кулиса')!.omega).toBe(0);
  });
});

describe('силы и массы: независимые проверки', () => {
  it('равновесие = принцип возможных перемещений по положениям (ΣF·dX/dφ = 0)', () => {
    for (const key of ['m468', 'm4610', 'm4613', 'm4614'] as MechPresetKey2[]) {
      const pr = MECH_PRESETS[key].problem as MechProblem;
      const r = solveMech(pr);
      const X = r.forces!.X!;
      // Подставляем найденное значение и проверяем мощность через производные положений по углу ведущего звена.
      const loads = pr.loads!.map((l) => (l.k !== 'hinge' && l.unknown ? (l.k === 'force' ? { ...l, F: String(X), unknown: false } : { ...l, M: String(X), unknown: false }) : l));
      const r2 = solveMech({ ...pr, loads });
      expect(Math.abs(r2.forces!.Pknown)).toBeLessThan(1e-9 * Math.max(1, Math.abs(X)));
    }
  });
  it('46.8: M = 2Pl cos φ для нескольких φ; 46.10: Q = Pl/(R cos²φ)', () => {
    for (const phi of [10, 45, 70]) {
      const f = (phi * Math.PI) / 180;
      expect(at('m468', phi).forces!.X).toBeCloseTo(2 * 100 * 0.5 * Math.cos(f), 9);
      expect(at('m4610', phi).forces!.X).toBeCloseTo((100 * 0.3) / (0.5 * Math.cos(f) ** 2), 9);
    }
  });
  it('кинетическая энергия = Σ m v²/2 по численным производным положений (38.5)', () => {
    for (const phi of [30, 110, 200]) {
      const r = at('m386', phi);
      // Шатун: T = m v_C²/2 + (m l²/12)ω²/2 — независимо через скорости концов.
      const A = P(r, 'A'),
        B = P(r, 'B');
      const wAB = r.bodies.find((b) => b.name === 'AB')!.omega;
      const vC = [(A.v[0] + B.v[0]) / 2, (A.v[1] + B.v[1]) / 2];
      const T = (3 * (0.2 * 10) ** 2) / 6 + (5 * hyp(B.v) ** 2) / 2 + (4 * (vC[0] ** 2 + vC[1] ** 2)) / 2 + ((4 * 0.64) / 12) * wAB ** 2 / 2;
      expect(r.forces!.T).toBeCloseTo(T, 10);
      expect(r.forces!.Jred).toBeCloseTo((2 * T) / 100, 10);
    }
    const m383 = solveMech({ ...(MECH_PRESETS.m383.problem as MechProblem) });
    expect(m383.plot!.max!.y).toBeCloseTo(15, 8);
    expect(m383.plot!.min!.y).toBeCloseTo(5, 8);
    expect([90, 270]).toContain(Math.round(m383.plot!.max!.x));
  });
  it('теорема об энергии: работа веса = −Σmg·Δy (точное значение по положениям), ход вперёд и назад', () => {
    const base = MECH_PRESETS.m386.problem as MechProblem;
    for (const [phi0, phi] of [
      [20, 160],
      [300, 200],
    ]) {
      const pr: MechProblem = { ...base, g: '9.81', param: { val: String(phi), from: '0', to: '360' }, energy: { phi0: String(phi0), w0: '6' } };
      const r = solveMech(pr);
      expect(r.extraErrors).toEqual([]);
      const r0 = solveMech({ ...pr, param: { ...pr.param!, val: String(phi0) } });
      const yC = (s: MechSolution) => 3 * (P(s, 'O').pos[1] + P(s, 'A').pos[1]) / 2 + 5 * P(s, 'B').pos[1] + 4 * (P(s, 'A').pos[1] + P(s, 'B').pos[1]) / 2;
      const A = -9.81 * (yC(r) - yC(r0));
      expect(r.energy!.A).toBeCloseTo(A, 8);
      expect(r.energy!.T).toBeCloseTo((r0.forces!.Jred! * 36) / 2 + A, 8);
      expect(r.energy!.lam!).toBeCloseTo(Math.sqrt((2 * r.energy!.T) / r.forces!.Jred!), 10);
    }
  });
  it('момент сопротивления в шарнире тормозит при движении в обе стороны', () => {
    const pr = MECH_PRESETS.m3850.problem as MechProblem;
    const fwd = solveMech({ ...pr, loads: [pr.loads![1]], energy: { phi0: '0', w0: '3' }, param: { ...pr.param!, val: '60' } });
    const back = solveMech({ ...pr, loads: [pr.loads![1]], energy: { phi0: '60', w0: '3' }, param: { ...pr.param!, val: '0' } });
    expect(fwd.energy!.Afric).toBeCloseTo((-1 * 2 * 60 * Math.PI) / 180, 8);
    expect(back.energy!.Afric).toBeCloseTo((-1 * 2 * 60 * Math.PI) / 180, 8);
    expect(fwd.energy!.T).toBeLessThan(fwd.energy!.T0);
  });
  it('график ω по теореме об энергии сходится с точным значением в конце', () => {
    const r = solveMech(MECH_PRESETS.m3849.problem as MechProblem);
    const last = r.plot!.ys[r.plot!.ys.length - 1]!;
    expect(last).toBeCloseTo(Math.sqrt(3 * Math.PI), 6);
    expect(r.plot!.ys[0]).toBe(0);
  });
  it('сообщения: две неизвестные, неизвестная без работы, подвижность 2, φ без параметра', () => {
    const pr = MECH_PRESETS.m468.problem as MechProblem;
    expect(solveMech({ ...pr, loads: [...pr.loads!, { k: 'couple', b: 'AB', M: '0', unknown: true }] }).extraErrors.join()).toMatch(/только одна/);
    // При φ = 90° ползун A (на оси y) неподвижен — сила вдоль его направляющей работы не совершает.
    expect(solveMech({ ...pr, param: { ...pr.param!, val: '90' }, loads: [{ k: 'force', p: 'B', F: '100', ang: '0', ref: '', ref2: '', unknown: false }, { k: 'force', p: 'A', F: '0', ang: '90', ref: '', ref2: '', unknown: true }] }).extraErrors.join()).toMatch(/не совершает работы/);
    const ap = MECH_PRESETS.m4613.problem as MechProblem;
    const two = solveMech({ ...ap, cons: [{ k: 'fixed', p: 'A' }, { k: 'slider', p: 'D', ang: '0' }], drives: [...ap.drives, { k: 'omega', b: 'CD', w: '1', e: '0' }] });
    expect(two.dof).toBe(2);
    expect(two.extraErrors.join()).toMatch(/одной степенью свободы/);
    const noParam = solveMech({ ...pr, param: null });
    expect(noParam.ok).toBe(false);
    expect(noParam.errors.join()).toMatch(/параметр положения/);
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
