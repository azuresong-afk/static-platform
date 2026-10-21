/** Динамика точки: движение по окружности в вертикальной плоскости — реакция связи, отрыв, полный оборот (Мещерский §26, 31; Яблонский Д.6). */
import { describe, expect, it } from 'vitest';
import { renderCircle } from '../src/modules/pointdyn/draw/circle';
import { solveCircle, type CircleProblem, type CircleResult } from '../src/modules/pointdyn/model/circle';
import { CIRCLE_PRESETS } from '../src/modules/pointdyn/presets';
import { circleDoc } from '../src/modules/pointdyn/text/circle';
import { parsePoint, PointStore } from '../src/modules/pointdyn/ui/store';
import { taskInfo } from '../src/shared/tasks';
import { docText } from './helpers/doctext';

const G = 9.81;
const rad = (a: number) => (a * Math.PI) / 180;
const deg = (a: number) => (a * 180) / Math.PI;
const norm = (a: number) => ((a % 360) + 360) % 360;
const base = (o: Partial<CircleProblem>): CircleProblem => ({
  byWeight: false,
  m: 1,
  g: G,
  R: 1,
  link: 'thread',
  phi0: 0,
  v0: 0,
  spring: false,
  ax: 0,
  ay: 0,
  c: 0,
  L0: 0,
  ask: 'at',
  phi1: 0,
  ...o,
});

function got(pr: CircleProblem, r: CircleResult): Record<string, number> {
  const det = r.fwd?.kind === 'detach' ? r.fwd : null;
  return {
    v: r.at?.v ?? NaN,
    N: r.at?.N ?? NaN,
    rise: r.fwd?.kind === 'stop' ? pr.R * (1 - Math.cos(rad(r.fwd.phi))) : NaN,
    v0min: r.full?.v0min ?? NaN,
    h: r.full?.h ?? NaN,
    detTop: det ? Math.abs(180 - norm(det.phi)) : NaN,
    detH: det ? -pr.R * Math.cos(rad(det.phi)) : NaN,
    detV: det ? det.v : NaN,
    zeroTop: r.zero ? Math.abs(180 - norm(r.zero.phi)) : NaN,
  };
}

/** Простой воспроизводимый генератор. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

describe('готовые задачи: ответы книг', () => {
  for (const [key, p] of Object.entries(CIRCLE_PRESETS))
    it(p.title, () => {
      const pr = p.problem as CircleProblem;
      const r = solveCircle(pr);
      expect(r.ok, key + r.errors.join()).toBe(true);
      if (pr.ask === 'at') expect(r.at?.reached, key).toBe(true);
      const g = got(pr, r);
      const rel = (p as { relTol?: number }).relTol ?? 0.005;
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) {
        const tol = book === 0 ? 1e-9 * r.P : rel * Math.abs(book);
        expect(Math.abs(g[k] - book), `${k}: ${g[k]} против ${book}`).toBeLessThanOrEqual(tol);
      }
      const text = docText(circleDoc(pr, r, { explain: true }));
      expect(text).not.toMatch(/NaN|undefined|Infinity/);
      const fig = renderCircle(pr, r).svg;
      expect(fig).not.toMatch(/NaN|undefined/);
    });
  it('Яблонский Д.6 — в группе задания Д.6', () => {
    expect(taskInfo(CIRCLE_PRESETS.yd6.title)).toMatchObject({ book: 'yab', group: 'yab:Д.6' });
    expect(taskInfo(CIRCLE_PRESETS.c3122.title)).toMatchObject({ book: 'mesh', group: 'mesh:31' });
  });
});

describe('независимые проверки', () => {
  it('реакция по замкнутой формуле N = m(v₀² − 2gR(cos φ₀ − cos φ))/R + mg cos φ', () => {
    const rnd = rng(7);
    const links: CircleProblem['link'][] = ['thread', 'inner', 'outer', 'rod'];
    for (let i = 0; i < 300; i++) {
      const pr = base({
        m: 0.2 + 5 * rnd(),
        R: 0.1 + 3 * rnd(),
        link: links[i % 4],
        phi0: 360 * rnd() - 180,
        v0: 12 * rnd() - 6,
        phi1: 360 * rnd() - 180,
        byWeight: i % 3 === 0,
      });
      const r = solveCircle(pr);
      const m = pr.byWeight ? pr.m / G : pr.m;
      const v2 = pr.v0 ** 2 - 2 * G * pr.R * (Math.cos(rad(pr.phi0)) - Math.cos(rad(pr.phi1)));
      expect(r.at!.N).toBeCloseTo((m * Math.max(v2, 0)) / pr.R + m * G * Math.cos(rad(pr.phi1)), 9);
      expect(r.at!.v).toBeCloseTo(Math.sqrt(Math.max(v2, 0)), 9);
      if (v2 < 0) expect(r.at!.reached).toBe(false);
    }
  });
  it('купол: отрыв при cos θ = (v₀² + 2gR)/(3gR) от вершины; при v₀ ≥ √(gR) — сразу', () => {
    const rnd = rng(11);
    for (let i = 0; i < 100; i++) {
      const R = 0.2 + 5 * rnd(),
        v0 = Math.sqrt(G * R) * 0.98 * rnd();
      const r = solveCircle(base({ R, link: 'outer', phi0: 180, v0: i % 2 ? v0 : -v0, ask: 'detach' }));
      expect(r.fwd!.kind).toBe('detach');
      expect(Math.cos(rad(Math.abs(180 - norm(r.fwd!.phi))))).toBeCloseTo((v0 * v0 + 2 * G * R) / (3 * G * R), 9);
    }
    const r = solveCircle(base({ R: 2, link: 'outer', phi0: 180, v0: Math.sqrt(G * 2) * 1.01, ask: 'detach' }));
    expect(r.fwd!.kind).toBe('detach');
    expect(r.fwd!.phi).toBeCloseTo(180, 9);
  });
  it('ослабление нити: cos φ = (2gR − v₀²)/(3gR) при √(2gR) < v₀ < √(5gR) снизу', () => {
    const rnd = rng(5);
    for (let i = 0; i < 100; i++) {
      const R = 0.2 + 3 * rnd();
      const v0 = Math.sqrt(G * R * (2.02 + 2.96 * rnd()));
      const r = solveCircle(base({ R, v0, ask: 'detach' }));
      expect(r.fwd!.kind).toBe('detach');
      expect(Math.cos(rad(r.fwd!.phi))).toBeCloseTo((2 * G * R - v0 * v0) / (3 * G * R), 9);
      expect(r.fwd!.v ** 2).toBeCloseTo(-G * R * Math.cos(rad(r.fwd!.phi)), 9);
    }
  });
  it('полный оборот снизу: нить и петля — √(5gR), двусторонняя связь — 2√(gR), купол — невозможен', () => {
    for (const R of [0.3, 1, 4]) {
      expect(solveCircle(base({ R, ask: 'full' })).full!.v0min).toBeCloseTo(Math.sqrt(5 * G * R), 8);
      expect(solveCircle(base({ R, link: 'inner', ask: 'full' })).full!.h).toBeCloseTo(2.5 * R, 8);
      expect(solveCircle(base({ R, link: 'rod', ask: 'full' })).full!.v0min).toBeCloseTo(2 * Math.sqrt(G * R), 8);
      expect(solveCircle(base({ R, link: 'outer', phi0: 180, ask: 'full' })).full!.possible).toBe(false);
    }
  });
  it('колебания: остановка, движение обратно, положение на обратном пути', () => {
    const pr = base({ R: 1, phi0: 30, v0: 2, phi1: 0 });
    const r = solveCircle(pr);
    const cs = Math.cos(rad(30)) - 4 / (2 * G);
    expect(r.fwd!.kind).toBe('stop');
    expect(r.fwd!.phi).toBeCloseTo(deg(Math.acos(cs)), 6);
    expect(r.back!.kind).toBe('stop');
    expect(r.back!.phi).toBeCloseTo(-deg(Math.acos(cs)), 6);
    expect(r.at).toMatchObject({ reached: true, onReturn: true });
    expect(r.at!.v).toBeCloseTo(Math.sqrt(4 + 2 * G * (1 - Math.cos(rad(30)))), 9);
    // Из покоя на 60°: движение к нижней точке, до 70° не доходит.
    const r2 = solveCircle(base({ phi0: 60, phi1: 70 }));
    expect(r2.dir).toBe(-1);
    expect(r2.at!.reached).toBe(false);
  });
  it('неустойчивое равновесие: толчок, асимптотический возврат; устойчивое — покой', () => {
    const r = solveCircle(base({ link: 'rod', phi0: 180, phi1: 0 }));
    expect(r).toMatchObject({ push: true, dir: 1 });
    expect(r.fwd).toMatchObject({ kind: 'stop', phi: 540 });
    expect(r.back).toBe(null);
    expect(r.at!.N).toBeCloseTo(5 * G, 9);
    const t = docText(circleDoc(base({ link: 'rod', phi0: 180 }), r));
    expect(t).toContain('неустойчивое равновесие');
    expect(t).toContain('асимптотически');
    const s = solveCircle(base({ link: 'rod' }));
    expect(s).toMatchObject({ push: false, dir: 0 });
    expect(docText(circleDoc(base({ link: 'rod' }), s))).toContain('устойчивого равновесия');
    // Нить в верхней точке без скорости не натянута — точка сразу падает.
    expect(solveCircle(base({ phi0: 180 })).fwd!.kind).toBe('detach');
  });
  it('двусторонняя связь: смена знака реакции при cos φ = (2gR − v₀²)/(3gR)', () => {
    const pr = base({ link: 'rod', v0: Math.sqrt(3 * G), ask: 'detach' });
    const r = solveCircle(pr);
    // v₀² = 3gR < 4gR — до верхней точки не доходит: остановка при cos φ = −1/2, а реакция обнуляется раньше.
    expect(r.fwd!.kind).toBe('stop');
    expect(Math.cos(rad(r.fwd!.phi))).toBeCloseTo(-1 / 2, 9);
    expect(Math.cos(rad(r.zero!.phi))).toBeCloseTo(-1 / 3, 9);
    expect(docText(circleDoc(pr, r))).toContain('стержень из растянутого становится сжатым');
  });
  it('пружина: энергия и реакция по формулам (кольцо с нитью через нижнюю точку, 31.16)', () => {
    const rnd = rng(3);
    for (let i = 0; i < 50; i++) {
      const Q = 0.5 + 5 * rnd(),
        R = 0.2 + rnd(),
        c = 10 * rnd(),
        phi1 = 360 * rnd();
      const r = solveCircle(base({ byWeight: true, m: Q, R, link: 'rod', phi0: 180, spring: true, ay: -R, c, phi1 }));
      expect(r.push).toBe(true);
      expect(r.at!.N).toBeCloseTo(2 * Q + c * R + 3 * (Q + c * R) * Math.cos(rad(phi1)), 8);
    }
  });
  it('ошибки данных', () => {
    expect(solveCircle(base({ R: 0 })).ok).toBe(false);
    expect(solveCircle(base({ m: -1 })).ok).toBe(false);
    expect(solveCircle(base({ spring: true, c: -1 })).ok).toBe(false);
    const r = solveCircle(base({ spring: true, ax: 0, ay: -1, c: 5, L0: 0.5 }));
    expect(r.ok).toBe(false);
    expect(docText(circleDoc(base({ R: 0 }), solveCircle(base({ R: 0 }))))).toContain('Радиус');
  });
});

describe('хранилище и файл', () => {
  it('готовая задача включает режим; файл сохраняется и открывается', () => {
    const st = new PointStore({ preset: 'c3115' });
    expect(st.get().problem.mode).toBe('circle');
    st.typeCircle('phi1', 45);
    st.setCircleLink('inner');
    st.setCircleSpring(false);
    st.setCircleAsk('full');
    const file = st.exportProject(new Date(2026, 0, 1));
    const st2 = new PointStore();
    expect(st2.importProject(file.text)).toBe(true);
    expect(st2.get().problem.circle).toEqual({ ...(CIRCLE_PRESETS.c3115.problem as CircleProblem), phi1: 45, link: 'inner', spring: false, ask: 'full' });
    st.undo();
    expect(st.get().problem.circle.ask).toBe('at');
  });
  it('файлы без поля circle открываются с задачей по умолчанию; неполные данные — ошибка', () => {
    const st = new PointStore({ preset: 'p2744' });
    const raw = JSON.parse(JSON.stringify(st.get().problem));
    delete raw.circle;
    const r = parsePoint(raw);
    expect(r.ok && r.problem.circle).toEqual(CIRCLE_PRESETS.c311.problem);
    expect(parsePoint({ ...raw, mode: 'circle' }).ok).toBe(false);
    expect(parsePoint({ ...raw, mode: 'circle', circle: { ...(CIRCLE_PRESETS.c311.problem as CircleProblem), link: 'rope' } }).ok).toBe(false);
  });
});
