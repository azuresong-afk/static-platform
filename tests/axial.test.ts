/**
 * Растяжение-сжатие ступенчатого бруса: ручные эталоны (Антонов, задачи 1.1 и 1.2, схема 1) и сравнение
 * с независимым методом перемещений (конечные элементы бруса: жёсткость E·A/l, нагрев — узловые силы E·A·α·ΔT).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { solveBar, type Bar, type BarSolution } from '../src/modules/axial/model/bar';
import { gauss } from '../src/shared/gauss';
import { AXIAL_PRESETS } from '../src/modules/axial/presets';
import { axialDoc } from '../src/modules/axial/text/solution';
import { AxialStore, parseBar } from '../src/modules/axial/ui/store';
import { inlineText } from '../src/shared/doc';

const base = (over: Partial<Bar>): Bar => ({
  steps: [
    { l: 0.1, c: 3, dT: 0 },
    { l: 0.2, c: 2, dT: 0 },
    { l: 0.1, c: 1, dT: 0 },
  ],
  forces: [0, 200, 100, 0],
  supports: 'left',
  E: 2e5,
  alpha: 125e-7,
  areaMode: 'find',
  A: 1,
  sigmaAllow: 150,
  sigmaT: 240,
  ...over,
});
const ok = (b: Bar): BarSolution => {
  const r = solveBar(b);
  if (!r.ok) throw new Error(r.why);
  return r;
};

describe('Антонов, задача 1.1, схема 1 (группа 20, Z = 5): F1 = 100 кН, F2 = 40Z = 200 кН, заделка слева', () => {
  const r = ok(base({}));
  it('N = 300, 100, 0 кН', () => expect(r.steps.map((s) => s.N)).toEqual([300, 100, 0]));
  it('σ = 300/(3A), 100/(2A), 0 ⇒ A ≥ 10·100/150 = 6,667 см²', () => expect(r.A).toBeCloseTo(20 / 3, 10));
  it('реакция заделки −300 кН (влево)', () => expect(r.RA).toBeCloseTo(-300, 10));
  it('удлинение бруса: Σ N·l/(E·A)', () => {
    const A = 20 / 3;
    const dl = (10 * (300 * 0.1)) / (2e5 * 3 * A) + (10 * (100 * 0.2)) / (2e5 * 2 * A);
    expect(r.steps[2].u1).toBeCloseTo(dl * 1000, 10);
  });
});

describe('Антонов, задача 1.2, схема 1: обе заделки, участок 3A нагрет на 10 К, A = 6,67 см²', () => {
  const r = ok(base({ supports: 'both', areaMode: 'given', A: 6.67, steps: [{ l: 0.1, c: 3, dT: 10 }, { l: 0.2, c: 2, dT: 0 }, { l: 0.1, c: 1, dT: 0 }] }));
  it('R_B = −(Σ N0·l/(E·c) + α·ΔT·l·A/10)/Σ l/(E·c) = −92,86 кН', () => expect(r.RB).toBeCloseTo(-92.857, 2));
  it('N = 207,14; 7,14; −92,86 кН', () => r.steps.forEach((s, i) => expect(s.N).toBeCloseTo([207.143, 7.143, -92.857][i], 2)));
  it('σ = 103,52; 5,35; −139,22 МПа; запас n = 240/139,22 = 1,72', () => {
    r.steps.forEach((s, i) => expect(s.sigma).toBeCloseTo([103.52, 5.354, -139.22][i], 1));
    expect(r.nT).toBeCloseTo(1.724, 2);
  });
  it('перемещение правого торца — ноль', () => expect(Math.abs(r.steps[2].u1)).toBeLessThan(1e-12));
});

/** Метод перемещений: независимое решение того же бруса. */
function fem(b: Bar, A: number) {
  const n = b.steps.length;
  const K = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
  const F = b.forces.map((f) => f * 1e3); // Н
  b.steps.forEach((s, i) => {
    const EA = b.E * 1e6 * s.c * A * 1e-4; // Н
    const k = EA / s.l;
    K[i][i] += k;
    K[i + 1][i + 1] += k;
    K[i][i + 1] -= k;
    K[i + 1][i] -= k;
    // Нагрев стеснённого участка: узловые силы E·A·α·ΔT наружу.
    const t = EA * b.alpha * s.dT;
    F[i] -= t;
    F[i + 1] += t;
  });
  const fixed = new Set<number>([...(b.supports !== 'right' ? [0] : []), ...(b.supports !== 'left' ? [n] : [])]);
  const free = [...Array(n + 1).keys()].filter((i) => !fixed.has(i));
  const u = new Array(n + 1).fill(0);
  if (free.length) {
    const sol = gauss(
      free.map((i) => free.map((j) => K[i][j])),
      free.map((i) => F[i]),
    );
    free.forEach((i, k) => (u[i] = sol[k]));
  }
  const N = b.steps.map((s, i) => (b.E * 1e6 * s.c * A * 1e-4 * ((u[i + 1] - u[i]) / s.l - b.alpha * s.dT)) / 1e3); // кН
  return { u: u.map((x) => x * 1e3), N };
}

describe('случайные брусья: совпадение с методом перемещений', () => {
  const barArb = fc.record({
    steps: fc.array(fc.record({ l: fc.constantFrom(0.05, 0.1, 0.2, 0.3), c: fc.constantFrom(1, 1.5, 2, 3), dT: fc.constantFrom(0, 0, 10, -15, 40) }), { minLength: 1, maxLength: 5 }),
    forcesRaw: fc.array(fc.constantFrom(0, 0, 10, -25, 40, 100, -200), { minLength: 6, maxLength: 6 }),
    supports: fc.constantFrom('left', 'right', 'both' as const),
    A: fc.constantFrom(1, 2.5, 6.67, 12),
  });
  it('N, перемещения узлов, равновесие', () => {
    fc.assert(
      fc.property(barArb, ({ steps, forcesRaw, supports, A }) => {
        const b = base({ steps, forces: forcesRaw.slice(0, steps.length + 1), supports, areaMode: 'given', A });
        // Без закрепления с одной стороны нагрев — свободное удлинение; сила на незакреплённом конце — обычная.
        const r = ok(b);
        const f = fem(b, A);
        const scaleN = Math.max(1, ...b.forces.map(Math.abs), ...r.steps.map((s) => Math.abs(s.N)));
        r.steps.forEach((s, i) => expect(Math.abs(s.N - f.N[i])).toBeLessThan(1e-7 * scaleN));
        const scaleU = Math.max(1e-6, ...f.u.map(Math.abs));
        r.steps.forEach((s, i) => {
          expect(Math.abs(s.u0 - f.u[i])).toBeLessThan(1e-7 * scaleU);
          expect(Math.abs(s.u1 - f.u[i + 1])).toBeLessThan(1e-7 * scaleU);
        });
        // Равновесие бруса: реакции и все силы.
        const sum = b.forces.reduce((a, x) => a + x, 0) + (r.RA ?? 0) + (r.RB ?? 0);
        expect(Math.abs(sum)).toBeLessThan(1e-7 * scaleN);
        // Скачок N во внутреннем узле равен силе в нём (сила вправо уменьшает N справа от узла).
        for (let j = 1; j < steps.length; j++) expect(Math.abs(r.steps[j - 1].N - r.steps[j].N - b.forces[j])).toBeLessThan(1e-7 * scaleN);
      }),
      { numRuns: 3000, seed: 20260929 },
    );
  });

  it('найденная площадь — наименьшая, при которой σ ≤ [σ]', () => {
    fc.assert(
      fc.property(barArb, ({ steps, forcesRaw, supports }) => {
        const b = base({ steps: steps.map((s) => ({ ...s, dT: 0 })), forces: forcesRaw.slice(0, steps.length + 1), supports, areaMode: 'find' });
        const r = ok(b);
        if (!(r.A > 0)) return;
        expect(Math.abs(r.sigmaMax.v)).toBeCloseTo(150, 8);
        r.steps.forEach((s) => expect(Math.abs(s.sigma)).toBeLessThanOrEqual(150 + 1e-9));
      }),
      { numRuns: 1000, seed: 11 },
    );
  });

  it('искать A при нагреве в брусе с двумя заделками нельзя: A нужно задать', () =>
    expect(solveBar(base({ supports: 'both', steps: [{ l: 0.1, c: 1, dT: 10 }] }))).toEqual({ ok: false, why: 'findWithHeat' }));
});

describe('вкладка: хранилище, файл, текст', () => {
  it('сохранить → открыть: брус тот же, отмена одним шагом', () => {
    const a = new AxialStore({ preset: 'antonov12' });
    a.typeForce(1, 150);
    const { name, text } = a.exportProject(new Date('2026-09-29T10:00:00Z'));
    expect(name).toBe('Свой брус 2026-09-29.statika.json');
    expect(JSON.parse(text)).toMatchObject({ format: 'statika-project', version: 2, module: 'axial' });
    const b = new AxialStore();
    expect(b.importProject(text, name)).toBe(true);
    expect(b.get().bar).toEqual(a.get().bar);
    expect(b.get().notice?.tone).toBe('ok');
    b.undo();
    expect(b.get().preset).toBe('antonov11');
  });
  it('испорченный файл: понятная ошибка, брус не меняется', () => {
    const a = new AxialStore();
    const o = JSON.parse(a.exportProject().text);
    o.bar.steps[1].c = 0;
    o.bar.forces.pop();
    const b = new AxialStore();
    const bar0 = b.get().bar;
    expect(b.importProject(JSON.stringify(o), 'bad.json')).toBe(false);
    expect(b.get().notice?.text).toMatch(/Ступень №2: длина и доля площади — положительные числа/);
    expect(b.get().bar).toBe(bar0);
    expect(parseBar({ ...a.get().bar, supports: 'none' }).ok).toBe(false);
  });
  it('правки: поле — одна запись истории; ступень добавляется и убирается вместе с точкой', () => {
    const s = new AxialStore();
    s.typeStep(0, 'l', 0.2);
    s.typeStep(0, 'l', 0.25);
    s.endSession('step:0:l');
    s.addStep();
    expect(s.get().bar.steps).toHaveLength(4);
    expect(s.get().bar.forces).toHaveLength(5);
    s.removeStep(1);
    expect(s.get().bar.forces).toEqual([0, 200, 0, 0]);
    s.undo();
    s.undo();
    expect(s.get().bar.steps[0].l).toBe(0.25);
    s.undo();
    expect(s.get().bar.steps[0].l).toBe(0.1);
  });
  it('текст задачи 1.2: неопределимость, N, запас, проверка Δ_D = 0', () => {
    const bar = AXIAL_PRESETS.antonov12.bar;
    const r = ok(bar);
    const t = axialDoc(bar, r)
      .steps.map((st) => st.title + '\n' + st.blocks.map((bl) => (bl.k === 'p' ? inlineText(bl.c) : bl.k === 'eq' ? bl.lines.map((l) => inlineText(l.c)).join('\n') : bl.k === 'ul' ? bl.items.map(inlineText).join('\n') : bl.k === 'answer' ? bl.rows.map((x) => inlineText(x.val) + ' ' + x.note).join('\n') : '')).join('\n'))
      .join('\n');
    expect(t).toContain('Брус один раз статически неопределим.');
    expect(t).toContain('NI = FB + FC + RD = 207,139 кН (растяжение)');
    expect(t).toContain('NIII = RD = −92,861 кН (сжатие)');
    expect(t).toContain('n = σт/|σ|max = 240/139,22 = 1,72');
    expect(t).toContain('ΔD = ΔC + ΔlIII = 0 мм — сечение в заделке не смещается');
  });
});
