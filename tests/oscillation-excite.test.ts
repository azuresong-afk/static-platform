/** Удар и колебания: новые возмущения (a·t, F₀e^{−βt}, импульс, кулачок, две гармоники, основание) — сверка с формулами. */
import { describe, expect, it } from 'vitest';
import { solveOsc } from '../src/modules/oscillation/model/osc';
import { osc } from '../src/modules/oscillation/presets';

// Единицы: Н, м; m = 2 кг (вес 2·g), c = 800 Н/м ⇒ k = 20 с⁻¹.
const base = { force: 'N', len: 'm', byWeight: false, orient: 'h', m: 2, el: { mode: 'c', c: 800 } } as const;
const mk = (o: Parameters<typeof osc>[0]) => osc({ ...base, ...o, el: { ...base.el, ...(o.el ?? {}) } } as Parameters<typeof osc>[0]);
const k = 20;

describe('возмущения общего вида — аналитика и интегрирование', () => {
  it('32.76: сила a·t, x = (a/c)(t − sin kt / k)', () => {
    const r = solveOsc(mk({ exc: { mode: 'ramp', H: 40 } }));
    expect(r.ok).toBe(true);
    for (const t of [0.05, 0.3, 0.77, 1.4]) expect(r.x(t)).toBeCloseTo((40 / 800) * (t - Math.sin(k * t) / k), 10);
    expect(r.check!).toBeLessThan(1e-6);
  });

  it('32.77: сила F₀e^{−βt}', () => {
    const F0 = 30,
      be = 7;
    const r = solveOsc(mk({ exc: { mode: 'exp', H: F0, beta: be } }));
    const h = F0 / 2;
    for (const t of [0.05, 0.3, 1.1])
      expect(r.x(t)).toBeCloseTo((h / (be * be + k * k)) * (Math.exp(-be * t) - Math.cos(k * t) + (be / k) * Math.sin(k * t)), 10);
    expect(r.check!).toBeLessThan(1e-6);
  });

  it('F₀e^{−βt}: совпадение β с корнем характеристического уравнения (множитель t, t²)', () => {
    // n = 5, k = 20: корни −5 ± 19,36i — комплексные, совпадения нет; берём апериодический случай n = 25
    const c = 800;
    const over = solveOsc(mk({ damp: { mode: 'n', n: 25 }, exc: { mode: 'exp', H: 10, beta: 25 - Math.sqrt(25 * 25 - 400) } }));
    expect(over.regime).toBe('over');
    expect(over.check!).toBeLessThan(1e-6);
    const crit = solveOsc(mk({ damp: { mode: 'n', n: 20 }, exc: { mode: 'exp', H: 10, beta: 20 } }));
    expect(crit.regime).toBe('critical');
    expect(crit.check!).toBeLessThan(1e-6);
    // двукратный корень: x = (h/2)t²e^{−20t}
    expect(crit.x(0.1)).toBeCloseTo((5 / 2) * 0.01 * Math.exp(-2) * 1, 8);
    expect(c).toBe(800);
  });

  it('53.46–53.47: сила действует время τ; наибольшее отклонение 0 при τ→0, √2·F/c при T/4, 2F/c при T/2', () => {
    const T = (2 * Math.PI) / k;
    const F = 16;
    const ratio = (tau: number) => solveOsc(mk({ exc: { mode: 'pulse', H: F, tau } })).trans!.ratio!;
    expect(ratio(T / 4)).toBeCloseTo(Math.SQRT2, 6);
    expect(ratio(T / 2)).toBeCloseTo(2, 6);
    // τ → 0 при S = Fτ: x_max = S/√(mc)
    const tau = T * 1e-4;
    const r = solveOsc(mk({ exc: { mode: 'pulse', H: 1 / tau, tau } }));
    expect(r.max.x).toBeCloseTo(1 / Math.sqrt(2 * 800), 4);
    expect(solveOsc(mk({ exc: { mode: 'pulse', H: F, tau: T / 4 } })).check!).toBeLessThan(1e-5);
  });

  it('53.49: нарастание F₀t/τ, затем F₀ — амплитуда (2F₀/(cкτ))·|sin(kτ/2)|', () => {
    const F0 = 24,
      tau = 0.3;
    const r = solveOsc(mk({ exc: { mode: 'ramphold', H: F0, tau } }));
    for (const t of [0.4, 0.9, 1.3]) expect(r.x(t)).toBeCloseTo((F0 / 800) * (1 - (Math.sin(k * t) - Math.sin(k * (t - tau))) / (k * tau)), 9);
    expect(r.check!).toBeLessThan(1e-5);
  });

  it('53.43: кулачок x₁ = a(1 − cos ωt) на 0 ≤ t ≤ 2π/ω, дальше свободные колебания', () => {
    const a = 0.02,
      w = 12,
      c1 = 300;
    const r = solveOsc(mk({ exc: { mode: 'cam', a, p: w, c1 } }));
    const m = 2;
    for (const t of [0.1, 0.3, 0.5]) {
      const ref = ((c1 * a) / (m * (k * k - w * w))) * (Math.cos(k * t) - Math.cos(w * t)) + ((c1 * a) / (m * k * k)) * (1 - Math.cos(k * t));
      expect(r.x(t)).toBeCloseTo(ref, 10);
    }
    expect(r.check!).toBeLessThan(1e-5);
    // после 2π/ω — свободные колебания с постоянной амплитудой
    const T2 = (2 * Math.PI) / w;
    const A1 = Math.hypot(r.x(T2 + 0.2), r.v(T2 + 0.2) / k),
      A2 = Math.hypot(r.x(T2 + 0.9), r.v(T2 + 0.9) / k);
    expect(A1).toBeCloseTo(A2, 10);
  });

  it('две гармоники: сумма решений от каждой (n = 0)', () => {
    const r = solveOsc(mk({ exc: { mode: 'two', H: 10, p: 8, delta: 0, H2: 4, p2: 31, delta2: 40 } }));
    const t = 0.37;
    const xs = (10 / 2 / (k * k - 64)) * Math.sin(8 * t) + (4 / 2 / (k * k - 31 * 31)) * Math.sin(31 * t + (40 * Math.PI) / 180);
    const hom = r.C1 * Math.cos(k * t) + r.C2 * Math.sin(k * t);
    expect(r.x(t)).toBeCloseTo(hom + xs, 10);
    expect(r.forced2).not.toBeNull();
    expect(r.check!).toBeLessThan(1e-6);
  });

  it('основание движется (виброграф): h = m a p², в относительных координатах', () => {
    const r = solveOsc(mk({ exc: { mode: 'support', a: 0.01, p: 60, mc: 0 } }));
    const f = r.forced!;
    expect(f.H).toBeCloseTo(2 * 0.01 * 3600, 9);
    // p ≫ k: относительная амплитуда ≈ амплитуда основания (сейсмограф)
    expect(f.rel!).toBeCloseTo(3600 / Math.abs(3600 - 400), 9);
    expect(f.abs!).toBeCloseTo(400 / Math.abs(400 - 3600), 9);
    expect(r.check!).toBeLessThan(1e-6);
  });

  it('критическая скорость: L/T₀', () => {
    const r = solveOsc(mk({ exc: { mode: 'H', L: 12 } }));
    expect(r.rail!.vCrit).toBeCloseTo((12 * k) / (2 * Math.PI), 10);
  });
});
