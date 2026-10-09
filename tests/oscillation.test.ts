/** Удар и колебания: ответы Мещерского §32, §53 и независимые проверки (формулы Антонова, гл. 10; интегрирование). */
import { describe, expect, it } from 'vitest';
import { beamUnit, elemStiff, newElem, stiffness } from '../src/modules/oscillation/model/elastic';
import { solveOsc, type OscResult } from '../src/modules/oscillation/model/osc';
import { OSC_PRESETS, osc } from '../src/modules/oscillation/presets';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return 2 * Math.pow(10, -d);
};

function values(r: OscResult): Record<string, number> {
  const f = r.forced;
  const sw = r.dry?.swings ?? [];
  const out: Record<string, number> = {
    k: r.k,
    freq: r.freq,
    C1: r.C1,
    C2: r.C2,
    A: r.A ?? NaN,
    T0: r.T0,
    T1: r.T1 ?? NaN,
    k1: r.k1 ?? NaN,
    n: r.n,
    b: r.b,
    c: r.c,
    Fmax: r.Fmax,
    vmax: (r.A ?? NaN) * r.k,
    logHalf: r.T1 ? (r.n * r.T1) / 2 : NaN,
    r1: r.roots?.[0] ?? NaN,
    r2: r.roots?.[1] ?? NaN,
    B: f?.B != null ? Math.abs(f.B) : NaN,
    Bmax: f?.Bmax ?? NaN,
    pStar: f?.pStar ?? NaN,
    eps: f ? (f.eps * 180) / Math.PI : NaN,
    tanEps: f ? Math.tan(f.eps) : NaN,
    sinCoef: f?.B != null ? f.B * Math.cos(f.eps) : NaN,
    cosCoef: f?.B != null ? -f.B * Math.sin(f.eps) : NaN,
    res: f?.resonance ? f.h / (2 * r.k) : NaN,
    swings: sw.length,
    e1: sw[0]?.x2 ?? NaN,
    half: sw[1]?.dur ?? NaN,
    D0: r.dry?.D0 ?? NaN,
    xEnd: r.dry?.stop.x ?? NaN,
  };
  sw.forEach((s, i) => (out['s' + (i + 1)] = Math.abs(s.x2 - s.x1)));
  return out;
}

describe('ответы Мещерского', () => {
  for (const [key, p] of Object.entries(OSC_PRESETS).filter(([, x]) => 'book' in x))
    it(p.title, () => {
      const r = solveOsc(p.problem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const got = values(r);
      // Книга округляет корни и коэффициенты (32.67), берёт k ≈ 10 с⁻¹ в 32.56, в 32.64 — опечатка в частоте: там допуск шире.
      const wide: Record<string, number> = {
        'm3267:r1': 0.15,
        'm3267:r2': 0.15,
        'm3267:C1': 0.03,
        'm3267:C2': 0.03,
        'm3256:e1': 0.02,
        'm322:Fmax': 0.1,
        'm3264:n': 0.02,
        'm3264:C2': 0.006,
        'm5331:k': 0.25,
        'm5332:freq': 0.06,
      };
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) {
        const t = wide[`${key}:${k}`] ?? tol(book);
        expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(t);
      }
    });
});

describe('решение удовлетворяет уравнению и начальным условиям', () => {
  for (const [key, p] of Object.entries(OSC_PRESETS))
    it(key, () => {
      const r = solveOsc(p.problem);
      expect(r.ok).toBe(true);
      expect(r.x(0)).toBeCloseTo(r.x0, 9);
      if (!r.dry) {
        expect(r.v(0)).toBeCloseTo(r.v0, 6);
        expect(r.check!, 'расхождение с численным интегрированием').toBeLessThan(1e-6);
      }
    });
});

describe('упругий элемент', () => {
  it('последовательно и параллельно', () => {
    const s = (c: number) => ({ ...newElem('spring'), c });
    expect(stiffness([{ items: [s(1)] }, { items: [s(3)] }]).c).toBeCloseTo(0.75, 12);
    expect(stiffness([{ items: [s(2), s(2)] }]).c).toBeCloseTo(4, 12);
    expect(stiffness([{ items: [s(150), s(150)] }, { items: [s(270)] }]).c).toBeCloseTo(1 / (1 / 300 + 1 / 270), 12);
  });
  it('угол пружины и рычаг: c·cos²α, c·(a/b)²', () => {
    expect(elemStiff({ ...newElem('spring'), c: 4, ang: 60 }).c).toBeCloseTo(1, 12);
    expect(elemStiff({ ...newElem('spring'), c: 9, la: 1, lb: 3 }).c).toBeCloseTo(1, 12);
    const bad = stiffness([{ items: [{ ...newElem('spring'), ang: 30 }] }, { items: [newElem('spring')] }]);
    expect(bad.ok).toBe(false);
  });
  it('прогибы балок совпадают с решением по методу начальных параметров', () => {
    // Балка на двух опорах, груз на расстоянии a: прогиб под грузом P a²b²/(3EJl); при a = l/2 — l³/(48EJ).
    const b = { ...newElem('beam'), E: 1, J: 1, l: 2, a: 1 };
    expect(beamUnit({ ...b, scheme: 'ss-a' }).d).toBeCloseTo(beamUnit({ ...b, scheme: 'ss-mid' }).d, 12);
    expect(beamUnit({ ...b, scheme: 'cant' }).d).toBeCloseTo(8 / 3, 12);
    expect(beamUnit({ ...b, scheme: 'ff-mid' }).d).toBeCloseTo(8 / 192, 12);
    // Консоль a за опорой пролёта l: a²(l + a)/(3EJ).
    expect(beamUnit({ ...b, scheme: 'overhang', l: 3, a: 1 }).d).toBeCloseTo(4 / 3, 12);
  });
});

describe('удар (Антонов, гл. 10)', () => {
  it('K_д = 1 + √(1 + 2h/δ_ст) — невесомый элемент', () => {
    const r = solveOsc(osc({ len: 'mm', force: 'N', m: 1000, el: { mode: 'c', c: 500 }, init: { mode: 'drop', h: 40 } }));
    const dst = 2;
    expect(r.dst).toBeCloseTo(dst, 12);
    expect(r.Kd!).toBeCloseTo(1 + Math.sqrt(1 + (2 * 40) / dst), 6);
    expect(r.slack).not.toBeNull(); // после удара груз отскакивает
  });
  for (const key of ['a103', 'a104'] as const)
    it(`${key}: масса элемента — K_д = 1 + √(1 + 2h/(δ_ст(1 + βm/M)))`, () => {
      const pr = OSC_PRESETS[key].problem;
      const r = solveOsc(pr);
      expect(r.ok).toBe(true);
      const ratio = r.mRed / r.mLoad;
      expect(r.Kd!).toBeCloseTo(1 + Math.sqrt(1 + (2 * pr.init.h) / (r.dst * (1 + ratio))), 6);
      expect(r.stress!.smax).toBeCloseTo(r.stress!.sst * r.Kd!, 6);
    });
  it('a108: вынужденные колебания двигателя — K = 1/|1 − z²|', () => {
    const r = solveOsc(OSC_PRESETS.a108.problem);
    const f = r.forced!;
    expect(f.eta!).toBeCloseTo(1 / Math.abs(1 - f.z ** 2), 9);
  });
});

describe('сухое трение', () => {
  it('32.55: интегрирование с силой трения против скорости даёт те же крайние положения', () => {
    const r = solveOsc(OSC_PRESETS.m3255.problem);
    const D = r.dry!.D,
      k = r.k;
    let x = r.x0,
      v = 0,
      t = 0;
    const h = 1e-5;
    const ext: number[] = [];
    while (t < r.dry!.stop.t + 0.05) {
      if (v === 0 && Math.abs(x) <= r.dry!.D0) break;
      const dir = v !== 0 ? Math.sign(v) : -Math.sign(x);
      const a = -k * k * x - dir * k * k * D;
      const nv = v + a * h;
      x += nv * h;
      if (v !== 0 && Math.sign(nv) !== Math.sign(v)) {
        ext.push(x);
        v = 0;
      } else v = nv;
      t += h;
    }
    expect(ext.length).toBe(r.dry!.swings.length);
    ext.forEach((e, i) => expect(e).toBeCloseTo(r.dry!.swings[i].x2, 3));
  });
});

describe('проверка данных', () => {
  it('ошибки ввода не роняют расчёт', () => {
    expect(solveOsc(osc({ m: 0 })).ok).toBe(false);
    expect(solveOsc(osc({ orient: 'h', el: { mode: 'static', dst: 1 } })).ok).toBe(false);
    expect(solveOsc(osc({ orient: 'v', damp: { mode: 'dry' } })).ok).toBe(false);
    expect(solveOsc(osc({ orient: 'h', init: { mode: 'drop', h: 1 } })).ok).toBe(false);
    expect(solveOsc(osc({ el: { mode: 'period', T0: 1 }, damp: { mode: 'T1', T1: 0.5 } })).ok).toBe(false);
  });
});

describe('файл проекта', () => {
  it('каждая готовая задача сохраняется и открывается без потерь', async () => {
    const { OscStore, parseOsc } = await import('../src/modules/oscillation/ui/store');
    for (const k of Object.keys(OSC_PRESETS) as (keyof typeof OSC_PRESETS)[]) {
      const s = new OscStore({ preset: k });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const t = new OscStore();
      expect(t.importProject(text), k).toBe(true);
      expect(t.get().problem).toEqual(OSC_PRESETS[k].problem);
      expect(parseOsc(JSON.parse(text).problem).ok).toBe(true);
    }
    expect(new OscStore().importProject('{"format":"statika-project","version":2,"module":"oscillation","problem":{}}')).toBe(false);
  });
  it('правка и отмена', async () => {
    const { OscStore } = await import('../src/modules/oscillation/ui/store');
    const s = new OscStore({ preset: 'm321' });
    s.setStiffMode('elems');
    s.addStage();
    expect(s.get().problem.el.stages.length).toBe(2);
    expect(s.get().preset).toBe('custom');
    s.undo();
    expect(s.get().problem.el.stages.length).toBe(1);
    s.undo();
    expect(s.get().problem).toEqual(OSC_PRESETS.m321.problem);
  });
});
