/**
 * Составные сечения (Антонов, задача 6): сортаменты согласованы; разворот и отражение профиля совпадают
 * с точным расчётом по многоугольнику (формула Грина); ручной эталон — схема 1.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ANGLES, angleIxy, GOST_8240, type Pt, type Shape } from '../src/modules/composite/model/profiles';
import { mirrorShape, rot90, solveSection, type Part } from '../src/modules/composite/model/section';
import { COMPOSITE_PRESETS } from '../src/modules/composite/presets';
import { CompositeStore, parseParts } from '../src/modules/composite/ui/store';

/** Площадь, центр тяжести и центральные моменты многоугольника (обход против часовой стрелки). */
function polyProps(P: Pt[]) {
  let A = 0,
    Sx = 0,
    Sy = 0,
    Ixx = 0,
    Iyy = 0,
    Ixy = 0;
  for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i],
      [x1, y1] = P[(i + 1) % P.length];
    const c = x0 * y1 - x1 * y0;
    A += c / 2;
    Sy += ((x0 + x1) * c) / 6;
    Sx += ((y0 + y1) * c) / 6;
    Ixx += ((y0 * y0 + y0 * y1 + y1 * y1) * c) / 12;
    Iyy += ((x0 * x0 + x0 * x1 + x1 * x1) * c) / 12;
    Ixy += ((x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * c) / 24;
  }
  const s = Math.sign(A);
  A *= s;
  const cx = (Sy * s) / A,
    cy = (Sx * s) / A;
  return { A, cx, cy, Ix: Ixx * s - A * cy * cy, Iy: Iyy * s - A * cx * cx, Ixy: Ixy * s - A * cx * cy };
}

/** Фигура с точными свойствами по её контуру. */
const exact = (outline: Pt[], w: number, h: number): Shape => ({ ...polyProps(outline), w, h, outline });

describe('сортаменты швеллеров и уголков согласованы', () => {
  for (const c of GOST_8240)
    it(`швеллер №${c.no}`, () => {
      expect(Math.abs((2 * c.Ix) / (c.h / 10) / c.Wx - 1)).toBeLessThan(0.005);
      const geo = (c.h * c.s + 2 * (c.b - c.s) * c.t) / 100;
      expect(c.A / geo).toBeGreaterThan(1.005);
      expect(c.A / geo).toBeLessThan(1.02);
      // Центр тяжести — ближе к стенке, чем у профиля без уклона полок, на 8…16 %.
      const Aw = c.h * c.s,
        Af = 2 * (c.b - c.s) * c.t;
      const thin = (Aw * (c.s / 2) + Af * (c.s + (c.b - c.s) / 2)) / (Aw + Af) / 10;
      expect(c.z0 / thin).toBeGreaterThan(0.84);
      expect(c.z0 / thin).toBeLessThan(0.93);
    });
  for (const a of ANGLES)
    it(`уголок ${a.no}`, () => {
      const geo = ((a.B + a.b - a.t) * a.t) / 100;
      expect(a.A / geo).toBeGreaterThan(1.005);
      expect(a.A / geo).toBeLessThan(1.02);
      // Центр тяжести и Ix — по тонкостенному приближению (две полосы), в пределах 3 %.
      const v = exact([[0, 0], [a.b / 10, 0], [a.b / 10, a.t / 10], [a.t / 10, a.t / 10], [a.t / 10, a.B / 10], [0, a.B / 10]], a.b / 10, a.B / 10);
      expect(Math.abs(v.cx / a.x0 - 1)).toBeLessThan(0.03);
      expect(Math.abs(v.cy / a.y0 - 1)).toBeLessThan(0.03);
      expect(Math.abs(v.Ix / a.Ix - 1)).toBeLessThan(0.04);
      expect(Math.abs(v.Ixy / angleIxy(a) - 1)).toBeLessThan(0.06);
    });
});

describe('разворот и отражение = точный расчёт по многоугольнику', () => {
  // Неравнополочный уголок как многоугольник: у него несимметричны все характеристики.
  const L = exact([[0, 0], [9, 0], [9, 1], [1, 1], [1, 14], [0, 14]], 9, 14);
  it('случайные последовательности отражений и разворотов', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('m', 'r'), { maxLength: 7 }), (ops) => {
        let s = L;
        for (const o of ops) s = o === 'm' ? mirrorShape(s) : rot90(s);
        // Контур после отражения идёт по часовой стрелке — polyProps учитывает знак площади.
        const e = polyProps(s.outline);
        for (const k of ['A', 'cx', 'cy', 'Ix', 'Iy', 'Ixy'] as const) expect(Math.abs(s[k] - e[k])).toBeLessThan(1e-9 * 1000);
      }),
      { numRuns: 300, seed: 5 },
    );
  });
  it('сборка из прямоугольников = многоугольник целиком', () => {
    // Т-образное сечение: полка 100×10 на стенке 10×90 — два листа против одного многоугольника.
    const r = solveSection([
      { kind: 'plate', no: '', w: 10, h: 90, rot: 0, mirror: false, x: -5, y: 0 },
      { kind: 'plate', no: '', w: 100, h: 10, rot: 0, mirror: false, x: -50, y: 90 },
    ])!;
    const e = polyProps([[-0.5, 0], [0.5, 0], [0.5, 9], [5, 9], [5, 10], [-5, 10], [-5, 9], [-0.5, 9]]);
    expect(r.A).toBeCloseTo(e.A, 10);
    expect(r.yc).toBeCloseTo(e.cy, 10);
    expect(r.Ix).toBeCloseTo(e.Ix, 9);
    expect(r.Iy).toBeCloseTo(e.Iy, 9);
    expect(r.Ixy).toBe(0);
  });
});

describe('Антонов, задача 6, схема 1: лист 20×100 и два уголка 80×8 вверху', () => {
  const parts: Part[] = [
    { kind: 'plate', no: '', w: 20, h: 100, rot: 0, mirror: false, x: -10, y: 0 },
    { kind: 'angle', no: '80x8', w: 0, h: 0, rot: 180, mirror: false, x: -90, y: 20 },
    { kind: 'angle', no: '80x8', w: 0, h: 0, rot: 180, mirror: true, x: 10, y: 20 },
  ];
  const r = solveSection(parts)!;
  it('центр тяжести: y = (20·5 + 2·12,3·7,73)/44,6 = 6,506 см, на оси симметрии', () => {
    expect(r.A).toBeCloseTo(44.6, 10);
    expect(r.xc).toBeCloseTo(0, 10);
    expect(r.yc).toBeCloseTo((20 * 5 + 2 * 12.3 * 7.73) / 44.6, 10);
  });
  it('главные оси — оси симметрии: I_xy = 0; I_x = 395,69 см⁴, I_y = 416,5 см⁴', () => {
    expect(r.principalXY).toBe(true);
    const yc = r.yc;
    expect(r.Ix).toBeCloseTo(166.667 + 20 * (5 - yc) ** 2 + 2 * (73.36 + 12.3 * (7.73 - yc) ** 2), 2);
    expect(r.Iy).toBeCloseTo(6.667 + 2 * (73.36 + 12.3 * 3.27 ** 2), 2);
  });
  it('W_x = I_x/y_max (нижняя точка), W_y = I_y/9 см', () => {
    expect(r.yBottom).toBeCloseTo(r.yc, 10);
    expect(r.Wx).toBeCloseTo(r.Ix / r.yc, 10);
    expect(r.Wy).toBeCloseTo(r.Iy / 9, 10);
  });
  it('наиболее нагруженная точка — нижняя, растяжение при M > 0', () => {
    expect(r.critical.y).toBeCloseTo(-r.yc, 10);
    expect(r.critical.sigmaPerM).toBeGreaterThan(0);
    expect(r.critical.sigmaPerM).toBeCloseTo(1e3 / r.WxBottom, 10);
  });
});

describe('вкладка: файл и готовые задачи', () => {
  it('сохранить → открыть; испорченный файл — ошибка', () => {
    const a = new CompositeStore({ preset: 's7' });
    a.typeM(10);
    const file = a.exportProject().text;
    const b = new CompositeStore();
    expect(b.importProject(file)).toBe(true);
    expect(b.get().parts).toEqual(a.get().parts);
    expect(b.get().M).toBe(10);
    const o = JSON.parse(file);
    o.parts[1].no = '99';
    expect(new CompositeStore().importProject(JSON.stringify(o))).toBe(false);
    expect(parseParts([{ ...o.parts[0], rot: 45 }]).ok).toBe(false);
  });
  it('все готовые задачи симметричны: I_xy = 0, центр тяжести на оси x = 0', () => {
    for (const p of Object.values(COMPOSITE_PRESETS)) {
      const r = solveSection(p.parts)!;
      expect(r.principalXY).toBe(true);
      expect(Math.abs(r.xc)).toBeLessThan(1e-9);
    }
  });
});
