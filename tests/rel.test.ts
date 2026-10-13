/** Динамика точки: относительное движение в трубке подвижного тела, давление на стенку (Мещерский §33; Яблонский Д.4). */
import { describe, expect, it } from 'vitest';
import { renderRel } from '../src/modules/pointdyn/draw/rel';
import { closedX, solveRel, type RelProblem } from '../src/modules/pointdyn/model/rel';
import { REL_PRESETS } from '../src/modules/pointdyn/presets';
import { relDoc } from '../src/modules/pointdyn/text/rel';
import { parsePoint, PointStore } from '../src/modules/pointdyn/ui/store';
import { taskInfo } from '../src/shared/tasks';
import { docText } from './helpers/doctext';

const G = 9.81;
const rad = (a: number) => (a * Math.PI) / 180;
const base = (o: Partial<RelProblem>): RelProblem => ({
  byWeight: false,
  m: 1,
  g: G,
  frame: 'vert',
  omega: 1,
  r: 0,
  d: 0,
  h: 0,
  theta: 0,
  y1: '',
  z1: '',
  c: 0,
  l0: 0,
  f: 0,
  x0: 0,
  v0: 0,
  ask: 't',
  t1: 1,
  x1: 1,
  ...o,
});
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
/** Независимое интегрирование ẍ = F(t, x, ẋ) методом Рунге — Кутты с мелким постоянным шагом. */
function rk(F: (t: number, x: number, v: number) => number, x0: number, v0: number, T: number, n = 20000): [number, number] {
  let x = x0,
    v = v0;
  const h = T / n;
  for (let i = 0; i < n; i++) {
    const t = i * h;
    const k1x = v,
      k1v = F(t, x, v);
    const k2x = v + (h / 2) * k1v,
      k2v = F(t + h / 2, x + (h / 2) * k1x, v + (h / 2) * k1v);
    const k3x = v + (h / 2) * k2v,
      k3v = F(t + h / 2, x + (h / 2) * k2x, v + (h / 2) * k2v);
    const k4x = v + h * k3v,
      k4v = F(t + h, x + h * k3x, v + h * k3v);
    x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  }
  return [x, v];
}

describe('готовые задачи: ответы книг', () => {
  for (const [key, p] of Object.entries(REL_PRESETS))
    it(p.title, () => {
      const pr = p.problem as RelProblem;
      const r = solveRel(pr);
      expect(r.ok, key + r.errors.join()).toBe(true);
      expect(r.note, key).toBe('ok');
      const e = r.end!;
      const got: Record<string, number> = { x: e.x, v: e.v, vr: Math.abs(e.v), t: e.t, N1: e.N1, N2: e.N2, N: e.N };
      const rel = (p as { relTol?: number }).relTol ?? 0.005;
      for (const [k, book] of Object.entries((p as { book?: Record<string, number> }).book ?? {}))
        expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(rel * Math.abs(book));
      const text = docText(relDoc(pr, r, { explain: true }));
      expect(text).not.toMatch(/NaN|undefined|Infinity/);
      expect(renderRel(pr, r).svg).not.toMatch(/NaN|undefined/);
    });
  it('Яблонский Д.4: N₂ = 2mω|ẋ| sin α (в книге 0,080 вместо 0,0738)', () => {
    const pr = REL_PRESETS.yd4.problem as RelProblem;
    const e = solveRel(pr).end!;
    expect(Math.abs(e.N2)).toBeCloseTo(2 * 0.01 * Math.PI * Math.abs(e.v) * Math.sin(rad(30)), 12);
    expect(Math.abs(e.N2)).toBeCloseTo(0.07376, 5);
    expect(e.N).toBeCloseTo(0.1064, 4);
    expect(taskInfo(REL_PRESETS.yd4.title)).toMatchObject({ book: 'yab', group: 'yab:Д.4' });
    expect(taskInfo(REL_PRESETS.m3310.title)).toMatchObject({ book: 'mesh', group: 'mesh:33' });
  });
  it('Мещерский 33.12: движение удовлетворяет уравнению книги ẍ = ω²x − f√(g² + 4ω²ẋ²) (ẋ > 0)', () => {
    const pr = REL_PRESETS.m3312.problem as RelProblem;
    const r = solveRel(pr);
    const w = pr.omega;
    const F = (_t: number, x: number, v: number) => w * w * x - (v < 0 ? -1 : 1) * pr.f * Math.sqrt(G * G + 4 * w * w * v * v);
    // Состояние на выходе — по независимому интегрированию до найденного момента.
    const [x, v] = rk(F, pr.x0, pr.v0, r.end!.t);
    expect(x).toBeCloseTo(1, 7);
    expect(v).toBeCloseTo(r.end!.v, 7);
    expect(r.end!.a).toBeCloseTo(F(0, r.end!.x, r.end!.v), 9);
  });
});

describe('независимые проверки', () => {
  it('замкнутое решение совпадает с численным (вертикальная и горизонтальная ось, без трения)', () => {
    const rnd = rng(17);
    for (let i = 0; i < 120; i++) {
      const pr = base({
        frame: i % 2 ? 'horz' : 'vert',
        m: 0.2 + rnd(),
        omega: 0.5 + 4 * rnd(),
        r: rnd() - 0.5,
        d: i % 3 ? 0 : rnd(),
        h: rnd() - 0.5,
        theta: 360 * rnd() - 180,
        c: i % 4 ? 20 * rnd() : 0,
        l0: rnd(),
        x0: rnd() - 0.5,
        v0: 2 * rnd() - 1,
        t1: 0.2 + rnd(),
      });
      const r = solveRel(pr);
      if (!r.closed) continue;
      expect(r.end!.x).toBeCloseTo(closedX(r.closed, pr, pr.t1), 7);
    }
  });
  it('вертикальная ось: реакция по силам в пространстве (центробежная, кориолисова, тяжесть)', () => {
    const rnd = rng(23);
    for (let i = 0; i < 200; i++) {
      const pr = base({
        m: 0.1 + rnd(),
        omega: 6 * rnd() - 3,
        r: rnd() - 0.5,
        d: rnd() - 0.5,
        theta: 360 * rnd() - 180,
        x0: rnd(),
        v0: 4 * rnd() - 2,
        t1: 0.05,
      });
      const r = solveRel(pr);
      const e = r.end!;
      const m = pr.m,
        w = pr.omega,
        th = rad(pr.theta);
      const u = [Math.cos(th), 0, Math.sin(th)];
      const P = [pr.r + e.x * u[0], pr.d, e.x * u[2]];
      const V = u.map((c) => c * e.v);
      const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const W = [0, 0, w];
      const cf = cross(W, cross(W, P)).map((c) => -m * c);
      const cor = cross(W, V).map((c) => -2 * m * c);
      const F = [cf[0] + cor[0], cf[1] + cor[1], cf[2] + cor[2] - m * G];
      const along = F[0] * u[0] + F[1] * u[1] + F[2] * u[2];
      const R = F.map((c, k) => -(c - along * u[k]));
      expect(e.N).toBeCloseTo(Math.hypot(...R), 9);
      expect(e.a).toBeCloseTo(along / m, 9);
    }
  });
  it('поступательное движение: закон y₁ = A sin pt, z₁ = B t² — по независимому интегрированию', () => {
    const th = rad(30);
    const pr = base({ frame: 'trans', y1: '0,5 sin(2t)', z1: '0,3t^2', theta: 30, c: 5, l0: 0.2, x0: 0.1, v0: 0.4, t1: 1.2 });
    const r = solveRel(pr);
    const F = (t: number, x: number) => -(-0.5 * 4 * Math.sin(2 * t) * Math.cos(th) + 0.6 * Math.sin(th)) - G * Math.sin(th) - 5 * (x - 0.2);
    const [x, v] = rk(F, 0.1, 0.4, 1.2);
    expect(r.end!.x).toBeCloseTo(x, 8);
    expect(r.end!.v).toBeCloseTo(v, 8);
    expect(r.end!.N1).toBeCloseTo(G * Math.cos(th) + 0.6 * Math.cos(th) + 2 * Math.sin(2.4) * Math.sin(th), 9);
    expect(r.end!.N2).toBe(0);
  });
  it('горизонтальная ось: давление включает кориолисову силу в плоскости чертежа', () => {
    const pr = base({ frame: 'horz', omega: 2, h: 0.1, theta: 10, x0: 0.2, v0: 0.3, t1: 0.4 });
    const e = solveRel(pr).end!;
    expect(e.N1).toBeCloseTo(G * Math.cos(rad(10) + 0.8) + 2 * 2 * e.v - 4 * 0.1, 9);
    expect(e.N2).toBe(0);
  });
  it('недостижимое x₁, застревание трением; ошибки данных', () => {
    const t0 = Date.now();
    const r = solveRel(base({ c: 10, x0: 0.1, ask: 'x', x1: 5 }));
    expect(r.note).toBe('never');
    expect(Date.now() - t0).toBeLessThan(500);
    expect(docText(relDoc(base({ c: 10, x0: 0.1, ask: 'x', x1: 5 }), r))).toContain('не доходит');
    const s = solveRel(base({ x0: 0.1, f: 0.5, ask: 'x', x1: 5 }));
    expect(s.note).toBe('stuck');
    expect(docText(relDoc(base({ x0: 0.1, f: 0.5, ask: 'x', x1: 5 }), s))).toContain('Трение удерживает');
    expect(solveRel(base({ frame: 'trans', y1: 'sin(' })).ok).toBe(false);
    expect(solveRel(base({ t1: 0 })).ok).toBe(false);
    expect(solveRel(base({ f: -1 })).ok).toBe(false);
    expect(solveRel(base({ form: '2y' })).ok).toBe(false);
  });
});

describe('хранилище и файл', () => {
  it('готовая задача включает режим; правки, отмена, файл', () => {
    const st = new PointStore({ preset: 'yd4' });
    expect(st.get().problem.mode).toBe('rel');
    st.setRelFrame('trans');
    st.typeRelLaw('y1', '0,1 cos(2t)');
    st.typeRelLaw('form', '-v');
    st.typeRel('t1', 0.5);
    st.setRelAsk('x');
    const file = st.exportProject(new Date(2026, 0, 1));
    const st2 = new PointStore();
    expect(st2.importProject(file.text)).toBe(true);
    expect(st2.get().problem.rel).toEqual({ ...(REL_PRESETS.yd4.problem as RelProblem), frame: 'trans', y1: '0,1 cos(2t)', form: '-v', t1: 0.5, ask: 'x' });
    st.undo();
    expect(st.get().problem.rel.ask).toBe('t');
    st.typeRelLaw('form', '');
    expect('form' in st.get().problem.rel).toBe(false);
  });
  it('файлы без поля rel открываются; неполные данные — ошибка', () => {
    const raw = JSON.parse(JSON.stringify(new PointStore({ preset: 'c311' }).get().problem));
    delete raw.rel;
    const r = parsePoint(raw);
    expect(r.ok && r.problem.rel).toEqual(REL_PRESETS.yd4.problem);
    expect(parsePoint({ ...raw, mode: 'rel' }).ok).toBe(false);
    expect(parsePoint({ ...raw, mode: 'rel', rel: { ...(REL_PRESETS.yd4.problem as RelProblem), frame: 'spin' } }).ok).toBe(false);
  });
});
