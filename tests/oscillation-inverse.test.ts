/** Удар и колебания: обратные задачи (поиск параметра по измеренной величине) и опыты — ответы Мещерского. */
import { describe, expect, it } from 'vitest';
import { INV_BASE, solveExperiment, solveInverse, type Inverse } from '../src/modules/oscillation/model/inverse';
import { newElem } from '../src/modules/oscillation/model/elastic';
import { solveOsc } from '../src/modules/oscillation/model/osc';
import { halfWidth, resonanceOf } from '../src/modules/oscillation/model/resonance';
import { osc } from '../src/modules/oscillation/presets';

const inv = (o: Partial<Inverse>): Inverse => ({ ...INV_BASE, on: true, ...o });
const beam = (E: number, J: number, l: number, scheme: 'ss-mid' | 'cant') => ({ ...newElem('beam'), scheme, E, J, l });

describe('обратные задачи', () => {
  it('32.41: длина балки по периоду T = 1 с — 15,9 м', () => {
    const pr = osc({ force: 'kG', m: 50, el: { mode: 'elems', stages: [{ items: [beam(2.1e6, 80, 1000, 'ss-mid')] }] } });
    const r = solveInverse(pr, { unknown: 'l', target: 'T0', value: 1, pick: 0 });
    expect(r.ok).toBe(true);
    expect(r.roots).toHaveLength(1);
    expect(r.value / 100).toBeCloseTo(15.9, 1);
    expect(solveOsc(r.problem!).T0).toBeCloseTo(1, 9);
  });

  it('53.34: модуль упругости консоли по периоду', () => {
    const E = 2.05e6;
    const make = (e: number) => osc({ force: 'kG', m: 100, el: { mode: 'elems', stages: [{ items: [beam(e, 50, 100, 'cant')] }] } });
    const T = solveOsc(make(E)).T0;
    const r = solveInverse(make(1e6), { unknown: 'E', target: 'T0', value: T, pick: 0 });
    expect(r.value / E).toBeCloseTo(1, 9);
    // E = c l³/(3J) = m(2π/T)² l³/(3J)
    const m = 100 / 981;
    expect(r.value).toBeCloseTo((m * ((2 * Math.PI) / T) ** 2 * 100 ** 3) / (3 * 50), 3);
  });

  it('32.96: сопротивление, при котором наибольшая амплитуда втрое больше H/c', () => {
    const pr = osc({ force: 'kG', m: 6, el: { mode: 'c', c: 18 }, damp: { mode: 'b', b: 0.01 }, exc: { mode: 'H', H: 1, p: 50 } });
    const r = solveInverse(pr, { unknown: 'b', target: 'etaMax', value: 3, pick: 0 });
    expect(r.ok).toBe(true);
    // книга: 0,115 кГ·с/см, z = 0,97, ε = 79°48′; точно n/k = 0,1691 ⇒ b = 0,1122, z = 0,971, ε = 80°06′
    expect(r.value).toBeCloseTo(0.1122, 3);
    const s = solveOsc(r.problem!);
    expect(s.forced!.pStar! / s.k).toBeCloseTo(0.97, 2);
    const q = solveOsc({ ...r.problem!, exc: { ...r.problem!.exc, p: s.forced!.pStar! } });
    expect((q.forced!.eps * 180) / Math.PI).toBeCloseTo(80.1, 1);
  });

  it('32.100: жёсткость, при которой сдвиг фазы π/2 — 40 Г/см', () => {
    const pr = osc({ force: 'G', m: 200, el: { mode: 'c', c: 20 }, damp: { mode: 'b', b: 50 }, exc: { mode: 'H', H: 0.2, p: 14 } });
    const r = solveInverse(pr, { unknown: 'c', target: 'eps', value: 90, pick: 0 });
    expect(r.value).toBeCloseTo((200 / 981) * 196, 6);
    expect(r.value).toBeCloseTo(40, 0);
  });

  it('53.41: вес фундамента, чтобы амплитуда не превосходила 0,25 мм — 366,6 т', () => {
    // Q = 10 т, S = 100 м², λ = 50 т/м³ ⇒ c = 5000 т/м; H = (P/g)rω², ω = 240 об/мин; приближение без члена r/l
    const w = (240 * Math.PI) / 30;
    const H = (0.25 / 9.81) * 0.3 * w * w;
    const pr = osc({ force: 't', len: 'm', m: 100, el: { mode: 'c', c: 5000 }, exc: { mode: 'H', H, p: w } });
    const r = solveInverse(pr, { unknown: 'm', target: 'B', value: 0.00025, pick: 0 });
    // второй корень (под резонансом) отрицателен — остаётся один: полный вес 377,7 т, фундамента 367,7 т (книга 366,6 т)
    expect(r.roots).toHaveLength(1);
    const big = r.roots[0];
    expect(big - 10).toBeCloseTo(366.6, -1);
    expect(Math.abs(big - 10 - 366.6) / 366.6).toBeLessThan(0.005);
  });

  it('53.42: момент инерции балок мотора — два значения (до и после резонанса)', () => {
    // 2 консоли l = 150 см, E = 2·10⁶, Q = 1200 кГ, n = 1500 об/мин, ротор p = 200 кГ на e = 0,005 см, B ≤ 0,05 см
    const w = (1500 * Math.PI) / 30;
    const mk = (J: number) =>
      osc({
        force: 'kG',
        m: 1200,
        el: { mode: 'elems', stages: [{ items: [beam(2e6, J, 150, 'cant'), beam(2e6, J, 150, 'cant')] }] },
        exc: { mode: 'rotor', m0: 200, e: 0.005, p: w },
      });
    const first = mk(8000);
    // неизвестная «J» ищется только у одного элемента — для двух параллельных балок используем жёсткость c = 2·3EJ/l³
    const r = solveInverse({ ...first, el: { ...first.el, mode: 'c', c: 1 } }, { unknown: 'c', target: 'B', value: 0.05, pick: 0 });
    expect(r.roots).toHaveLength(2);
    const J = r.roots.map((c) => (c * 150 ** 3) / (6 * 2e6));
    // книга: 8740 и 8480 см⁴; расчёт с H = m₀ep²: 8347 и 8630 (расхождение 1,3–1,6 %)
    expect(J[0]).toBeGreaterThan(8300);
    expect(J[1]).toBeLessThan(8700);
    expect(J[0]).toBeCloseTo(8347, -1);
    expect(J[1]).toBeCloseTo(8630, -1);
  });

  it('недостижимое значение — сообщение, а не падение', () => {
    const pr = osc({ force: 'kG', m: 1, el: { mode: 'c', c: 1 } });
    expect(solveInverse(pr, { unknown: 'c', target: 'B', value: 1, pick: 0 }).ok).toBe(false);
    expect(solveInverse(pr, { unknown: 'l', target: 'T0', value: 1, pick: 0 }).ok).toBe(false);
    expect(solveInverse(pr, { unknown: 'c', target: 'T0', value: NaN, pick: 0 }).ok).toBe(false);
  });
});

describe('опыты', () => {
  it('37.17: J_z = J_д(T₁/T₂)² = 0,117 кГ·см·с²', () => {
    const pr = osc({ force: 'kG', len: 'cm', gms: 9.81 });
    // 100 размахов за 2 мин: полупериод 1,2 с, период 2,4 с; диск — размах 1,5 с, период 3 с
    const r = solveExperiment(pr, inv({ kind: 'jref', exp: { ...INV_BASE.exp, P: 1.6, r: 15, Tr: 3, T1: 2.4 } }));
    expect(r.vals.J).toBeCloseTo(0.117, 3);
  });

  it('37.18: J = J_д T₁²/(T₂² − T₁²)', () => {
    const pr = osc({ force: 'kG', len: 'cm', gms: 9.81 });
    const Jd = (2 * 15 * 15) / (2 * 981);
    const J = 0.3;
    const c = J * ((2 * Math.PI) / 2) ** 2;
    const T2 = (2 * Math.PI) / Math.sqrt(c / (J + Jd));
    const r = solveExperiment(pr, inv({ kind: 'jadd', exp: { ...INV_BASE.exp, P: 2, r: 15, T1: 2, T2 } }));
    expect(r.vals.J).toBeCloseTo(J, 9);
  });

  it('32.47: g по двум опытам', () => {
    const pr = osc({});
    const g = 981,
      ma = 0.002,
      c = 3;
    const T = (P: number) => 2 * Math.PI * Math.sqrt((P / g + ma) / c);
    const P1 = 6,
      P2 = 15;
    const r = solveExperiment(pr, inv({ kind: 'g2', exp: { ...INV_BASE.exp, d1: P1 / c, d2: P2 / c, T1: T(P1), T2: T(P2), P1, P2 } }));
    expect(r.vals.g).toBeCloseTo(g, 6);
    expect(r.vals.c).toBeCloseTo(c, 9);
    expect(r.vals.ma).toBeCloseTo(ma, 9);
  });

  it('37.19: бифиляр T = (2πa/b)√(l/3g)', () => {
    const pr = osc({ force: 'kG', len: 'cm', gms: 9.81 });
    const e = { ...INV_BASE.exp, P: 2, a: 40, b: 10, l: 90 };
    const r = solveExperiment(pr, inv({ kind: 'bifilar', exp: e }));
    expect(r.vals.T).toBeCloseTo(((2 * Math.PI * 40) / 10) * Math.sqrt(90 / (3 * 981)), 9);
  });
});

describe('резонансная кривая', () => {
  it('половинная ширина (53.37): Δ ≈ 2√3·ζ при малом ζ', () => {
    const h = halfWidth(0.1)!;
    expect(halfWidth(0.001)!.width / halfWidth(0.001)!.approx).toBeCloseTo(1, 3);
    // на концах амплитуда равна половине резонансной
    const eta = (z: number, ze: number) => 1 / Math.hypot(1 - z * z, 2 * ze * z);
    expect(eta(h.z1, 0.1) / eta(1, 0.1)).toBeCloseTo(0.5, 9);
    expect(eta(h.z2, 0.1) / eta(1, 0.1)).toBeCloseTo(0.5, 9);
  });

  it('максимум кривой: z* = √(1 − 2ζ²), высота 1/(2ζ√(1 − ζ²))', () => {
    const pr = osc({ force: 'kG', m: 2, el: { mode: 'c', c: 4 }, damp: { mode: 'b', b: 0.5 * Math.sqrt((4 * 2) / 981) }, exc: { mode: 'H', H: 12, p: 30 } });
    const res = resonanceOf(solveOsc(pr), 'H')!;
    const top = res.curve.reduce((a, q) => (q.eta > a.eta ? q : a));
    expect(top.z).toBeCloseTo(res.zStar!, 1);
    expect(top.eta).toBeCloseTo(res.etaMax!, 2);
  });
});
