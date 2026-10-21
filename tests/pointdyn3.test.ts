/** Динамика точки: равновесие при вращении, поверхности и кривые, составные задачи, теорема об импульсе (пункт 21). */
import { describe, expect, it } from 'vitest';
import { solveSpin, type SpinProblem, type SpinResult } from '../src/modules/pointdyn/model/spin';
import { solveSurf, type SurfProblem, type SurfResult } from '../src/modules/pointdyn/model/surf';
import { solveStages, type StageProblem, type StageResult } from '../src/modules/pointdyn/model/stages';
import { rational, solveImpulse, type ImpulseProblem, type ImpulseResult } from '../src/modules/pointdyn/model/impulse';
import { IMPULSE_PRESETS, SPIN_PRESETS, STAGE_PRESETS, SURF_PRESETS } from '../src/modules/pointdyn/presets';
import { renderImpulse, renderSpin, renderStages, renderSurf } from '../src/modules/pointdyn/draw/constrained';
import { spinDoc } from '../src/modules/pointdyn/text/spin';
import { surfDoc } from '../src/modules/pointdyn/text/surf';
import { stagesDoc } from '../src/modules/pointdyn/text/stages';
import { impulseDoc } from '../src/modules/pointdyn/text/impulse';
import { PointStore, parsePoint, type AnyPresetKey } from '../src/modules/pointdyn/ui/store';
import { docHTML } from '../src/shared/doc';

const G = 9.81;
const near = (got: number, book: number, rel: number) => Math.abs(got - book) <= rel * Math.abs(book) + 1e-9;

function spinGot(r: SpinResult): Record<string, number> {
  const b = r.bank,
    c = r.cone,
    v = r.vert,
    s = r.spring,
    d = r.rods;
  return {
    alphaStar: b?.alphaStar ?? NaN,
    Ntot: b?.Ntot ?? NaN,
    h: b?.h ?? NaN,
    fNeed: b?.fNeed ?? NaN,
    R: b?.Rfound ?? NaN,
    vMin: b?.vMin ?? NaN,
    vMax: b?.vMax ?? NaN,
    theta: c?.theta ?? NaN,
    v: c?.v ?? NaN,
    T: c?.T ?? NaN,
    period: c?.period ?? NaN,
    omega: c?.omega ?? v?.omega ?? s?.omega ?? d?.omega ?? NaN,
    Nb: v?.Nb ?? NaN,
    vTrainKmh: v?.vTrain != null ? v.vTrain * 3.6 : NaN,
    r: s?.r ?? NaN,
    c: s?.c ?? NaN,
    cCm: s ? s.c / 100 : NaN,
    phi: d?.phi ?? NaN,
    N: d?.N ?? NaN,
    y: r.tube?.y ?? NaN,
  };
}
function surfGot(p: SurfProblem, r: SurfResult): Record<string, number> {
  const q = r.cone;
  const sa = Math.sin((p.alpha * Math.PI) / 180);
  return {
    N: r.cyl?.N ?? r.chain?.N ?? q?.N ?? NaN,
    x: r.cyl?.x ?? r.chain?.x ?? NaN,
    y: r.cyl?.y ?? NaN,
    z: r.cyl?.z ?? NaN,
    r: q?.r ?? NaN,
    phi: q?.phi ?? NaN,
    // 31.27: отношение N к формуле книги при найденном r.
    Nformula: q ? q.N / (r.mass * sa * (p.g + (p.a ** 2 * p.v0 ** 2 * Math.sin((2 * p.alpha * Math.PI) / 180)) / (2 * q.r ** 3))) : NaN,
    vCrit: r.rough?.vCrit ?? NaN,
    alphaMin: r.wire?.alphaMin ?? NaN,
    dT: r.wire?.dT ?? NaN,
    kNeed: r.helix?.kNeed ?? NaN,
    v: r.helix?.v ?? NaN,
    ratio: r.alt?.ratio ?? NaN,
  };
}
function stageGot(r: StageResult): Record<string, number> {
  return {
    h: r.loop?.hNeed ?? NaN,
    hMin: r.loop?.hMin ?? NaN,
    l: r.jump?.l ?? NaN,
    T: r.plate?.T ?? NaN,
    S: r.plate?.S ?? NaN,
    rpm: r.fly?.rpm ?? NaN,
    hM: r.slack?.hM ?? NaN,
    v: r.slack?.v ?? NaN,
    tanT: r.slack?.tanT ?? NaN,
    q: r.slack ? r.slack.q / 100 : NaN,
    t: r.slack?.t ?? NaN,
  };
}
function impGot(p: ImpulseProblem, r: ImpulseResult): Record<string, number> {
  const l = r.line;
  return {
    t: l?.t ?? NaN,
    s: l?.s ?? NaN,
    v1: l?.v1 ?? NaN,
    F: l?.F ?? NaN,
    f: l?.f ?? NaN,
    P: l ? l.mass * p.g : NaN,
    p: l?.p ?? NaN,
    Sx: r.vec?.S[0] ?? NaN,
    Sy: r.vec?.S[1] ?? NaN,
    S: r.circle?.S ?? NaN,
    Fm: r.circle?.F ?? NaN,
    n2: r.area?.n2 ?? NaN,
    T: r.hole?.T ?? NaN,
    phi: r.hole?.phi ?? NaN,
    Tsync: r.sync?.T ?? NaN,
    k: r.sync?.k ?? NaN,
    n: r.sync?.n ?? NaN,
  };
}

describe('равновесие при вращении: готовые задачи', () => {
  for (const [key, ps] of Object.entries(SPIN_PRESETS))
    it(ps.title, () => {
      const r = solveSpin(ps.problem as SpinProblem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const got = spinGot(r);
      for (const [k, book] of Object.entries(ps.book)) expect(near(got[k], book, ps.relTol), `${key} ${k}: ${got[k]} против ${book}`).toBe(true);
      expect(docHTML(spinDoc(ps.problem as SpinProblem, r, { explain: true }))).not.toContain('NaN');
      expect(renderSpin(ps.problem as SpinProblem, r).svg).not.toContain('NaN');
    });
  it('стержни: φ по ω и ω по φ согласованы', () => {
    const p = SPIN_PRESETS.s4125.problem as SpinProblem;
    const w = solveSpin(p).rods!.omega;
    const back = solveSpin({ ...p, find: 'phi', omega: w }).rods!;
    expect(back.roots.some((q) => Math.abs(q.phi - 30) < 1e-6)).toBe(true);
  });
  it('конический маятник: медленное вращение — нить вертикальна', () => {
    const r = solveSpin({ ...(SPIN_PRESETS.s269.problem as SpinProblem), find: 'omega', omega: 1 });
    expect(r.cone!.hangs).toBe(true);
  });
});

describe('поверхности и кривые: готовые задачи', () => {
  for (const [key, ps] of Object.entries(SURF_PRESETS))
    it(ps.title, () => {
      const p = ps.problem as SurfProblem;
      const r = solveSurf(p);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const got = surfGot(p, r);
      for (const [k, book] of Object.entries(ps.book)) expect(near(got[k], book, ps.relTol), `${key} ${k}: ${got[k]} против ${book}`).toBe(true);
      expect(docHTML(surfDoc(p, r, { explain: true }))).not.toContain('NaN');
      expect(renderSurf(p, r).svg).not.toContain('NaN');
    });
  it('шероховатая окружность: чуть меньше предельной скорости — остановка, чуть больше — сход', () => {
    const p = SURF_PRESETS.u3129.problem as SurfProblem;
    const vc = solveSurf(p).rough!.vCritBook;
    expect(solveSurf({ ...p, v0: vc * 0.99 }).rough!.kind).toBe('stop');
    expect(solveSurf({ ...p, v0: vc * 1.01 }).rough!.kind).toBe('detach');
    const q = SURF_PRESETS.u3130.problem as SurfProblem;
    const vi = solveSurf(q).rough!.vCritBook;
    expect(solveSurf({ ...q, v0: vi * 1.01 }).rough!.kind).toBe('top');
    expect(solveSurf({ ...q, v0: vi * 0.99 }).rough!.kind).not.toBe('top');
  });
});

describe('составные задачи: готовые задачи', () => {
  for (const [key, ps] of Object.entries(STAGE_PRESETS))
    it(ps.title, () => {
      const p = ps.problem as StageProblem;
      const r = solveStages(p);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const got = stageGot(r);
      for (const [k, book] of Object.entries(ps.book)) expect(near(got[k], book, ps.relTol), `${key} ${k}: ${got[k]} против ${book}`).toBe(true);
      expect(docHTML(stagesDoc(p, r, { explain: true }))).not.toContain('NaN');
      expect(renderStages(p, r).svg).not.toContain('NaN');
    });
  it('петля: при высоте из ответа вагонетка попадает в C', () => {
    const p = STAGE_PRESETS.g314.problem as StageProblem;
    const h = solveStages(p).loop!.hNeed;
    expect(solveStages({ ...p, h }).loop!.check!.ok).toBe(true);
    expect(solveStages({ ...p, h: h * 1.1 }).loop!.check!.ok).toBe(false);
  });
});

describe('теорема об импульсе: готовые задачи', () => {
  for (const [key, ps] of Object.entries(IMPULSE_PRESETS))
    it(ps.title, () => {
      const p = ps.problem as ImpulseProblem;
      const r = solveImpulse(p);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const got = impGot(p, r);
      for (const [k, book] of Object.entries(ps.book)) expect(near(got[k], book, ps.relTol), `${key} ${k}: ${got[k]} против ${book}`).toBe(true);
      expect(docHTML(impulseDoc(p, r, { explain: true }))).not.toContain('NaN');
      expect(renderImpulse(p, r).svg).not.toContain('NaN');
    });
  it('одна и та же задача 28.1 — найти v₁ по t', () => {
    const p = IMPULSE_PRESETS.i281.problem as ImpulseProblem;
    const t = solveImpulse(p).line!.t;
    expect(solveImpulse({ ...p, find: 'v1', t }).line!.v1).toBeCloseTo(0, 9);
  });
  it('цепная дробь', () => {
    expect(rational(1.5)).toEqual([3, 2]);
    expect(rational(Math.SQRT2)).toBeNull();
  });
  it('g = 9,81', () => expect(G).toBe(9.81));
});

describe('состояние: новые режимы', () => {
  const keys = [...Object.keys(SPIN_PRESETS), ...Object.keys(SURF_PRESETS), ...Object.keys(STAGE_PRESETS), ...Object.keys(IMPULSE_PRESETS)] as AnyPresetKey[];
  it('готовые задачи открываются в своём режиме, файл проекта — без потерь', () => {
    const st = new PointStore();
    for (const k of keys) {
      st.loadPreset(k);
      const mode = st.get().problem.mode;
      expect(['spin', 'surf', 'stages', 'impulse']).toContain(mode);
      const file = st.exportProject(new Date(2026, 9, 20));
      const st2 = new PointStore();
      expect(st2.importProject(file.text)).toBe(true);
      expect(st2.get().problem).toEqual(st.get().problem);
    }
  });
  it('старый файл без новых режимов открывается', () => {
    const st = new PointStore();
    const raw = { ...st.get().problem } as Record<string, unknown>;
    delete raw.spin;
    delete raw.surf;
    delete raw.stages;
    delete raw.impulse;
    expect(parsePoint(raw).ok).toBe(true);
  });
});
