/** Удар и колебания, пункт 22: готовые задачи с обратными задачами, опытами, рычагами — ответы книги и формулы. */
import { describe, expect, it } from 'vitest';
import { INV_BASE, solveExperiment, solveInverse, type Inverse } from '../src/modules/oscillation/model/inverse';
import { solveOsc } from '../src/modules/oscillation/model/osc';
import { resonanceOf } from '../src/modules/oscillation/model/resonance';
import { OSC_PRESETS, type OscPreset } from '../src/modules/oscillation/presets';

const invOf = (p: OscPreset): Inverse => ({ ...INV_BASE, ...(p.inv ?? {}), exp: { ...INV_BASE.exp, ...(p.inv?.exp ?? {}) }, on: true }) as Inverse;

describe('обратные задачи: ответы книги', () => {
  for (const [key, p] of Object.entries(OSC_PRESETS as Record<string, OscPreset>).filter(([, x]) => x.bookInv))
    it(`${key}: ${p.title}`, () => {
      const inv = invOf(p);
      let found: number[];
      if (inv.kind === 'param') {
        const r = solveInverse(p.problem, inv);
        expect(r.ok, r.errors.join()).toBe(true);
        found = r.roots;
        // подстановка найденного значения даёт измеренную: решается прямая задача
        expect(r.check!).toBeCloseTo(inv.value, 5);
      } else {
        const e = solveExperiment(p.problem, inv);
        expect(e.ok).toBe(true);
        found = [inv.kind === 'g2' ? e.vals.g * 1 : e.vals.J];
      }
      const want = p.bookInv!.values;
      expect(found.length, `корней: ${found}`).toBe(want.length);
      want.forEach((w, i) => expect(Math.abs(found[i] - w) / w, `${found[i]} против ${w}`).toBeLessThan(p.bookInv!.relTol));
    });
});

describe('рычажные системы и пружина под балкой', () => {
  it('32.72: k² = cb²g/(Pl²), n = αb²g/(2Pl²), апериодичность при α ≥ 2(l/b)√(cP/g)', () => {
    const r = solveOsc(OSC_PRESETS.m3272.problem);
    const g = 981,
      P = 2,
      c = 5,
      a = 0.1,
      b = 20,
      l = 40;
    expect(r.k ** 2).toBeCloseTo((c * b * b * g) / (P * l * l), 8);
    expect(r.n).toBeCloseTo((a * b * b * g) / (2 * P * l * l), 8);
    const acr = 2 * (l / b) * Math.sqrt((c * P) / g);
    const crit = solveOsc({ ...OSC_PRESETS.m3272.problem, damp: { ...OSC_PRESETS.m3272.problem.damp, b: acr } });
    expect(crit.regime).toBe('critical');
  });
  it('32.74: k² = cl²g/(Pb²), n = αg/(2P)', () => {
    const r = solveOsc(OSC_PRESETS.m3274.problem);
    expect(r.k ** 2).toBeCloseTo((0.5 * 40 * 40 * 981) / (2 * 20 * 20), 8);
    expect(r.n).toBeCloseTo((0.1 * 981) / (2 * 2), 8);
  });
  it('32.37: c = c₁(c₂ + c₃)/(c₁ + c₂ + c₃)', () => {
    expect(solveOsc(OSC_PRESETS.m3237.problem).c).toBeCloseTo(1.6, 12);
  });
  it('32.42: пружина под балкой — последовательно, ветви параллельны', () => {
    const p = OSC_PRESETS.m3242.problem;
    const r = solveOsc(p);
    const cb = (48 * 2.1e6 * 80) / 1000 ** 3;
    expect(r.c).toBeCloseTo(1 + 1 / (1 / cb + 1 / 2), 9);
    const sol = solveInverse(p, invOf(OSC_PRESETS.m3242));
    expect(solveOsc(sol.problem!).T0).toBeCloseTo(1, 8);
  });
});

describe('возмущения: готовые задачи и формулы книги', () => {
  it('53.37: половинная ширина — точная и приближённая 2√3ζ', () => {
    const rs = resonanceOf(solveOsc(OSC_PRESETS.m5337.problem), 'H')!;
    expect(rs.zeta).toBeCloseTo(0.05, 12);
    expect(rs.half!.width).toBeCloseTo(0.1744, 3);
    expect(rs.half!.approx).toBeCloseTo(2 * Math.sqrt(3) * 0.05, 12);
    // на концах — половина амплитуды при z = 1
    const eta = (z: number) => 1 / Math.hypot(1 - z * z, 2 * 0.05 * z);
    expect(eta(rs.half!.z1) / eta(1)).toBeCloseTo(0.5, 9);
    expect(eta(rs.half!.z2) / eta(1)).toBeCloseTo(0.5, 9);
  });
  it('53.38: относительная амплитуда вибрографа φ = 0,0051', () => {
    const r = solveOsc(OSC_PRESETS.m5338.problem);
    expect(Math.abs(r.forced!.B!)).toBeCloseTo(0.0051, 4);
    expect(r.forced!.rel!).toBeCloseTo(Math.abs(r.forced!.B!) / 0.2, 12);
  });
  it('53.39: граница апериодичности — tg ε = 2kp/(k² − p²)', () => {
    const r = solveOsc(OSC_PRESETS.m5339.problem);
    const f = r.forced!;
    expect(r.regime).toBe('critical');
    expect(Math.tan(f.eps)).toBeCloseTo((2 * r.k * f.p) / (r.k ** 2 - f.p ** 2), 9);
  });
  it('37.38: диск под моментом — решение книги', () => {
    const r = solveOsc(OSC_PRESETS.m3738.problem);
    const k = r.k,
      p = 3,
      h = 0.5 / (0.3 / 9.81),
      w0 = 0.8;
    const t = 0.6;
    expect(r.x(t)).toBeCloseTo((w0 / k) * Math.sin(k * t) + (h / (k * k - p * p)) * (Math.sin(p * t) - (p / k) * Math.sin(k * t)), 9);
    // k² = 2g/(3r): P·(r/2)/J = c·g/P_экв, с эквивалентными единицами из примера (c = 1 кГ/м, вес 0,3 кГ)
    expect(k * k).toBeCloseTo((1 * 9.81) / 0.3, 9);
  });
  it('32.62: b = 2mn, k = b/(2S) совпадает с формулой книги', () => {
    const r = solveOsc(OSC_PRESETS.m3262.problem);
    const T1 = 0.4,
      T2 = 0.5,
      P = 3,
      g = 981;
    // b/(2S) = (πP/(g S T₁T₂))√(T₂² − T₁²) ⇒ b = 2πP√(T₂² − T₁²)/(g T₁T₂)
    expect(r.b).toBeCloseTo((2 * Math.PI * P * Math.sqrt(T2 * T2 - T1 * T1)) / (g * T1 * T2), 9);
  });
  it('32.83: критическая скорость вагона', () => {
    const r = solveOsc(OSC_PRESETS.m3283.problem);
    expect(r.rail!.vCrit).toBeCloseTo(1200 / r.T0, 9);
  });
});

describe('текст решения и файл проекта', () => {
  it('у каждой готовой задачи решение строится без NaN и «undefined»', async () => {
    const { oscDoc } = await import('../src/modules/oscillation/text/solution');
    const { expStep, invStep } = await import('../src/modules/oscillation/text/inverse');
    const { docHTML } = await import('../src/shared/doc');
    for (const [key, p] of Object.entries(OSC_PRESETS as Record<string, OscPreset>)) {
      let pr = p.problem;
      const steps = [];
      if (p.inv) {
        const inv = invOf(p);
        if (inv.kind === 'param') {
          const res = solveInverse(pr, inv);
          steps.push(invStep(pr, inv, res));
          if (res.ok) pr = res.problem!;
        } else steps.push(expStep(pr, inv, solveExperiment(pr, inv)));
      }
      const r = solveOsc(pr);
      const html = docHTML({ steps: [...steps, ...oscDoc(pr, r, { explain: true }).steps] });
      expect(html, key).not.toMatch(/NaN|undefined|Infinity/);
      expect(html.length).toBeGreaterThan(500);
    }
  });
  it('обратная задача сохраняется в файле проекта и восстанавливается', async () => {
    const { OscStore } = await import('../src/modules/oscillation/ui/store');
    const s = new OscStore({ preset: 'm5342' });
    expect(s.get().inv.on).toBe(true);
    s.typeInvValue(0.04);
    const { text } = s.exportProject(new Date(2026, 0, 1));
    const t = new OscStore();
    expect(t.importProject(text)).toBe(true);
    expect(t.get().inv).toEqual(s.get().inv);
    expect(t.get().inv.value).toBe(0.04);
    // старый файл без inv открывается с обратной задачей по умолчанию
    const old = JSON.parse(text);
    delete old.inv;
    const u = new OscStore();
    expect(u.importProject(JSON.stringify(old))).toBe(true);
    expect(u.get().inv.on).toBe(false);
    s.undo();
    expect(s.get().inv.value).toBe(0.05);
  });
});
