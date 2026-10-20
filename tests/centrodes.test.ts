/**
 * Центроиды (Мещерский §17): уравнения из ответов книги, качение без скольжения (длины дуг), подвижные оси,
 * поступательное движение, файл проекта.
 */
import { describe, expect, it } from 'vitest';
import { bookResiduals, centrodes, poseAt, sourceRange, type V2 } from '../src/modules/centrodes/model/centrodes';
import { CENTRODE_PRESETS, type CentrodePreset, type CentrodePresetKey } from '../src/modules/centrodes/presets';
import { CentrodesStore } from '../src/modules/centrodes/ui/store';
import { GraphStore } from '../src/modules/graphstat/ui/store';

const values = (p: CentrodePreset) => Object.fromEntries(p.params.map((q) => [q.key, q.value]));
const keys = Object.keys(CENTRODE_PRESETS) as CentrodePresetKey[];
const len = (l: V2[]) => l.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - l[i][0], p[1] - l[i][1]), 0);

describe('Центроиды: уравнения из ответов книги', () => {
  for (const k of keys) {
    const p: CentrodePreset = CENTRODE_PRESETS[k];
    it(`${k}: центроиды построены, невязка уравнений книги в пределах допуска`, () => {
      const v = values(p);
      const c = centrodes(p.build(v));
      expect(c.ok, c.errors.join(' ')).toBe(true);
      expect(c.fixed.length).toBe(c.moving.length);
      c.fixed.forEach((l, i) => expect(l.length).toBe(c.moving[i].length));
      if (p.check) {
        const r = bookResiduals(p.check, v, c);
        expect(r.fixed).toBeLessThanOrEqual(p.check.tol);
        expect(r.moving).toBeLessThanOrEqual(p.check.tol);
      }
    });
  }

  it('допуск строгий везде, кроме приближённых уравнений 17.12', () => {
    for (const k of keys) {
      const tol = CENTRODE_PRESETS[k].check?.tol ?? 0;
      if (k === 'm1712') expect(tol).toBeGreaterThan(0.1);
      else expect(tol, k).toBeLessThanOrEqual(1e-6);
    }
  });
});

describe('Центроиды: качение без скольжения', () => {
  // Длина дуги подвижной центроиды равна длине соответствующей дуги неподвижной.
  for (const k of ['m171', 'm173', 'm175', 'm176', 'm177', 'm178', 'm1710', 'm1711'] as const) {
    it(`${k}: длины дуг совпадают`, () => {
      const c = centrodes(CENTRODE_PRESETS[k].build(values(CENTRODE_PRESETS[k])), 1441);
      c.fixed.forEach((l, i) => {
        const a = len(l),
          b = len(c.moving[i]);
        expect(Math.abs(a - b) / a, `${k} линия ${i}`).toBeLessThan(2e-3);
      });
    });
  }

  it('в каждом положении подвижная центроида касается неподвижной в точке P', () => {
    const src = CENTRODE_PRESETS.m175.build({ r: 1 });
    for (const phi of [30, 90, 200, 330]) {
      const pose = poseAt(src, phi);
      expect(pose.ok).toBe(true);
      // Точка P в подвижных осях, переведённая обратно, совпадает с P в неподвижных.
      const [xi, eta] = pose.local!;
      const back: V2 = [pose.origin[0] + xi * pose.xi[0] + eta * pose.eta[0], pose.origin[1] + xi * pose.xi[1] + eta * pose.eta[1]];
      expect(back[0]).toBeCloseTo(pose.ic![0], 9);
      expect(back[1]).toBeCloseTo(pose.ic![1], 9);
    }
  });
});

describe('Центроиды: числа из книги', () => {
  it('17.1: окружность радиуса AB = 1 м и окружность радиуса 0,5 м на AB как на диаметре', () => {
    const src = CENTRODE_PRESETS.m171.build({ L: 1 });
    const pose = poseAt(src, 30);
    expect(Math.hypot(...pose.ic!)).toBeCloseTo(1, 9);
    expect(Math.hypot(pose.local![0] - 0.5, pose.local![1])).toBeCloseTo(0.5, 9);
  });
  it('17.3: радиусы 2r и r', () => {
    const c = centrodes(CENTRODE_PRESETS.m173.build({ r: 1 }));
    c.fixed[0].forEach(([x, y]) => expect(Math.hypot(x, y)).toBeCloseTo(2, 6));
    c.moving[0].forEach(([x, y]) => expect(Math.hypot(x, y)).toBeCloseTo(1, 6));
  });
  it('17.6: действительная полуось гипербол a/2 (|PA − PB| = a)', () => {
    const src = CENTRODE_PRESETS.m176.build({ a: 3, b: 5 });
    const pose = poseAt(src, 70);
    const [x, y] = pose.ic!;
    expect(Math.abs(Math.hypot(x, y) - Math.hypot(x - 5, y))).toBeCloseTo(3, 9);
  });
  it('17.7: полуоси эллипса b/2 и ½√(b² − a²)', () => {
    const c = centrodes(CENTRODE_PRESETS.m177.build({ a: 3, b: 5 }), 2001);
    const xs = c.fixed.flat().map((p) => p[0]),
      ys = c.fixed.flat().map((p) => p[1]);
    // Центр эллипса — середина AD = (1,5; 0).
    expect((Math.max(...xs) - Math.min(...xs)) / 2).toBeCloseTo(2.5, 2);
    expect((Math.max(...ys) - Math.min(...ys)) / 2).toBeCloseTo(0.5 * Math.sqrt(25 - 9), 2);
  });
  it('17.9: y_C = a(v₁ − v₂)/(v₁ + v₂), скорость центра — полуразность, ω = (v₁ + v₂)/2a', () => {
    const v = { a: 1, v1: 3, v2: 1 };
    const pose = poseAt(CENTRODE_PRESETS.m179.build(v), 0);
    expect(-pose.ic![1]).toBeCloseTo((1 * (3 - 1)) / (3 + 1), 9);
    // На единицу φ (рад): ω_θ = −(v₁+v₂)/2a·π/180, v_c = (v₁−v₂)/2·π/180 — отношение v_c/ω = −(v₁−v₂)/(v₁+v₂)·a.
    expect(Math.abs(pose.omega)).toBeCloseTo(((3 + 1) / 2) * (Math.PI / 180), 9);
  });
  it('17.2: блок B — вертикаль на расстоянии r_B/3 от оси', () => {
    const pose = poseAt(CENTRODE_PRESETS.m172b.build({ r: 3 }), 10);
    expect(pose.ic![0]).toBeCloseTo(1, 9);
  });
  it('17.10: x²(x² − a²) = a²y², η² = aξ', () => {
    const pose = poseAt(CENTRODE_PRESETS.m1710.build({ a: 2 }), 50);
    const [x, y] = pose.ic!;
    expect(x * x * (x * x - 4)).toBeCloseTo(4 * y * y, 9);
    const [xi, eta] = pose.local!;
    expect(eta * eta).toBeCloseTo(2 * xi, 9);
  });
});

describe('Центроиды: вырождения и ошибки', () => {
  it('поступательное движение: мгновенного центра нет', () => {
    const src = { ...CENTRODE_PRESETS.m179.build({ a: 1, v1: 2, v2: -2 }) };
    // v₁ = −v₂·(−1): ω = (v₁ + v₂)/2a = 0 — рейки движутся в одну сторону с одной скоростью.
    const pose = poseAt(src, 0);
    expect(pose.ok).toBe(true);
    expect(pose.ic).toBeNull();
    const c = centrodes(src);
    expect(c.ok).toBe(false);
    expect(c.errors.length).toBeGreaterThan(0);
  });
  it('ошибка в формуле движения — понятное сообщение', () => {
    const src = { kind: 'motion' as const, x: 'sin(', y: '0', theta: 't', from: 0, to: 10, shapes: [], frameRot: 0 };
    const pose = poseAt(src, 1);
    expect(pose.ok).toBe(false);
    expect(pose.errors[0]).toMatch(/x\(φ\)/);
  });
  it('диапазон: части механизма объединены', () => {
    const src = CENTRODE_PRESETS.m176.build({ a: 3, b: 5 });
    expect(sourceRange(src)).toEqual([0.5, 359.5]);
  });
});

describe('Файлы проектов', () => {
  it('центроиды: сохранить и открыть — те же задача, размеры и φ', () => {
    const a = new CentrodesStore({ preset: 'm176' });
    a.typeValue('b', 6);
    a.setPhi(100);
    const { text } = a.exportProject(new Date('2026-10-20T12:00:00Z'));
    const b = new CentrodesStore();
    expect(b.importProject(text)).toBe(true);
    expect(b.get().preset).toBe('m176');
    expect(b.get().values.b).toBe(6);
    expect(b.get().phi).toBe(100);
  });
  it('центроиды: чужой файл и неизвестная задача отвергаются с причиной', () => {
    const b = new CentrodesStore();
    expect(b.importProject('{"format":"statika-project","version":2,"module":"truss","title":"x"}')).toBe(false);
    expect(b.get().notice?.text).toMatch(/другого раздела/);
    expect(b.importProject('{"format":"statika-project","version":2,"module":"centrodes","preset":"nope"}')).toBe(false);
  });
  it('центроиды: отмена возвращает размер', () => {
    const a = new CentrodesStore({ preset: 'm173' });
    a.typeValue('r', 2);
    a.endSession('val:r');
    expect(a.get().values.r).toBe(2);
    a.undo();
    expect(a.get().values.r).toBe(1);
  });
  it('графическая статика: все три вида сохраняются и открываются', () => {
    for (const preset of ['m57', 'm54', 'm516'] as const) {
      const a = new GraphStore({ preset });
      const { text } = a.exportProject(new Date('2026-10-20T12:00:00Z'));
      const b = new GraphStore({ preset: 'm51' });
      expect(b.importProject(text)).toBe(true);
      expect(b.get().kind).toBe(a.get().kind);
      expect(b.get().truss).toEqual(a.get().truss);
      expect(b.get().beam).toEqual(a.get().beam);
      expect(b.get().chain).toEqual(a.get().chain);
    }
  });
  it('графическая статика: правка нагрузки переводит задачу в «свою», отмена возвращает', () => {
    const a = new GraphStore({ preset: 'm54' });
    a.typeBeamLoad(0, 'F', 5);
    a.endSession('bl:0:F');
    expect(a.get().preset).toBe('custom');
    expect(a.get().beam.loads[0].F).toBe(5);
    a.undo();
    expect(a.get().beam.loads[0].F).toBe(2);
    expect(a.get().preset).toBe('m54');
  });
  it('графическая статика: файл без данных нужного вида отвергается', () => {
    const b = new GraphStore();
    expect(b.importProject('{"format":"statika-project","version":2,"module":"graphstat","kind":"beam"}')).toBe(false);
    expect(b.get().notice?.text).toMatch(/балки/);
  });
});
