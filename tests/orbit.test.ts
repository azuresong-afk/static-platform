/** Тяготение и кеплерово движение: космические скорости, орбиты, импульс, движение по линии центров (Мещерский §28, 30, 50, 51). */
import { describe, expect, it } from 'vitest';
import { renderOrbit, renderPlanet, renderRadial } from '../src/modules/orbit/draw/orbit';
import {
  elementsOf,
  solveOrbit,
  solvePlanet,
  solveRadial,
  type OrbitProblem,
  type OrbitResult,
  type RadialProblem,
  type RadialResult,
} from '../src/modules/orbit/model/orbit';
import { ORB_PRESETS, orbit, radial } from '../src/modules/orbit/presets';
import { orbitDoc, planetDoc, radialDoc } from '../src/modules/orbit/text/solution';
import { OrbStore, parseOrb } from '../src/modules/orbit/ui/store';
import { taskInfo } from '../src/shared/tasks';
import { docText } from './helpers/doctext';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
function gotOrbit(pr: OrbitProblem, r: OrbitResult): Record<string, number> {
  const g: Record<string, number> = {};
  const o = r.orb;
  if (o) {
    Object.assign(g, { c: o.c, p: o.p, h: o.h, e: o.e, nu: o.nu, rp: o.rp, vpe: o.vpe, Hmin: o.rp - pr.R });
    if (o.ra != null) Object.assign(g, { ra: o.ra, va: o.va!, a: o.a!, b: o.b!, T: o.T!, Hmax: o.ra - pr.R });
    if (r.Fp != null) g.Fp = r.Fp;
    if (r.Fa != null) g.Fa = r.Fa;
  }
  if (r.after && r.dv) {
    Object.assign(g, { u: Math.hypot(r.dv.t, r.dv.r), rp1: r.after.rp });
    if (r.after.ra != null) g.ra1 = r.after.ra;
    if (r.after.T != null) g.T1 = r.after.T;
  }
  if (r.v1 != null) g.v1 = r.v1;
  if (r.end) Object.assign(g, { rEnd: r.end.r, phiEnd: r.end.phi, rmin: r.rmin!, rmax: r.rmax! });
  return g;
}
function gotRadial(pr: RadialProblem, r: RadialResult): Record<string, number> {
  const g: Record<string, number> = {};
  if (r.xtop != null) Object.assign(g, { xtop: r.xtop, H: r.xtop - pr.R });
  if (r.ttop != null) g.ttop = r.ttop;
  if (r.vinfOut != null) g.vinf = r.vinfOut;
  if (r.v1 != null) g.v1 = r.v1;
  if (r.t1 != null) g.t1 = r.t1;
  if (r.v0need != null) g.v0 = r.v0need;
  if (r.x0need != null) Object.assign(g, { x0: r.x0need, H0: r.x0need - pr.R });
  return g;
}

describe('готовые задачи: ответы книги', () => {
  for (const [key, p] of Object.entries(ORB_PRESETS))
    it(p.title, () => {
      let got: Record<string, number>;
      let text: string, svg: string;
      if (p.problem.mode === 'planet') {
        const r = solvePlanet(p.problem.planet);
        expect(r.ok, key + r.errors.join()).toBe(true);
        got = { mu: r.mu, g: r.g, v1: r.v1, T1: r.T1, v2: r.v2, vc: r.vc, Tc: r.Tc, A1: r.A1, A2: r.A2 };
        if (r.Hs != null) got.Hs = r.Hs;
        text = docText(planetDoc(p.problem.planet, r, { explain: true }));
        svg = renderPlanet(p.problem.planet, r).svg;
      } else if (p.problem.mode === 'orbit') {
        const r = solveOrbit(p.problem.orbit);
        expect(r.ok, key + r.errors.join()).toBe(true);
        expect(r.notes, key).toEqual([]);
        got = gotOrbit(p.problem.orbit, r);
        text = docText(orbitDoc(p.problem.orbit, r, { explain: true }));
        svg = renderOrbit(p.problem.orbit, r).svg;
      } else {
        const r = solveRadial(p.problem.radial);
        expect(r.ok, key + r.errors.join()).toBe(true);
        expect(r.notes, key).toEqual([]);
        got = gotRadial(p.problem.radial, r);
        text = docText(radialDoc(p.problem.radial, r, { explain: true }));
        svg = renderRadial(p.problem.radial, r).svg;
      }
      const rel = (p as { relTol?: number }).relTol ?? 0.005;
      const abs = (p as { absTol?: number }).absTol ?? 1e-9;
      for (const [k, book] of Object.entries((p as { book?: Record<string, number> }).book ?? {}))
        expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(book === 0 ? abs : rel * Math.abs(book));
      expect(text).not.toMatch(/NaN|undefined|Infinity/);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      const par = /Мещерский (\d+)\./.exec(p.title)![1];
      expect(taskInfo(p.title)).toMatchObject({ book: 'mesh', group: `mesh:${par}` });
    });
});

describe('коническое сечение по начальному состоянию', () => {
  it('случайные состояния: p = c²/μ, vis-viva, апсиды и период — согласованы', () => {
    const rnd = rng(7);
    for (let i = 0; i < 300; i++) {
      const mu = 10 ** (rnd() * 12 - 2),
        r = 10 ** (rnd() * 6 - 1);
      const vc = Math.sqrt(mu / r);
      const v = vc * (0.05 + rnd() * 1.9),
        th = rnd() * 170 - 85,
        ph = rnd() * 720 - 360;
      const o = elementsOf(mu, r, v, th, ph);
      expect(o.p / (1 + o.e * Math.cos(((ph - o.eps) * Math.PI) / 180))).toBeCloseTo(r, Math.max(0, 6 - Math.log10(r)));
      expect(Math.abs(o.c - Math.sqrt(mu * o.p)) / Math.abs(o.c)).toBeLessThan(1e-9);
      if (o.type === 'ellipse') {
        expect(Math.abs(v * v - mu * (2 / r - 1 / o.a!)) / (v * v)).toBeLessThan(1e-8);
        expect(Math.abs(o.h + mu / o.a!) / Math.abs(o.h)).toBeLessThan(1e-8);
        expect(o.rp).toBeLessThanOrEqual(r * (1 + 1e-9));
        expect(o.ra!).toBeGreaterThanOrEqual(r * (1 - 1e-9));
        // Второй закон: c = r_п·v_п = r_а·v_а; третий: T²/a³ = 4π²/μ.
        expect(Math.abs(o.rp * o.vpe - o.ra! * o.va!) / o.c).toBeLessThan(1e-9);
        expect(Math.abs((o.T! ** 2 / o.a! ** 3) * mu - 4 * Math.PI ** 2)).toBeLessThan(1e-6);
      }
      if (o.type === 'hyperbola') expect(Math.abs(o.vinf! ** 2 - (v * v - (2 * mu) / r)) / o.vinf! ** 2).toBeLessThan(1e-8);
    }
  });
  it('скорость меньше круговой при θ = 0 — точка в апоцентре, больше — в перицентре', () => {
    const lo = elementsOf(1, 1, 0.8, 0, 0),
      hi = elementsOf(1, 1, 1.2, 0, 0);
    expect(lo.ra!).toBeCloseTo(1, 12);
    expect(Math.abs(Math.abs(lo.nu) - 180)).toBeLessThan(1e-9);
    expect(hi.rp).toBeCloseTo(1, 12);
    expect(hi.nu).toBeCloseTo(0, 12);
  });
  it('параболическая скорость √2·v_кр — парабола; радиальный пуск — прямая', () => {
    expect(elementsOf(1, 1, Math.SQRT2, 30, 0).type).toBe('parabola');
    expect(elementsOf(1, 1, 0.5, 90, 0).type).toBe('line');
  });
  it('50.24–50.25: перицентр ниже поверхности — траектория пересекает тело', () => {
    const R = 6370,
      H = 300,
      v1 = Math.sqrt(398000 / (R + H));
    // Граница 50.25: v₀² = v₁²·2RH/((R + H)²cos²θ₀ − R²).
    const th = 10,
      cs = Math.cos((th * Math.PI) / 180);
    const vb = v1 * Math.sqrt((2 * R * H) / ((R + H) ** 2 * cs * cs - R * R));
    expect(elementsOf(398000, R + H, vb * 0.999, th, 0, R).hit).not.toBeNull();
    expect(elementsOf(398000, R + H, vb * 1.001, th, 0, R).hit).toBeNull();
    // Внутри касательного конуса — падение при любой скорости (50.24).
    const cone = (Math.acos(R / (R + H)) * 180) / Math.PI;
    for (const v of [1, 10, 30]) expect(elementsOf(398000, R + H, v, -(cone + 1), 0, R).hit).not.toBeNull();
  });
});

describe('формулы §50', () => {
  const mu = 398000;
  it('50.16: ускорения в апогее и перигее c²(1 ∓ e)²/p³', () => {
    const r = solveOrbit(orbit({ muMode: 'mu', mu, def: 'elements', shape: 'apsides', e1: 7000, e2: 12000, m: 1, R: 0 }));
    const o = r.orb!;
    expect(r.Fp! / ((o.c ** 2 / o.p ** 3) * (1 + o.e) ** 2)).toBeCloseTo(1, 12);
    expect(r.Fa! / ((o.c ** 2 / o.p ** 3) * (1 - o.e) ** 2)).toBeCloseTo(1, 12);
  });
  it('50.17: e = H·∛(π²/(2μT²)) по периоду и разности апогея и перигея', () => {
    const o = solveOrbit(orbit({ muMode: 'mu', mu, def: 'elements', shape: 'ae', e1: 9000, e2: 0.13, R: 0 })).orb!;
    const H = o.ra! - o.rp;
    expect(H * Math.cbrt(Math.PI ** 2 / (2 * mu * o.T! ** 2))).toBeCloseTo(0.13, 12);
  });
  it('50.18: a = (1 − γ)R/(1 − γ − e(1 + γ)) при отношении высот перигея и апогея γ', () => {
    const R = 6370,
      e = 0.1,
      g = 0.3;
    const a = ((1 - g) * R) / (1 - g - e * (1 + g));
    const o = solveOrbit(orbit({ muMode: 'mu', mu, def: 'elements', shape: 'ae', e1: a, e2: e, R })).orb!;
    expect((o.rp - R) / (o.ra! - R)).toBeCloseTo(g, 12);
  });
  it('50.29: стыковка с круговым спутником в перигее — апогей 49r₀/23', () => {
    const r0 = 1,
      vc = 1,
      vp = Math.sqrt((2 * 8) / 9) * vc;
    // Равные массы: скорость после стыковки — средняя; импульс к круговой скорости (vp − vc)/2.
    const r = solveOrbit(
      orbit({ unit: 'm', muMode: 'mu', mu: 1, def: 'elements', shape: 'apsides', e1: r0, e2: r0, man: 'impulse', dvt: (vp - vc) / 2, R: 0 }),
    );
    expect(r.after!.ra! / r0).toBeCloseTo(49 / 23, 12);
  });
  it('50.40: касательный импульс до гиперболы с v∞ наименьший при r₀ = 2μ/v∞²', () => {
    const vinf = 3;
    const u = (r0: number) =>
      solveOrbit(
        orbit({ muMode: 'mu', mu, def: 'elements', shape: 'apsides', e1: r0, e2: r0, man: 'target', tgtKind: 'tang', tgt: 'vinf', tgtVal: vinf, R: 0 }),
      ).dv!.t;
    const best = (2 * mu) / vinf ** 2;
    const u0 = u(best);
    expect(u0).toBeCloseTo(Math.sqrt(vinf ** 2 + (2 * mu) / best) - Math.sqrt(mu / best), 9);
    for (const k of [0.8, 0.9, 1.1, 1.25]) expect(u(best * k)).toBeGreaterThan(u0);
  });
  it('50.21: v₀ < v₂ — эллипс, v₀ = v₂ — парабола, v₀ > v₂ — гипербола на высоте H', () => {
    const v2 = Math.sqrt((2 * mu) / 6670);
    const T = (v: number) => solveOrbit(orbit({ muMode: 'mu', mu, r0: 6670, v0: v, th0: 10 })).orb!.type;
    expect(T(v2 * 0.99)).toBe('ellipse');
    expect(T(v2)).toBe('parabola');
    expect(T(v2 * 1.01)).toBe('hyperbola');
  });
  it('радиальный импульс не меняет c, касательный при v_r = 0 — меняет', () => {
    const base = orbit({ muMode: 'mu', mu, r0: 7000, v0: 7.6, th0: 0, man: 'impulse' });
    const a = solveOrbit({ ...base, dvr: 0.4 }),
      b = solveOrbit({ ...base, dvt: 0.4 });
    expect(a.after!.c).toBeCloseTo(a.orb!.c, 9);
    expect(b.after!.c).toBeCloseTo(7000 * 8.0, 9);
  });
  it('обратная задача: недостижимый апоцентр — понятная ошибка', () => {
    const r = solveOrbit(
      orbit({ muMode: 'mu', mu, def: 'elements', shape: 'apsides', e1: 7000, e2: 7000, man: 'target', tgtKind: 'rad', tgt: 'apo', tgtVal: 6000 }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/не достигается/);
  });
  it('скорость на расстоянии r₁ — интеграл энергии; недостижимое r₁ — без ответа', () => {
    const r = solveOrbit(orbit({ muMode: 'mu', mu, r0: 7000, v0: 8, th0: 0, r1: 9000 }));
    expect(r.v1! ** 2).toBeCloseTo(64 - (2 * mu) / 7000 + (2 * mu) / 9000, 9);
    expect(solveOrbit(orbit({ muMode: 'mu', mu, r0: 7000, v0: 7, th0: 0, r1: 90000 })).v1).toBeNull();
  });
});

describe('центральная сила по формуле', () => {
  it('a = −μ/r² — численная траектория совпадает с коническим сечением (50.22)', () => {
    const p = ORB_PRESETS.m5022.problem.orbit;
    const kep = solveOrbit(p).orb!;
    const r = solveOrbit({ ...p, force: 'formula', ar: `-${p.mu}/r^2`, t1: kep.T! });
    expect(r.rmin! / kep.rp).toBeCloseTo(1, 7);
    expect(r.rmax! / kep.ra!).toBeCloseTo(1, 7);
    // Через период точка возвращается.
    expect(r.end!.r / kep.r).toBeCloseTo(1, 7);
    expect(r.end!.phi - p.ph0).toBeCloseTo(360, 4);
    expect(Math.abs(r.E1! - r.E0!) / Math.abs(r.E0! - 398000 / 6600)).toBeLessThan(1e-7);
  });
  it('28.19: вся траектория — окружность r = 2cos φ; через π с точка в центре', () => {
    const r = solveOrbit(ORB_PRESETS.m2819.problem.orbit);
    for (const s of r.path) expect(s.r).toBeCloseTo(2 * Math.cos((s.phi * Math.PI) / 180), 7);
    const fall = solveOrbit({ ...ORB_PRESETS.m2819.problem.orbit, t1: 4 });
    expect(fall.stopped).toBe('center');
    expect(fall.end!.t).toBeCloseTo(Math.PI, 3);
  });
  it('28.18: r = 2e^φ на всей траектории', () => {
    const r = solveOrbit(ORB_PRESETS.m2818.problem.orbit);
    for (const s of r.path) expect(s.r).toBeCloseTo(2 * Math.exp((s.phi * Math.PI) / 180), 7);
  });
  it('51.6: ν < c² — r = p/(1 − e cos kφ), p = 0,5, e = 0,5, k = √0,5', () => {
    const r = solveOrbit(ORB_PRESETS.m5106.problem.orbit);
    const k = Math.sqrt(0.5);
    for (const s of r.path) expect(s.r).toBeCloseTo(0.5 / (1 - 0.5 * Math.cos((k * s.phi * Math.PI) / 180)), 7);
  });
  it('ошибка в формуле — сообщение', () => {
    const r = solveOrbit(orbit({ force: 'formula', ar: '-1/(r' }));
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/a_r/);
  });
});

describe('движение по линии центров', () => {
  it('падение из покоя: время до x₁ — t = √(x₀³/(2μ))·(√(u(1 − u)) + arccos √u)', () => {
    for (const u of [0.9, 0.5, 0.1]) {
      const r = solveRadial(radial({ unit: 'm', muMode: 'mu', mu1: 2, R: 0, x0: 3, v0: 0, ask: 'at', x1: 3 * u }));
      const t = Math.sqrt(27 / 4) * (Math.sqrt(u * (1 - u)) + Math.acos(Math.sqrt(u)));
      expect(r.t1! / t).toBeCloseTo(1, 8);
      expect(r.v1! ** 2).toBeCloseTo(2 * 2 * (1 / (3 * u) - 1 / 3), 10);
    }
  });
  it('30.24: высота подъёма — точная формула H = Rv₀²/(2gR − v₀²); время подъёма конечно', () => {
    const r = solveRadial(ORB_PRESETS.m3024.problem.radial);
    const gk = 9.81e-3;
    expect(r.xtop! - 6370).toBeCloseTo((6370 * 1) / (2 * gk * 6370 - 1), 6);
    expect(r.ttop!).toBeGreaterThan(0);
    expect(r.curve.at(-1)!.v).toBeCloseTo(0, 6);
  });
  it('30.27: по формуле книги v₀² = (59/30)(1 − α)/(1 + α)·gR, α = 1/(59√80) — 10,73 км/с', () => {
    const r = solveRadial(ORB_PRESETS.m3027.problem.radial);
    const al = 1 / (59 * Math.sqrt(80));
    // В книге g — разность притяжений Земли и Луны у поверхности; отличие μ от gR² — 3,6·10⁻⁶.
    expect(r.v0need! / Math.sqrt((59 / 30) * ((1 - al) / (1 + al)) * 9.8e-3 * 6000)).toBeCloseTo(1, 5);
    expect(r.v0need!).toBeCloseTo(10.733, 3);
    expect(r.xeq!).toBeCloseTo(360000 / (1 + Math.sqrt(1 / 80)), 6);
  });
  it('51.7: торможение слабее притяжения у поверхности (T < μ/R²) — мягкая посадка невозможна', () => {
    const p = ORB_PRESETS.m5107.problem.radial;
    const weak = { ...p, acc: 0.001 };
    expect(weak.acc).toBeLessThan(p.mu1 / p.R ** 2);
    const r = solveRadial(weak);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/нельзя/);
    // Формула книги со знаком минус даёт при этом точку под поверхностью.
    const B = p.mu1 / p.R + weak.acc * p.R + 0.5;
    expect((B - Math.sqrt(B * B - 4 * p.mu1 * weak.acc)) / (2 * weak.acc) - p.R).toBeLessThan(0);
  });
  it('51.7: с найденной высоты точка останавливается ровно на поверхности', () => {
    const r = solveRadial(ORB_PRESETS.m5107.problem.radial);
    expect(r.curve.at(-1)!.x).toBeCloseTo(1738, 6);
    expect(r.curve.at(-1)!.v).toBeCloseTo(0, 8);
  });
  it('отталкивание из покоя уходит на бесконечность; притяжение с малой скоростью — останавливается', () => {
    expect(solveRadial(radial({ unit: 'cm', muMode: 'mu', mu1: 1000, repel: true, R: 0, x0: 5, v0: 0 })).escape).toBe(true);
    const r = solveRadial(radial({ x0: 6370, v0: 11 }));
    expect(r.escape).toBe(false);
    expect(r.xtop!).toBeGreaterThan(6370);
    expect(solveRadial(radial({ x0: 6370, v0: 11.3 })).escape).toBe(true);
  });
  it('из бесконечности — только скорость в точке; начальная точка между центрами', () => {
    expect(solveRadial(radial({ fromInf: true, ask: 'top' })).ok).toBe(false);
    expect(solveRadial(radial({ two: true, d: 1000, x0: 2000 })).ok).toBe(false);
  });
});

describe('хранилище и файл', () => {
  it('готовая задача, правка, отмена и повтор', () => {
    const s = new OrbStore();
    expect(s.get().preset).toBe('m5022');
    s.loadPreset('m3024');
    expect(s.get().problem.mode).toBe('radial');
    s.typeRadial('v0', 2);
    s.endSession('x:v0');
    expect(s.get().preset).toBe('custom');
    s.undo();
    expect(s.get().problem.radial.v0).toBe(1);
    s.redo();
    expect(s.get().problem.radial.v0).toBe(2);
    s.setRadial('fromInf', true);
    expect(s.get().problem.radial.ask).toBe('at');
  });
  it('файл проекта: сохранение и открытие, чужой и испорченный файл', () => {
    const s = new OrbStore();
    s.loadPreset('m5038');
    s.setOrbit('tgt', 'peri');
    const f = s.exportProject(new Date(2026, 0, 2));
    const t = new OrbStore();
    expect(t.importProject(f.text, f.name)).toBe(true);
    expect(t.get().problem.orbit).toEqual(s.get().problem.orbit);
    expect(t.importProject(f.text.replace('"orbit"', '"varmass"'))).toBe(false);
    expect(parseOrb({ mode: 'orbit', orbit: { ...s.get().problem.orbit, shape: 'круг' } }).ok).toBe(false);
    expect(parseOrb({ mode: 'radial', radial: { ...s.get().problem.radial, x0: 'a' } }).ok).toBe(false);
  });
});
