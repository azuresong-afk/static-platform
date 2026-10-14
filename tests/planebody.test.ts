/** Реакции при плоском движении тела: связи в данный момент, отрыв, трение, кинетостатика (Мещерский §39, 41, 43). */
import { describe, expect, it } from 'vitest';
import { renderBody } from '../src/modules/planebody/draw/body';
import { accOf, solveBody, type BodyProblem, type BodyResult, type Constr } from '../src/modules/planebody/model/body';
import { body, BODY_PRESETS } from '../src/modules/planebody/presets';
import { bodyDoc } from '../src/modules/planebody/text/solution';
import { BodyStore, parseBody } from '../src/modules/planebody/ui/store';
import { taskInfo } from '../src/shared/tasks';
import { docText } from './helpers/doctext';

const G = 9.81;
const rad = (a: number) => (a * Math.PI) / 180;
const c = (o: Partial<Constr>): Constr => ({ kind: 'pin', at: 'A', ang: 90, one: true, f: 0, qx: 0, qy: 0, ...o });
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
const val = (r: BodyResult, i: number, name: string) => r.reactions[i].vals.find((x) => x.name === name)!.v;

/** Проверка по определениям: связи выполнены, уравнения движения выполнены. */
function checkConsistent(pr: BodyProblem, r: BodyResult) {
  const w = pr.omega;
  for (const re of r.reactions) {
    if (re.dropped) continue;
    const cn = pr.constr[re.i];
    const rr = r.pts.get(cn.at)!;
    const a = accOf(rr, r.aC, r.eps, w);
    const n = [Math.cos(rad(cn.ang)), Math.sin(rad(cn.ang))];
    const t = [n[1], -n[0]];
    const sc = 1 + Math.hypot(...r.aC) + Math.abs(r.eps);
    if (cn.kind === 'pin') expect(Math.hypot(...a)).toBeLessThan(1e-9 * sc);
    if (cn.kind === 'roller') expect(Math.abs(a[0] * n[0] + a[1] * n[1])).toBeLessThan(1e-9 * sc);
    if (cn.kind === 'unwind') expect(Math.abs(a[0] * n[0] + a[1] * n[1])).toBeLessThan(1e-9 * sc);
    if (cn.kind === 'roll') {
      expect(Math.abs(r.aC[0] * n[0] + r.aC[1] * n[1])).toBeLessThan(1e-9 * sc);
      expect(Math.abs(a[0] * t[0] + a[1] * t[1])).toBeLessThan(1e-9 * sc);
    }
    if (cn.kind === 'rope') {
      const L = Math.hypot(cn.qx - rr[0], cn.qy - rr[1]);
      const e = [(cn.qx - rr[0]) / L, (cn.qy - rr[1]) / L];
      const v = [pr.vx - w * rr[1], pr.vy + w * rr[0]];
      expect(a[0] * e[0] + a[1] * e[1]).toBeCloseTo((v[0] ** 2 + v[1] ** 2) / L, 8);
    }
  }
  // Принцип Даламбера: заданные силы + реакции + силы инерции = 0.
  const live = r.reactions.filter((x) => !x.dropped);
  const sx = r.Fe[0] + live.reduce((s, x) => s + x.F[0], 0) + r.Phi[0];
  const sy = r.Fe[1] + live.reduce((s, x) => s + x.F[1], 0) + r.Phi[1];
  const sm = r.Me + live.reduce((s, x) => s + x.r[0] * x.F[1] - x.r[1] * x.F[0], 0) + r.MPhi;
  const scale = 1 + r.P + Math.abs(r.mass * Math.hypot(...r.aC));
  expect(Math.abs(sx) + Math.abs(sy) + Math.abs(sm)).toBeLessThan(1e-9 * scale);
}

describe('готовые задачи: ответы книги', () => {
  for (const [key, p] of Object.entries(BODY_PRESETS))
    it(p.title, () => {
      const pr = p.problem as BodyProblem;
      const r = solveBody(pr);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const got: Record<string, number> = { ax: r.aC[0], ay: r.aC[1], eps: r.eps, Phix: r.Phi[0], MPhi: r.MPhi };
      r.reactions.forEach((re) => re.vals.forEach((x) => (got[`${re.i}.${x.name}`] = x.v)));
      if (key === 'm3921') got.aDown = r.aC[0] * Math.cos(rad(30)) - r.aC[1] * Math.sin(rad(30));
      if (key === 'm4310') {
        const O = r.pts.get('O')!,
          u = [O[0] / Math.hypot(...O), O[1] / Math.hypot(...O)];
        const F = r.reactions[0].F;
        got.along = F[0] * u[0] + F[1] * u[1];
        got.perp = Math.abs(F[0] * u[1] - F[1] * u[0]);
      }
      const rel = (p as { relTol?: number }).relTol ?? 0.005;
      for (const [k, book] of Object.entries((p as { book?: Record<string, number> }).book ?? {}))
        expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(
          book === 0 ? ((p as { absTol?: number }).absTol ?? 1e-9) : rel * Math.abs(book),
        );
      if (pr.mode === 'dyn') checkConsistent(pr, r);
      const text = docText(bodyDoc(pr, r, { explain: true }));
      expect(text).not.toMatch(/NaN|undefined|Infinity/);
      expect(renderBody(pr, r).svg).not.toMatch(/NaN|undefined/);
      expect(taskInfo(p.title)).toMatchObject({ book: 'mesh' });
    });
  it('39.17–39.20: ответы в общем виде (T = P/4, давление 4/7 P, T = mg/3)', () => {
    expect(val(solveBody(BODY_PRESETS.m3917.problem), 0, 'T')).toBeCloseTo(0.25, 12);
    expect(val(solveBody(BODY_PRESETS.m3919.problem), 0, 'N')).toBeCloseTo(4 / 7, 12);
    const r = solveBody(BODY_PRESETS.m3920.problem);
    expect(val(r, 0, 'T')).toBeCloseTo(G / 3, 12);
    expect(r.eps * 0.1).toBeCloseTo((-2 * G) / 3, 9);
    expect(taskInfo(BODY_PRESETS.m3917.title)).toMatchObject({ group: 'mesh:39' });
    expect(taskInfo(BODY_PRESETS.m4115.title)).toMatchObject({ group: 'mesh:41' });
    expect(taskInfo(BODY_PRESETS.m435.title)).toMatchObject({ group: 'mesh:43' });
  });
  it('41.15: давления колёс равны при w = g(b − a)/(2h); сила тяги — сила сцепления задних колёс', () => {
    const pr = BODY_PRESETS.m4115.problem;
    const r = solveBody(pr);
    expect(val(r, 0, 'N') + val(r, 1, 'N')).toBeCloseTo(1000 * G, 9);
    expect(val(r, 1, 'F')).toBeCloseTo(1000 * 2, 9);
    const w = (G * (1.4 - 1.2)) / (2 * 0.6);
    const q = solveBody({ ...pr, ax: w });
    expect(val(q, 0, 'N')).toBeCloseTo(val(q, 1, 'N'), 9);
  });
});

describe('независимые проверки', () => {
  const incline = (al: number, o: Partial<BodyProblem>, k: Partial<Constr>) => {
    const n = [Math.sin(rad(al)), Math.cos(rad(al))];
    return body({
      byWeight: false,
      shape: 'disk',
      R: 0.3,
      points: [{ name: 'K', x: -0.3 * n[0], y: -0.3 * n[1] }],
      constr: [c({ at: 'K', ang: 90 - al, ...k })],
      ...o,
    });
  };
  const down = (r: BodyResult, al: number) => r.aC[0] * Math.cos(rad(al)) - r.aC[1] * Math.sin(rad(al));
  it('качение без скольжения по наклонной: a = g sin α/(1 + J/mR²), F = mg sin α − ma, N = mg cos α', () => {
    for (const [shape, k] of [
      ['disk', 1 / 2],
      ['ring', 1],
    ] as const)
      for (const al of [10, 30, 55]) {
        const pr = incline(al, { shape, m: 2 }, { kind: 'roll' });
        const r = solveBody(pr);
        const a = (G * Math.sin(rad(al))) / (1 + k);
        expect(down(r, al)).toBeCloseTo(a, 9);
        expect(val(r, 0, 'N')).toBeCloseTo(2 * G * Math.cos(rad(al)), 9);
        expect(Math.abs(val(r, 0, 'F'))).toBeCloseTo(2 * (G * Math.sin(rad(al)) - a), 9);
        checkConsistent(pr, r);
      }
  });
  it('опора с трением: малое f — скольжение (a = g(sin α − f cos α), ε = fNR/J); большое — прилипание (качение)', () => {
    const al = 30;
    const s = solveBody(incline(al, {}, { kind: 'roller', f: 0.05 }));
    expect(down(s, al)).toBeCloseTo(G * (Math.sin(rad(al)) - 0.05 * Math.cos(rad(al))), 9);
    expect(Math.abs(s.eps)).toBeCloseTo((0.05 * G * Math.cos(rad(al)) * 0.3) / (0.3 ** 2 / 2), 9);
    expect(s.reactions[0].note).toContain('трение скольжения');
    const k = solveBody(incline(al, {}, { kind: 'roller', f: 0.5 }));
    expect(down(k, al)).toBeCloseTo((2 / 3) * G * Math.sin(rad(al)), 9);
    expect(k.reactions[0].note).toContain('прилипание');
    // Граница: f = tg α / 3.
    const f0 = Math.tan(rad(al)) / 3;
    expect(down(solveBody(incline(al, {}, { kind: 'roller', f: f0 * 0.98 })), al)).toBeGreaterThan((2 / 3) * G * Math.sin(rad(al)));
    expect(down(solveBody(incline(al, {}, { kind: 'roller', f: f0 * 1.02 })), al)).toBeCloseTo((2 / 3) * G * Math.sin(rad(al)), 9);
  });
  it('скольжение с начальной скоростью: трение против скорости, а не по тенденции', () => {
    // Диск на горизонтальной опоре катится назад с проскальзыванием: точка касания движется влево.
    const pr = body({
      byWeight: false,
      shape: 'disk',
      R: 0.2,
      points: [{ name: 'K', x: 0, y: -0.2 }],
      constr: [c({ kind: 'roller', at: 'K', ang: 90, f: 0.2 })],
      vx: -1,
      omega: 0,
    });
    const r = solveBody(pr);
    expect(r.aC[0]).toBeCloseTo(0.2 * G, 9);
    expect(val(r, 0, 'F')).toBeCloseTo(0.2 * G, 9);
    checkConsistent(pr, r);
  });
  it('отрыв от опоры: сила вверх больше веса — связь снята, a_C = (F − mg)/m', () => {
    const pr = body({
      byWeight: false,
      shape: 'disk',
      m: 2,
      R: 0.2,
      points: [{ name: 'K', x: 0, y: -0.2 }],
      constr: [c({ kind: 'roller', at: 'K', ang: 90 })],
      loads: [{ kind: 'force', at: 'C', fx: 0, fy: 30, m: 0 }],
    });
    const r = solveBody(pr);
    expect(r.reactions[0].dropped).toBe(true);
    expect(r.aC[1]).toBeCloseTo((30 - 2 * G) / 2, 12);
    expect(docText(bodyDoc(pr, r))).toContain('отрывается');
    // Двусторонняя опора не снимается: N < 0.
    const q = solveBody({ ...pr, constr: [c({ kind: 'roller', at: 'K', ang: 90, one: false })] });
    expect(q.reactions[0].dropped).toBe(false);
    expect(val(q, 0, 'N')).toBeCloseTo(2 * G - 30, 12);
  });
  it('нить ослабевает: тело брошено вверх (v_C) — натяжение отрицательно, связь снята', () => {
    const pr = body({ constr: [c({ kind: 'rope', at: 'A', qx: -1, qy: 1 })], loads: [{ kind: 'force', at: 'C', fx: 0, fy: 5, m: 0 }] });
    const r = solveBody(pr);
    expect(r.reactions[0].dropped).toBe(true);
    expect(r.aC[1]).toBeCloseTo(4 * G, 9);
    expect(docText(bodyDoc(pr, r))).toContain('нить ослабевает');
  });
  it('43.5: лестница у гладкой стены — ε = (3g/2a) cos φ при любой угловой скорости, пока есть давление на стену', () => {
    const rnd = rng(7);
    let n = 0;
    for (let i = 0; i < 200; i++) {
      const a = 0.5 + 2 * rnd(),
        ph = 10 + 70 * rnd(),
        w = 3 * rnd();
      // Центр масс движется по окружности радиуса a/2 вокруг угла: v_C = (a/2)ω.
      const pr = body({
        L: a,
        theta: -ph,
        constr: [c({ kind: 'roller', at: 'A', ang: 0 }), c({ kind: 'roller', at: 'B', ang: 90 })],
        omega: w,
        vx: (a / 2) * w * Math.sin(rad(ph)),
        vy: (-a / 2) * w * Math.cos(rad(ph)),
      });
      const r = solveBody(pr);
      checkConsistent(pr, r);
      if (r.reactions[0].dropped) continue;
      n++;
      expect(r.eps).toBeCloseTo(((3 * G) / (2 * a)) * Math.cos(rad(ph)), 8);
      // Давление на стену по теореме о движении центра масс: N_A = m·a_Cx.
      expect(val(r, 0, 'N')).toBeCloseTo((1 / G) * r.aC[0], 9);
    }
    expect(n).toBeGreaterThan(50);
  });
  it('физический маятник (43.10) при случайных данных: реакция оси по формулам книги', () => {
    const rnd = rng(11);
    for (let i = 0; i < 100; i++) {
      const a = 0.1 + rnd(),
        rho = 0.05 + rnd(),
        ph0 = 20 + 150 * rnd(),
        ph = (2 * rnd() - 1) * ph0;
      const w = Math.sqrt((2 * G * a * (Math.cos(rad(ph)) - Math.cos(rad(ph0)))) / (rho ** 2 + a ** 2));
      const pr = body({
        shape: 'rho',
        rho,
        points: [{ name: 'O', x: -a * Math.sin(rad(ph)), y: a * Math.cos(rad(ph)) }],
        constr: [c({ kind: 'pin', at: 'O' })],
        omega: w,
        vx: w * a * Math.cos(rad(ph)),
        vy: w * a * Math.sin(rad(ph)),
      });
      const r = solveBody(pr);
      checkConsistent(pr, r);
      const u = [-Math.sin(rad(ph)), Math.cos(rad(ph))];
      const F = r.reactions[0].F;
      expect(F[0] * u[0] + F[1] * u[1]).toBeCloseTo(Math.cos(rad(ph)) + ((2 * a ** 2) / (rho ** 2 + a ** 2)) * (Math.cos(rad(ph)) - Math.cos(rad(ph0))), 9);
      expect(Math.abs(F[0] * u[1] - F[1] * u[0])).toBeCloseTo((rho ** 2 / (rho ** 2 + a ** 2)) * Math.abs(Math.sin(rad(ph))), 9);
    }
  });
  it('случайные тела со связями: условия связей и принцип Даламбера выполняются', () => {
    const rnd = rng(29);
    const kinds: Constr['kind'][] = ['pin', 'roller', 'rope', 'unwind', 'roll'];
    let ok = 0;
    for (let i = 0; i < 300; i++) {
      const pts = ['D', 'E', 'K'].map((name) => ({ name, x: 2 * rnd() - 1, y: 2 * rnd() - 1 }));
      const nc = 1 + Math.floor(rnd() * 2);
      const constr = Array.from({ length: nc }, () =>
        c({
          kind: kinds[Math.floor(rnd() * 5)],
          at: pts[Math.floor(rnd() * 3)].name,
          ang: 360 * rnd(),
          one: rnd() < 0.7,
          f: rnd() < 0.5 ? 0 : rnd(),
          qx: 4 * rnd() - 2,
          qy: 1 + 2 * rnd(),
        }),
      );
      const pr = body({
        byWeight: rnd() < 0.5,
        m: 0.5 + 2 * rnd(),
        shape: (['rod', 'disk', 'ring', 'rect', 'rho', 'J'] as const)[Math.floor(rnd() * 6)],
        points: pts,
        constr,
        loads: [
          { kind: 'force', at: 'E', fx: 4 * rnd() - 2, fy: 4 * rnd() - 2, m: 0 },
          { kind: 'moment', at: 'C', fx: 0, fy: 0, m: 2 * rnd() - 1 },
        ],
        omega: 2 * rnd() - 1,
        vx: rnd() - 0.5,
        vy: rnd() - 0.5,
      });
      const r = solveBody(pr);
      if (!r.ok) continue;
      ok++;
      expect(r.notes).toEqual([]);
      checkConsistent(pr, r);
      for (const re of r.reactions) {
        if (re.dropped) continue;
        const one = (re.kind === 'roller' && pr.constr[re.i].one) || re.kind === 'rope' || re.kind === 'unwind' || re.kind === 'roll';
        if (one) expect(re.vals[0].v).toBeGreaterThan(-1e-6);
      }
      expect(docText(bodyDoc(pr, r, { explain: true }))).not.toMatch(/NaN|undefined|Infinity/);
      expect(renderBody(pr, r).svg).not.toMatch(/NaN|undefined/);
    }
    expect(ok).toBeGreaterThan(150);
  });
  it('движение задано: реакции из кинетостатики совпадают с динамикой', () => {
    const pr = BODY_PRESETS.m3921.problem;
    const d = solveBody(pr);
    const g = solveBody({ ...pr, mode: 'given', ax: d.aC[0], ay: d.aC[1], eps: d.eps });
    expect(g.ok).toBe(true);
    expect(g.notes).toEqual([]);
    d.reactions.forEach((re, i) => re.vals.forEach((x, j) => expect(g.reactions[i].vals[j].v).toBeCloseTo(x.v, 9)));
    // Несовместное движение: невязка и предупреждение.
    const bad = solveBody({ ...BODY_PRESETS.m3917.problem, mode: 'given', ax: 1, ay: 0, eps: 0 });
    expect(bad.resid).toBeGreaterThan(0.01);
    expect(bad.notes.join()).toContain('не согласуется');
  });
  it('ошибки данных', () => {
    expect(solveBody(body({ m: 0 })).ok).toBe(false);
    expect(solveBody(body({ constr: [c({ at: 'Z' })] })).errors.join()).toContain('нет точки');
    expect(solveBody(body({ constr: [c({ kind: 'rope', at: 'A', qx: -1, qy: 0 })] })).errors.join()).toContain('нулевой длины');
    expect(solveBody(body({ constr: [c({ at: 'A' }), c({ at: 'B' })] })).ok).toBe(false);
    expect(solveBody(body({ mode: 'given', constr: [c({ at: 'A' }), c({ at: 'B' })] })).errors.join()).toContain('больше трёх');
    expect(solveBody(body({ shape: 'J', J: 0 })).ok).toBe(false);
    expect(docText(bodyDoc(body({ m: 0 }), solveBody(body({ m: 0 }))))).toContain('проверьте данные');
  });
});

describe('хранилище и файл', () => {
  it('правки списков, отмена, файл', () => {
    const st = new BodyStore({ preset: 'm3921' });
    st.addPoint();
    st.typePoint(2, 'x', 0.1);
    st.addConstr();
    st.setConstrKind(2, 'rope');
    st.typeConstr(2, 'qy', 2);
    st.typeConstrAt(2, 'D');
    st.addLoad('force');
    st.addLoad('moment');
    st.typeLoad(1, 'm', -3);
    st.setShape('ring');
    st.setMode('given');
    st.typeNum('ax', 1.5);
    expect(st.get().preset).toBe('custom');
    const file = st.exportProject(new Date(2026, 0, 1));
    const st2 = new BodyStore();
    expect(st2.importProject(file.text)).toBe(true);
    expect(st2.get().problem).toEqual(st.get().problem);
    st.undo();
    expect(st.get().problem.ax).toBe(0);
    st.undo();
    expect(st.get().problem.mode).toBe('dyn');
    st.removeConstr(2);
    expect(st.get().problem.constr.length).toBe(2);
  });
  it('неполные данные и чужой файл — ошибка', () => {
    const raw = JSON.parse(JSON.stringify(BODY_PRESETS.m435.problem));
    expect(parseBody(raw).ok).toBe(true);
    expect(parseBody({ ...raw, shape: 'cube' }).ok).toBe(false);
    expect(parseBody({ ...raw, constr: [{ ...raw.constr[0], kind: 'glue' }] }).ok).toBe(false);
    expect(parseBody({ ...raw, loads: [{ kind: 'force', at: 'C', fx: 1 }] }).ok).toBe(false);
    const { L: _L, ...noL } = raw;
    expect(parseBody(noL).ok).toBe(false);
    const st = new BodyStore();
    expect(st.importProject('{"format":"statika","module":"frames","problem":{}}')).toBe(false);
  });
});
