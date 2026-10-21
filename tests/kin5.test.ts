/** Кинематика точки: уравнение траектории, сферические и цилиндрические координаты, равнопеременное движение. */
import { describe, expect, it } from 'vitest';
import { evalExpr, parseExpr } from '../src/shared/expr';
import { solveKin, type KinProblem } from '../src/modules/pointkin/model/kin';
import { implicit, trajEquation } from '../src/modules/pointkin/model/traj';
import { DEF_UNI, solveLin, type LinUni } from '../src/modules/pointkin/model/uniform';
import { KIN_PRESETS } from '../src/modules/pointkin/presets';
import { kinDoc } from '../src/modules/pointkin/text/solution';
import { uniDoc } from '../src/modules/pointkin/text/uniform';
import { KinStore, parseKin } from '../src/modules/pointkin/ui/store';
import { docText } from './helpers/doctext';

const kin = (o: Partial<KinProblem>): KinProblem => ({ mode: 'coord', x: '', y: '', z: '', s: '', rho: 0, r: '', phi: '', th: '', t: 1, t1: 0, t2: 2, ...o });
const eq = (o: Partial<KinProblem>) => {
  const pr = kin(o);
  return trajEquation(pr, solveKin(pr))!;
};
function ev(src: string, t: number): number {
  const p = parseExpr(src);
  if (!p.ok) throw new Error(p.error);
  return evalExpr(p.e, t);
}
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

describe('уравнение траектории', () => {
  it('виды кривых второго порядка и их параметры', () => {
    expect(eq({ x: '3 sin t', y: '3 cos t' }).rels[0]).toMatchObject({ text: 'x² + y² − 9 = 0', kind: 'окружность' });
    expect(eq({ x: '5 sin(10t)', y: '3 cos(10t)' }).rels[0].detail).toContain('полуоси 5 и 3');
    expect(eq({ x: '2 ch t', y: '3 sh t' }).rels[0]).toMatchObject({ text: '9x² − 4y² − 36 = 0', kind: 'гипербола' });
    expect(eq({ x: '1 + 2cos t', y: '−1 + sin t' }).rels[0].detail).toContain('центр (1; −1)');
    expect(eq({ x: '2', y: 't^2' }).rels[0]).toMatchObject({ text: 'x = 2', kind: 'прямая' });
    expect(eq({ x: '100 cos(0,5)t', y: '100 sin(0,5)t − 9,81t^2/2' }).rels[0]).toMatchObject({ kind: 'парабола' });
  });
  it('нет алгебраического уравнения: циклоида, спираль; винтовая линия — только проекция на xy', () => {
    expect(eq({ x: 't − sin t', y: '1 − cos t' }).rels).toEqual([]);
    expect(eq({ mode: 'polar', r: 'exp(0,2t)', phi: 't' }).none).toEqual([['x', 'y']]);
    const h = eq({ x: '2 cos(4t)', y: '2 sin(4t)', z: '2t' });
    expect(h.dims).toBe(3);
    expect(h.rels.map((r) => r.text)).toEqual(['x² + y² − 4 = 0']);
  });
  it('случайные эллипсы и параболы: найденное уравнение верно в любой точке', () => {
    const rnd = rng(9);
    for (let n = 0; n < 60; n++) {
      const [a1, b1, a2, b2, c1, c2] = Array.from({ length: 6 }, () => Math.round((rnd() * 8 - 4) * 4) / 4);
      if (Math.abs(a1 * b2 - a2 * b1) < 0.5) continue;
      const x = n % 2 ? `${a1} cos t + ${b1} sin t + ${c1}` : `${a1}t + ${c1}`;
      const y = n % 2 ? `${a2} cos t + ${b2} sin t + ${c2}` : `${a2}t^2 + ${b2}t + ${c2}`;
      const pr = kin({ x: x.replace(/\./g, ','), y: y.replace(/\./g, ','), t1: 0, t2: 6.3 });
      const r = solveKin(pr);
      const e = trajEquation(pr, r)!;
      expect(e.rels.length, `${x}; ${y}`).toBe(1);
      const rel = e.rels[0];
      for (const t of [0.3, 1.7, 4.4, 9.1]) {
        const px = ev(pr.x, t),
          py = ev(pr.y, t);
        const terms = rel.terms.map((m) => m.c * px ** m.i * py ** m.j);
        expect(Math.abs(terms.reduce((s, v) => s + v, 0))).toBeLessThan(1e-7 * terms.reduce((s, v) => s + Math.abs(v), 1e-9));
      }
    }
  });
  it('implicit: точки, не лежащие на кривой малой степени, — без уравнения', () => {
    const t = Array.from({ length: 200 }, (_, k) => k / 20);
    expect(
      implicit(
        t.map((v) => v),
        t.map((v) => Math.exp(v)),
        'x',
        'y',
        [[0.5, Math.exp(0.5)]],
      ),
    ).toBeNull();
  });
});

describe('цилиндрические и сферические координаты', () => {
  it('проекции v и a согласуются с декартовыми производными (разностная проверка)', () => {
    const rnd = rng(31);
    for (let n = 0; n < 30; n++) {
      const [p, q, w] = [rnd() + 0.5, rnd() - 0.5, rnd() * 2 - 1];
      const pr = kin({
        mode: n % 2 ? 'sph' : 'cyl',
        r: `${p.toFixed(3)} + 0,3 sin(${q.toFixed(3)}t)`.replace(/\./g, ','),
        phi: `${w.toFixed(3)}t + 0,2t^2`.replace(/\./g, ','),
        th: '0,4 cos(t)',
        z: '0,5t^2',
        t: 0.7,
      });
      const r = solveKin(pr);
      expect(r.ok).toBe(true);
      const pos = (t: number) => solveKin({ ...pr, t }).pos;
      const h = 1e-4;
      const [a, b, c] = [pos(pr.t - h), pos(pr.t), pos(pr.t + h)];
      for (let i = 0; i < 3; i++) {
        expect(r.vel[i]).toBeCloseTo((c[i] - a[i]) / (2 * h), 6);
        expect(r.acc[i]).toBeCloseTo((c[i] - 2 * b[i] + a[i]) / (h * h), 3);
      }
      // Модуль по проекциям на оси системы — тот же.
      expect(Math.hypot(...r.curv!.v)).toBeCloseTo(r.v, 10);
      expect(Math.hypot(...r.curv!.a)).toBeCloseTo(Math.hypot(...r.acc), 10);
    }
  });
  it('12.35: w_θ = +(Rk²/4) sin θ cos θ (в книге со знаком «−»)', () => {
    const r = solveKin(KIN_PRESETS.k1117.problem as KinProblem);
    expect(r.curv!.a[2]).toBeCloseTo((2 / 4) * Math.sin(0.5) * Math.cos(0.5), 12);
    expect(docText(kinDoc(KIN_PRESETS.k1117.problem as KinProblem, r))).toContain('rθ″ + 2ṙθ′ + rφ′² sin θ cos θ');
  });
});

describe('равнопеременное движение', () => {
  const u = (o: Partial<LinUni>): LinUni => ({ ...DEF_UNI, ...o });
  it('все десять сочетаний неизвестных дают одно и то же движение', () => {
    const vals = { v0: 3, v: 3 - 0.5 * 4, a: -0.5, t: 4, s: 3 * 4 - 0.25 * 16 };
    const keys = ['v0', 'v', 'a', 't', 's'] as const;
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++) {
        const known = keys.filter((_, k) => k !== i && k !== j);
        const r = solveLin(u({ ...vals, known: [...known], kmh: false }));
        expect(r.ok, `${keys[i]}, ${keys[j]}: ${r.errors.join()}`).toBe(true);
        for (const k of keys) expect(r[k], `${keys[i]}, ${keys[j]} → ${k}`).toBeCloseTo(vals[k], 9);
      }
  });
  it('км/ч, нормальное ускорение на закруглении, сообщения об ошибках', () => {
    const r = solveLin(u({ v0: 54, v: 18, s: 800, known: ['v0', 'v', 's'], kmh: true, rho: 800, tq: 40 }));
    expect(r.a).toBeCloseTo(-0.125, 12);
    expect(r.mid!.v).toBeCloseTo(10, 12);
    expect(r.mid!.an).toBeCloseTo(100 / 800, 12);
    expect(docText(uniDoc(u({ v0: 54, v: 18, s: 800, known: ['v0', 'v', 's'], kmh: true, rho: 800, tq: 40 }), r))).toContain('в момент t′');
    expect(solveLin(u({ known: ['v0', 'v'] })).ok).toBe(false);
    const bad = solveLin(u({ v0: 1, a: -1, s: 5, known: ['v0', 'a', 's'], kmh: false }));
    expect(bad.ok).toBe(false);
    expect(bad.errors.join()).toContain('точка не пройдёт заданный путь');
  });
});

describe('хранилище и файл', () => {
  it('равнопеременный режим: отметки, единицы, файл', () => {
    const st = new KinStore({ preset: 'u121' });
    st.toggleKnown('a');
    st.toggleKnown('t');
    st.typeUni('t', 50);
    st.setKmh(false);
    const f = st.exportProject(new Date(2026, 0, 1));
    const st2 = new KinStore();
    expect(st2.importProject(f.text)).toBe(true);
    expect(st2.get().problem.uni).toEqual({ ...(KIN_PRESETS.u121.problem as KinProblem).uni, known: ['v0', 'v', 't'], t: 50, kmh: false });
    st.typeStr('th', 't/2');
    expect(st.get().problem.th).toBe('t/2');
  });
  it('старый файл без th и uni открывается', () => {
    const raw = { mode: 'polar', x: '', y: '', z: '', s: '', r: '1', phi: 't', rho: 0, t: 1, t1: 0, t2: 0 };
    const r = parseKin(raw);
    expect(r.ok && r.problem.th).toBe('');
    expect(r.ok && r.problem.uni).toEqual(DEF_UNI);
    expect(parseKin({ ...raw, uni: { v0: 1 } }).ok).toBe(false);
  });
});
