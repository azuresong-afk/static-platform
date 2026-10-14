/** Удар двух тел: соударение, тело на оси, преграда, теорема Карно, центр удара (Мещерский §44; Яблонский Д.13). */
import { describe, expect, it } from 'vitest';
import { renderImpact } from '../src/modules/impact/draw/impact';
import { solveImpact, type ImpBody, type ImpProblem, type ImpResult } from '../src/modules/impact/model/impact';
import { ibody, imp, IMP_PRESETS } from '../src/modules/impact/presets';
import { impactDoc } from '../src/modules/impact/text/solution';
import { ImpStore, parseImpact } from '../src/modules/impact/ui/store';
import { taskInfo } from '../src/shared/tasks';
import { docText } from './helpers/doctext';

const G = 9.81;
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
/** Величины для сверки с ответами книги. */
function gotOf(r: ImpResult): Record<string, number> {
  const g: Record<string, number> = {};
  g.u1x = r.b1.u[0];
  g.u1y = r.b1.u[1];
  g.u2x = r.b2.u[0];
  g.u2y = r.b2.u[1];
  g.u1 = Math.hypot(...r.b1.u);
  g.u2 = Math.hypot(...r.b2.u);
  g.w1 = r.b1.w1;
  g.w2 = r.b2.w1;
  g.S = Math.hypot(...r.S);
  g.S1x = -r.S[0];
  g.S1y = -r.S[1];
  for (const [p, b] of [
    ['1.', r.b1],
    ['', r.b2],
  ] as const) {
    if (b.SO) {
      g[p + 'SOx'] = b.SO[0];
      g[p + 'SOy'] = b.SO[1];
    }
    if (b.perc != null) g[p + 'perc'] = b.perc;
  }
  g.dT = r.dT;
  g.T1 = r.T1;
  g.eta = r.dT / r.T0;
  for (const [p, a] of [
    ['1.', r.after1],
    ['', r.after2],
  ] as const) {
    if (!a) continue;
    if (a.rise != null) g[p + 'rise'] = a.rise;
    if (a.bounce) g[p + 'total'] = a.bounce.total;
    if (a.thread) g[p + 'alpha'] = a.thread.alpha;
    if (a.slide != null) g[p + 'slide'] = a.slide;
    if (a.swing) g[p + 'phi'] = a.swing.phi;
    if (a.spring != null) g[p + 'spring'] = a.spring;
    if (a.pile) {
      g[p + 'R'] = a.pile.R;
      g[p + 'pileT'] = a.pile.T / 0.05;
    }
  }
  if (r.v1 != null) g.v1 = r.v1;
  if (r.kFound != null) g.k = r.kFound;
  return g;
}

describe('готовые задачи: ответы книги', () => {
  for (const [key, p] of Object.entries(IMP_PRESETS))
    it(p.title, () => {
      const pr = p.problem as ImpProblem;
      const r = solveImpact(pr);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const got = gotOf(r);
      const rel = (p as { relTol?: number }).relTol ?? 0.005;
      const abs = (p as { absTol?: number }).absTol ?? 1e-9;
      for (const [k, book] of Object.entries((p as { book?: Record<string, number> }).book ?? {}))
        expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(book === 0 ? abs : rel * Math.abs(book));
      const text = docText(impactDoc(pr, r, { explain: true }));
      expect(text).not.toMatch(/NaN|undefined|Infinity/);
      expect(renderImpact(pr, r).svg).not.toMatch(/NaN|undefined/);
      expect(['mesh', 'yab']).toContain(taskInfo(p.title).book);
    });
  it('группы задачника: Мещерский §44 и Яблонский Д.13', () => {
    expect(taskInfo(IMP_PRESETS.m441.title)).toMatchObject({ group: 'mesh:44' });
    expect(taskInfo(IMP_PRESETS.yd13.title)).toMatchObject({ book: 'yab', group: 'yab:Д.13' });
  });
  it('44.16: ответ книги 16,2 т — T′/δ без работы веса бойка и сваи; с ней R = 16,7 т', () => {
    const r = solveImpact(IMP_PRESETS.m4416.problem);
    expect(r.after2!.pile!.R).toBeCloseTo(16700, 0);
  });
  it('Яблонский Д.13 (пример): ω = 2v(r − h)/(3r²), импульс ступеньки 1208 Н·с; после удара цилиндр вращается вокруг ребра', () => {
    const r = solveImpact(IMP_PRESETS.yd13.problem);
    expect(Math.hypot(...r.b1.uP)).toBeLessThan(1e-9);
    expect(r.after1!.swing!.J).toBeCloseTo(1.5 * 500 * 0.25, 9);
  });
});

/** Случайное тело. */
function randBody(rnd: () => number, kind: ImpBody['kind'], o: Partial<ImpBody> = {}): ImpBody {
  const inertia =
    kind === 'axis'
      ? (['rod', 'disk', 'rect', 'rhoO', 'JC'] as const)[Math.floor(rnd() * 5)]
      : (['point', 'disk', 'rod', 'rect', 'rhoC'] as const)[Math.floor(rnd() * 5)];
  return ibody({
    kind,
    m: 0.5 + 3 * rnd(),
    inertia,
    J: 0.5 + rnd(),
    rho: 0.6 + rnd(),
    L: 0.5 + rnd(),
    R: 0.1 + 0.3 * rnd(),
    a: 0.3 + rnd(),
    b: 0.3 + rnd(),
    th: 180 * rnd(),
    cx: rnd() - 0.5,
    cy: rnd() - 0.5,
    ox: rnd() - 0.5,
    oy: rnd() - 0.5,
    vx: 4 * rnd() - 2,
    vy: 4 * rnd() - 2,
    omega: 4 * rnd() - 2,
    ...o,
  });
}
const cr = (a: number[], b: number[]) => a[0] * b[1] - a[1] * b[0];
const atP = (b: ImpBody, px: number, py: number): ImpBody => (b.inertia === 'point' ? { ...b, cx: px, cy: py } : b);

describe('независимые проверки', () => {
  it('центральный удар: u₁ = v₁ − (1 + k)m₂(v₁ − v₂)/(m₁ + m₂)', () => {
    const rnd = rng(3);
    for (let i = 0; i < 100; i++) {
      const m1 = 0.1 + 5 * rnd(),
        m2 = 0.1 + 5 * rnd(),
        v1 = 1 + 3 * rnd(),
        v2 = 2 * rnd() - 1.5,
        k = rnd();
      const r = solveImpact(imp({ b1: ibody({ m: m1, vx: v1 }), b2: ibody({ m: m2, cx: 1, vx: v2 }), px: 0.5, k }));
      expect(r.b1.u[0]).toBeCloseTo(v1 - ((1 + k) * m2 * (v1 - v2)) / (m1 + m2), 10);
      expect(r.b2.u[0]).toBeCloseTo(v2 + ((1 + k) * m1 * (v1 - v2)) / (m1 + m2), 10);
      // Потеря энергии: ΔT = (1 − k²)·m₁m₂(v₁ − v₂)²/(2(m₁ + m₂)).
      expect(r.dT).toBeCloseTo(((1 - k * k) * m1 * m2 * (v1 - v2) ** 2) / (2 * (m1 + m2)), 9);
    }
  });
  it('два свободных тела: сохраняются количество движения и кинетический момент; условия удара выполнены', () => {
    const rnd = rng(11);
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const px = rnd() - 0.5,
        py = rnd() - 0.5;
      // Удар по материальной точке приложен в ней самой.
      const b1 = atP(randBody(rnd, 'free'), px, py),
        b2 = atP(randBody(rnd, 'free'), px, py);
      const pr = imp({ b1, b2, px, py, nAng: 360 * rnd(), contact: i % 2 ? 'smooth' : 'rough', k: i % 2 ? rnd() : 0 });
      const r = solveImpact(pr);
      if (!r.ok) continue;
      n++;
      const P0 = [r.b1.m * r.b1.v[0] + r.b2.m * r.b2.v[0], r.b1.m * r.b1.v[1] + r.b2.m * r.b2.v[1]];
      const P1 = [r.b1.m * r.b1.u[0] + r.b2.m * r.b2.u[0], r.b1.m * r.b1.u[1] + r.b2.m * r.b2.u[1]];
      expect(P1[0]).toBeCloseTo(P0[0], 9);
      expect(P1[1]).toBeCloseTo(P0[1], 9);
      const K = (st: ImpResult['b1'], b: ImpBody, u: boolean) =>
        st.m * cr([b.cx, b.cy], u ? st.u : st.v) + (b.inertia === 'point' ? 0 : st.JC * (u ? st.w1 : st.w));
      expect(K(r.b1, b1, true) + K(r.b2, b2, true)).toBeCloseTo(K(r.b1, b1, false) + K(r.b2, b2, false), 9);
      const vn0 = r.rel0[0] * r.n[0] + r.rel0[1] * r.n[1],
        vn1 = r.rel1[0] * r.n[0] + r.rel1[1] * r.n[1];
      expect(vn1).toBeCloseTo(-r.k * vn0, 9);
      if (pr.contact === 'rough') expect(r.rel1[0] * r.t[0] + r.rel1[1] * r.t[1]).toBeCloseTo(0, 9);
      else expect(r.St).toBeCloseTo(0, 12);
      expect(r.dT).toBeGreaterThan(-1e-9);
      expect(docText(impactDoc(pr, r, { explain: true }))).not.toMatch(/NaN|undefined|Infinity/);
    }
    expect(n).toBeGreaterThan(150);
  });
  it('тело на оси и свободное тело: кинетический момент системы относительно оси сохраняется; теорема Карно при k = 0', () => {
    const rnd = rng(17);
    let n = 0;
    for (let i = 0; i < 300; i++) {
      const px = rnd() - 0.5,
        py = rnd() - 0.5;
      const b1 = atP(randBody(rnd, 'free'), px, py),
        b2 = randBody(rnd, 'axis');
      const pr = imp({ b1, b2, px, py, nAng: 360 * rnd(), contact: i % 2 ? 'smooth' : 'rough', k: i % 2 && i % 3 ? rnd() : 0 });
      const r = solveImpact(pr);
      if (!r.ok || r.notes.length) continue;
      n++;
      const O = [b2.ox, b2.oy];
      const K1 = (u: boolean) =>
        r.b1.m * cr([b1.cx - O[0], b1.cy - O[1]], u ? r.b1.u : r.b1.v) + (b1.inertia === 'point' ? 0 : r.b1.JC * (u ? r.b1.w1 : r.b1.w));
      expect(K1(true) + r.b2.JO * r.b2.w1).toBeCloseTo(K1(false) + r.b2.JO * r.b2.w, 9);
      if (pr.k === 0) expect(r.dT).toBeCloseTo(r.Tlost, 9);
    }
    expect(n).toBeGreaterThan(100);
  });
  it('центр удара: импульс, перпендикулярный OC и приложенный на расстоянии J_O/(m·OC), не передаётся на ось', () => {
    const rnd = rng(29);
    for (let i = 0; i < 100; i++) {
      const h = 0.2 + rnd(),
        rho = h + 0.1 + rnd();
      const a = (rho * rho) / h;
      const pr = imp({
        b1: ibody({ m: 0.01 + 0.2 * rnd(), cx: -0.1, cy: -a, vx: 1 + 10 * rnd() }),
        b2: ibody({ kind: 'axis', m: 1 + 5 * rnd(), inertia: 'rhoO', rho, cy: -h, omega: rnd() - 0.5 }),
        px: 0,
        py: -a,
        k: rnd(),
      });
      const r = solveImpact(pr);
      expect(r.b2.perc).toBeCloseTo(a, 12);
      expect(Math.hypot(...r.b2.SO!)).toBeLessThan(1e-9 * (1 + Math.hypot(...r.S)));
    }
  });
  it('обратные задачи: найденная скорость даёт заданный угол; найденный k даёт заданный отскок', () => {
    const p = IMP_PRESETS.m4422.problem;
    for (const ang of [5, 30, 60, 120]) {
      const r = solveImpact({ ...p, tVal: ang });
      const q = solveImpact({ ...p, ask: 'after', b1: { ...p.b1, vx: r.v1!, vy: 0 } });
      expect(q.after2!.swing!.phi).toBeCloseTo(ang, 6);
    }
    const k = solveImpact(IMP_PRESETS.m443.problem).kFound!;
    const q = solveImpact({ ...IMP_PRESETS.m443.problem, ask: 'after', k });
    expect(q.after1!.rise).toBeCloseTo(0.45, 9);
    // Опрокидывание груза 44.26: чуть меньше найденной скорости — не опрокидывается, чуть больше — опрокидывается.
    const v = solveImpact(IMP_PRESETS.m4426.problem).v1!;
    const at = (s: number) => solveImpact({ ...IMP_PRESETS.m4426.problem, ask: 'after', b1: { ...IMP_PRESETS.m4426.problem.b1, vx: s } }).after1!.swing!.over;
    expect(at(v * 0.999)).toBe(false);
    expect(at(v * 1.001)).toBe(true);
  });
  it('маятник на нити: угол после удара по энергии; качение после удара о шероховатую преграду; ошибки данных', () => {
    const r = solveImpact(IMP_PRESETS.m4417.problem);
    const u2 = Math.abs(r.b2.u[0]);
    expect(1 - Math.cos((r.after2!.thread!.alpha * Math.PI) / 180)).toBeCloseTo((u2 * u2) / (2 * G * 0.5), 12);
    expect(solveImpact(imp({ b1: ibody({ vx: -1 }), b2: ibody({ cx: 1 }), px: 0.5 })).errors.join()).toContain('не сближаются');
    expect(solveImpact(imp({ k: 1.5, b1: ibody({ vx: 1 }), b2: ibody({ cx: 1 }) })).ok).toBe(false);
    expect(solveImpact(imp({ k: 0.5, contact: 'rough', b1: ibody({ vx: 1 }), b2: ibody({ cx: 1 }) })).errors.join()).toContain('неупругий');
    expect(solveImpact(imp({ k: 0.5, stick: true, b1: ibody({ vx: 1 }), b2: ibody({ cx: 1 }) })).errors.join()).toContain('k = 0');
    expect(solveImpact(imp({ b1: ibody({ m: 0, vx: 1 }), b2: ibody({ cx: 1 }) })).ok).toBe(false);
    expect(
      solveImpact(imp({ b1: ibody({ kind: 'axis', inertia: 'JO', J: 0.1, cy: -1, omega: 1 }), b2: ibody({ kind: 'wall' }), py: -1 })).errors.join(),
    ).toContain('меньше');
    expect(docText(impactDoc(imp({}), solveImpact(imp({}))))).toContain('проверьте данные');
  });
});

describe('хранилище и файл', () => {
  it('правки, отмена, файл', () => {
    const st = new ImpStore({ preset: 'm4424' });
    st.setKind(0, 'axis');
    expect(st.get().problem.b1.kind).toBe('axis');
    st.setKind(0, 'free');
    st.setInertia(1, 'disk');
    st.typeBody(1, 'R', 0.3);
    st.setBefore(0, 'fall');
    st.setAfter(1, 'none');
    st.setAsk('k');
    expect(st.get().problem.target).toBe('height');
    st.typeTop('k', 0.3);
    st.setFlag('stick', true);
    expect(st.get().problem.k).toBe(0);
    st.setContact('rough');
    st.typeBodyName(0, 'камень');
    const file = st.exportProject(new Date(2026, 0, 1));
    const st2 = new ImpStore();
    expect(st2.importProject(file.text)).toBe(true);
    expect(st2.get().problem).toEqual(st.get().problem);
    st.undo();
    expect(st.get().problem.b1.name).toBe('шар');
  });
  it('вид тела меняет недопустимые варианты; неполные данные — ошибка', () => {
    const st = new ImpStore({ preset: 'm4422' });
    st.setKind(1, 'free');
    expect(st.get().problem.b2.inertia).toBe('point');
    expect(st.get().problem.b2.after).toBe('none');
    const raw = JSON.parse(JSON.stringify(IMP_PRESETS.m4410.problem));
    expect(parseImpact(raw).ok).toBe(true);
    expect(parseImpact({ ...raw, contact: 'sticky' }).ok).toBe(false);
    expect(parseImpact({ ...raw, b1: { ...raw.b1, kind: 'ghost' } }).ok).toBe(false);
    expect(parseImpact({ ...raw, b2: { ...raw.b2, m: 'x' } }).ok).toBe(false);
    expect(new ImpStore().importProject('{"format":"statika","module":"frames","problem":{}}')).toBe(false);
  });
});
