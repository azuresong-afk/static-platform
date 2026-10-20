/** «Плоский механизм»: законы движения по времени — подстановка законов и производных, сверка с производными положений. */
import { describe, expect, it } from 'vitest';
import { type MechProblem } from '../src/modules/mechanism/model/mech';
import { solveMech } from '../src/modules/mechanism/model/solve';
import { MECH_PRESETS } from '../src/modules/mechanism/presets';
import { mechDoc } from '../src/modules/mechanism/text/solution';
import { MechStore, parseMech } from '../src/modules/mechanism/ui/store';
import { docText } from './helpers/doctext';

/** Мещерский 16.6–16.7, 18.5–18.6: два диска радиуса r на шарнире A; углы φ, ψ — от нижней вертикали против часовой. */
const discs = (r: number, phi: string, psi: string, t: number): MechProblem => ({
  points: [
    { name: 'O', def: { k: 'xy', x: '0', y: '0' } },
    { name: 'A', def: { k: 'polar', from: 'O', L: String(r), ang: '-90 + φ' } },
    { name: 'C', def: { k: 'polar', from: 'A', L: String(r), ang: '-90 + ψ' } },
    { name: 'B', def: { k: 'polar', from: 'A', L: String(r * Math.SQRT2), ang: '-90 + 45 + ψ' } },
  ],
  bodies: [
    { name: 'I', pts: ['O', 'A'] },
    { name: 'II', pts: ['A', 'C', 'B'] },
  ],
  cons: [{ k: 'fixed', p: 'O' }],
  drives: [
    { k: 'omega', b: 'I', w: "φ'", e: "φ''" },
    { k: 'omega', b: 'II', w: "ψ'", e: "ψ''" },
  ],
  time: {
    t: String(t),
    from: '0',
    to: '3',
    laws: [
      { name: 'φ', f: phi, kind: 'angle' },
      { name: 'ψ', f: psi, kind: 'angle' },
    ],
  },
});

describe('Мещерский 16.6–16.7, 18.5–18.6 (законы φ(t), ψ(t) — в общем виде; проверка на примере)', () => {
  const r = 1.5,
    t = 0.7;
  // φ = t², ψ = sin 2t.
  const f = t * t,
    f1 = 2 * t,
    f2 = 2,
    p = Math.sin(2 * t),
    p1 = 2 * Math.cos(2 * t),
    p2 = -4 * Math.sin(2 * t);
  const sol = solveMech(discs(r, 't^2', 'sin(2t)', t));
  const P = (n: string) => sol.points.find((q) => q.name === n)!;
  it('решение без ошибок и предупреждений', () => {
    expect(sol.ok, sol.errors.join()).toBe(true);
    expect(sol.extraErrors).toEqual([]);
  });
  it('16.6: v_C = r(φ̇ cos φ + ψ̇ cos ψ; φ̇ sin φ + ψ̇ sin ψ)', () => {
    expect(P('C').v[0]).toBeCloseTo(r * (f1 * Math.cos(f) + p1 * Math.cos(p)), 9);
    expect(P('C').v[1]).toBeCloseTo(r * (f1 * Math.sin(f) + p1 * Math.sin(p)), 9);
  });
  it('18.5: a_C = r(φ̈ cos φ − φ̇² sin φ + ψ̈ cos ψ − ψ̇² sin ψ; φ̈ sin φ + φ̇² cos φ + ψ̈ sin ψ + ψ̇² cos ψ)', () => {
    expect(P('C').a[0]).toBeCloseTo(r * (f2 * Math.cos(f) - f1 ** 2 * Math.sin(f) + p2 * Math.cos(p) - p1 ** 2 * Math.sin(p)), 9);
    expect(P('C').a[1]).toBeCloseTo(r * (f2 * Math.sin(f) + f1 ** 2 * Math.cos(f) + p2 * Math.sin(p) + p1 ** 2 * Math.cos(p)), 9);
  });
  it('16.7, 18.6: точка B (∠ACB = π/2) — формулы книги с √2 и 45° + ψ', () => {
    const q = Math.PI / 4 + p;
    expect(P('B').v[0]).toBeCloseTo(r * (f1 * Math.cos(f) + Math.SQRT2 * p1 * Math.cos(q)), 9);
    expect(P('B').v[1]).toBeCloseTo(r * (f1 * Math.sin(f) + Math.SQRT2 * p1 * Math.sin(q)), 9);
    expect(P('B').a[0]).toBeCloseTo(r * (f2 * Math.cos(f) - f1 ** 2 * Math.sin(f) + Math.SQRT2 * (p2 * Math.cos(q) - p1 ** 2 * Math.sin(q))), 9);
    expect(P('B').a[1]).toBeCloseTo(r * (f2 * Math.sin(f) + f1 ** 2 * Math.cos(f) + Math.SQRT2 * (p2 * Math.sin(q) + p1 ** 2 * Math.cos(q))), 9);
  });
  it('текст: законы, производные формулами, значения', () => {
    const txt = docText(mechDoc(discs(r, 't^2', 'sin(2t)', t), sol));
    expect(txt).toMatch(/Законы движения в момент t/);
    expect(txt).toMatch(/φ\(t\) = t\^2  →  φ = 0,49 рад = 28,0749°/);
    expect(txt).toMatch(/φ' = 2t = 1,4 рад\/с/);
    expect(txt).toMatch(/ψ'' = −4sin\(2t\) = −3,9418 рад\/с²/);
    expect(txt).toMatch(/ωI = φ' = 1,4 рад\/с \(задана\)/);
    expect(txt).toMatch(/εII = ψ'' = −3,9418 \(задано\)/);
  });
});

describe('сверка с законами и ошибки', () => {
  const base = MECH_PRESETS.m163.problem as MechProblem;
  it('ведущие не согласуются с законами — предупреждение (скорость и ускорение)', () => {
    // При t = 1 с φ' = 0, поэтому ошибку в ω видно в другой момент — берём t = 0,5 с.
    const atHalf: MechProblem = { ...base, time: { ...base.time!, t: '0,5' } };
    expect(solveMech(atHalf).extraErrors).toEqual([]);
    expect(solveMech({ ...atHalf, drives: [base.drives[0], { k: 'omega', b: 'CA', w: "2φ'", e: "φ''" }] }).extraErrors.join()).toMatch(
      /Скорость точки A не согласуется/,
    );
    expect(solveMech({ ...base, drives: [base.drives[0], { k: 'omega', b: 'CA', w: "φ'", e: '0' }] }).extraErrors.join()).toMatch(
      /Ускорение точки A не согласуется/,
    );
  });
  it('положение от t не зависит (t только в ведущих) — сверять не с чем, предупреждения нет', () => {
    const pr: MechProblem = {
      ...base,
      points: [
        { name: 'C', def: { k: 'xy', x: '0', y: '0' } },
        { name: 'A', def: { k: 'polar', from: 'C', L: '12', ang: '-60' } },
      ],
      drives: [
        { k: 'proj', p: 'C', ang: '0', v: '4t', a: '4' },
        { k: 'omega', b: 'CA', w: '2t', e: '2' },
      ],
    };
    const r = solveMech(pr);
    expect(r.ok).toBe(true);
    expect(r.extraErrors).toEqual([]);
    expect(r.bodies[0].omega).toBeCloseTo(2, 12);
  });
  it('ошибки ввода: имя закона, повтор, формула, момент t, неизвестное имя в поле', () => {
    const laws = base.time!.laws;
    const err = (time: Partial<NonNullable<MechProblem['time']>>, pr: Partial<MechProblem> = {}) =>
      solveMech({ ...base, ...pr, time: { ...base.time!, ...time } }).errors.join(' ');
    expect(err({ laws: [...laws, { name: 'sin', f: 't', kind: 'angle' }] })).toMatch(/имя занято/);
    expect(err({ laws: [...laws, { name: 'φ', f: 't', kind: 'angle' }] })).toMatch(/задан дважды/);
    expect(err({ laws: [...laws, { name: '1a', f: 't', kind: 'angle' }] })).toMatch(/имя — буква/);
    expect(err({ laws: [laws[0], { ...laws[1], f: 'sin(' }] })).toMatch(/Закон φ\(t\)/);
    expect(err({ t: 'x' })).toMatch(/Момент времени t — не число/);
    expect(err({ laws: [] })).toMatch(/хотя бы один закон/);
    expect(solveMech({ ...base, time: { ...base.time!, laws: [laws[0]] } }).ok).toBe(false);
  });
  it('график по t: ось времени, значение в текущий момент совпадает с решением', () => {
    const r = solveMech({ ...base, plot: 'v:A' });
    expect(r.plot).toMatchObject({ axis: 't', key: 'v:A' });
    expect(r.plot!.xs[0]).toBe(0);
    expect(r.plot!.xs[r.plot!.xs.length - 1]).toBe(4);
    expect(r.plot!.cur.y).toBeCloseTo(Math.hypot(...r.points.find((q) => q.name === 'A')!.v), 9);
    expect(docText(mechDoc({ ...base, plot: 'v:A' }, r))).toMatch(/при t ≈ [\d,]+ с/);
  });
});

describe('хранилище и файл', () => {
  it('законы и параметр φ взаимно исключают друг друга; закон добавляется и убирается; отмена', () => {
    const s = new MechStore({ preset: 'm1615' });
    s.setParam(true);
    s.setTime(true);
    expect(s.get().problem.param).toBeNull();
    expect(s.get().problem.time?.laws).toHaveLength(1);
    s.addLaw();
    expect(s.get().problem.time?.laws.map((l) => l.name)).toEqual(['φ', 'ψ']);
    s.removeLaw(0);
    expect(s.get().problem.time?.laws.map((l) => l.name)).toEqual(['ψ']);
    s.setParam(true);
    expect(s.get().problem.time).toBeNull();
    s.undo();
    expect(s.get().problem.time?.laws).toHaveLength(1);
  });
  it('файл: неверный закон — ошибка; законы сохраняются', () => {
    const raw = JSON.parse(JSON.stringify(MECH_PRESETS.m165.problem));
    expect(parseMech(raw)).toMatchObject({ ok: true, problem: { time: { t: '1' } } });
    raw.time.laws[0].kind = 'speed';
    expect(parseMech(raw).ok).toBe(false);
  });
});

describe('§15: уравнения плоского движения звеньев (угол φ(t), таблица x(t), y(t), φ(t))', () => {
  const P = MECH_PRESETS.m1511.problem as MechProblem;
  it('угол звена AB на графике — без скачков 2π и совпадает с книгой: φ = −2 arctg(a sin ωt/(b − a cos ωt))', () => {
    const sol = solveMech({ ...P, time: { ...P.time!, from: '0,02', to: '1,5', t: '0,7' } });
    expect(sol.extraErrors).toEqual([]);
    const pl = sol.plot!;
    expect(pl.key).toBe('ang:AB');
    for (let i = 1; i < pl.ys.length; i++) expect(Math.abs(pl.ys[i]! - pl.ys[i - 1]!)).toBeLessThan(0.5);
    pl.xs.forEach((t, i) => {
      if (i % 20) return;
      const w = 2 * t;
      const book = -2 * Math.atan((10 * Math.sin(w)) / (25 - 10 * Math.cos(w)));
      const d = pl.ys[i]! - book;
      expect(Math.abs(d - 2 * Math.PI * Math.round(d / (2 * Math.PI)))).toBeLessThan(1e-9);
    });
    expect(pl.cur.y).toBeCloseTo(-2 * Math.atan((10 * Math.sin(1.4)) / (25 - 10 * Math.cos(1.4))), 9);
  });
  it('угол в развёртке растёт при вращении против часовой стрелки, а не возвращается в (−π; π]', () => {
    const pr = MECH_PRESETS.m155.problem as MechProblem;
    const sol = solveMech({ ...pr, plot: 'w:AB', time: { ...pr.time!, to: '6' } });
    expect(sol.plot!.key).toBe('w:AB');
    // 15.5: шатун качается около горизонтали — угол остаётся малым, без скачков
    const w = solveMech({ ...pr, plot: 'ang:AB', time: { ...pr.time!, to: '6' } });
    expect(w.plot!.ys.every((y) => y != null && Math.abs(y) < 0.26)).toBe(true);
    // эллипсограф 15.1: φ = −ω₀t — монотонно убывает
    const e = MECH_PRESETS.m151.problem as MechProblem;
    const s2 = solveMech({ ...e, time: { ...e.time!, from: '0,01', to: '0,75' } });
    expect(s2.plot!.ys[0]).toBeCloseTo(-0.02, 9);
    expect(s2.plot!.ys[s2.plot!.ys.length - 1]).toBeCloseTo(-1.5, 9);
  });
  it('таблица уравнений движения: полюс — первая точка звена, 7 моментов, значения совпадают с книгой (15.1)', () => {
    const e = MECH_PRESETS.m151.problem as MechProblem;
    const e2 = { ...e, time: { ...e.time!, from: '0,05', to: '0,65' } };
    const sol = solveMech(e2);
    const m = sol.motion!.find((q) => q.body === 'AB')!;
    expect(m.pole).toBe('A');
    expect(m.rows.length).toBe(7);
    m.rows.forEach((q) => {
      expect(q.x).toBeCloseTo(0, 9);
      expect(q.y).toBeCloseTo(20 * Math.sin(2 * q.t), 9);
      expect(q.phi).toBeCloseTo(-2 * q.t, 9);
    });
    const txt = docText(mechDoc(e2, sol));
    expect(txt).toMatch(/Уравнения движения звена AB \(полюс A\)/);
    expect(txt).toMatch(/t = 0,05:\s+xA = 0,\s+yA = 1,9967,\s+φ = −0,1 рад/);
  });
  it('график по параметру φ тоже поддерживает угол звена', () => {
    const pr = MECH_PRESETS.m1819.problem as MechProblem;
    const sol = solveMech({ ...pr, param: { val: '30', from: '0', to: '720' }, plot: 'ang:BC' });
    expect(sol.plot).not.toBeNull();
  });
});
