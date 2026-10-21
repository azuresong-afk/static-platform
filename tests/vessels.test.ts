/** Тонкостенные сосуды: безмоментная теория — проверка по точным формулам. */
import { describe, expect, it } from 'vitest';
import { solveVessel, type Segment, type VesselProblem } from '../src/modules/vessels/model/vessel';

const base = (o: Partial<VesselProblem>): VesselProblem => ({ segs: [], pg: 0, rho: 0, level: 0, support: 'ground', zs: 0, sigma: 100, g: 9.81, ...o });
const cyl = (r: number, h: number): Segment => ({ kind: 'cyl', r1: r, r2: r, p: 0, h });
const near = <T extends { z: number }>(pts: T[], z: number): T => pts.reduce((b, q) => (Math.abs(q.z - z) < Math.abs(b.z - z) ? q : b));

describe('сосуды: точные формулы', () => {
  it('цилиндр под давлением газа: N_t = pr, N_m = pr/2, δ = pr/[σ]', () => {
    const r = solveVessel(base({ segs: [cyl(1.2, 3)], pg: 0.5 }));
    expect(r.ok, r.errors.join()).toBe(true);
    for (const q of r.pts) {
      expect(q.Nt).toBeCloseTo(0.6, 12);
      expect(q.Nm).toBeCloseTo(0.3, 12);
    }
    expect(r.delta).toBeCloseTo(0.6 / 100, 12);
  });
  it('сфера под давлением газа: N_m = N_t = pR/2', () => {
    const R = 2;
    const r = solveVessel(base({ segs: [{ kind: 'sph', r1: 0, r2: R, p: R, h: 0 }, { kind: 'sph', r1: R, r2: 0, p: R, h: 0 }], pg: 1 }));
    expect(r.ok, r.errors.join()).toBe(true);
    expect(r.height).toBeCloseTo(2 * R, 9);
    for (const q of r.pts) {
      expect(q.Nm).toBeCloseTo(R / 2, 6);
      expect(q.Nt).toBeCloseTo(R / 2, 6);
    }
  });
  it('конический резервуар, подвешенный за верхний край, полный жидкости', () => {
    const H = 3,
      al = 30,
      a = (al * Math.PI) / 180,
      rho = 1000,
      g = 9.81,
      gam = (rho * g) / 1e6;
    const r = solveVessel(base({ segs: [{ kind: 'cone', r1: 0, r2: H * Math.tan(a), p: al, h: 0 }], rho, level: H, support: 'lugs', zs: H }));
    expect(r.ok, r.errors.join()).toBe(true);
    for (const y of [0.4, 1, 1.5, 2.2, 2.9]) {
      const q = near(r.pts, y);
      expect(q.Nt).toBeCloseTo((gam * (H - q.z) * q.z * Math.tan(a)) / Math.cos(a), 6);
      expect(q.Nm).toBeCloseTo((gam * q.z * Math.tan(a) * (H - (2 * q.z) / 3)) / (2 * Math.cos(a)), 5);
    }
    const maxT = r.pts.reduce((b, q) => (q.Nt > b.Nt ? q : b)),
      maxM = r.pts.reduce((b, q) => (q.Nm > b.Nm ? q : b));
    expect(maxT.z).toBeCloseTo(H / 2, 1);
    expect(maxT.Nt).toBeCloseTo((gam * H * H * Math.tan(a)) / (4 * Math.cos(a)), 5);
    expect(maxM.z).toBeCloseTo((3 * H) / 4, 1);
    expect(maxM.Nm).toBeCloseTo((3 * gam * H * H * Math.tan(a)) / (16 * Math.cos(a)), 5);
  });
  it('цилиндр с жидкостью: на дне — N_m = 0; на лапах вверху — N_m = γHr/2', () => {
    const rho = 1200,
      gam = (rho * 9.81) / 1e6,
      R = 1,
      H = 4;
    const g1 = solveVessel(base({ segs: [cyl(R, H)], rho, level: H }));
    for (const q of g1.pts.filter((x) => x.z > 1e-9)) {
      expect(q.Nm).toBeCloseTo(0, 9);
      expect(q.Nt).toBeCloseTo(gam * (H - q.z) * R, 9);
    }
    const g2 = solveVessel(base({ segs: [cyl(R, H)], rho, level: H, support: 'lugs', zs: H }));
    for (const q of g2.pts) if (q.z < H - 1e-9) expect(q.Nm).toBeCloseTo((gam * H * R) / 2, 6);
    expect(g2.G).toBeCloseTo(gam * Math.PI * R * R * H, 6);
  });
  it('эллиптическое днище под газом: полюс pa²/(2b), экватор N_m = pa/2, N_t = pa(1 − a²/(2b²))', () => {
    const A = 1.5,
      B = 0.75,
      p = 0.4;
    const r = solveVessel(base({ segs: [cyl(A, 1), { kind: 'ell', r1: A, r2: 0, p: 0, h: B }], pg: p }));
    expect(r.ok, r.errors.join()).toBe(true);
    const ell = r.pts.filter((q) => q.seg === 1);
    const pole = ell[ell.length - 1],
      eq = ell[0];
    expect(pole.Nm).toBeCloseTo((p * A * A) / (2 * B), 4);
    expect(pole.Nt).toBeCloseTo((p * A * A) / (2 * B), 4);
    expect(eq.Nm).toBeCloseTo((p * A) / 2, 4);
    expect(eq.Nt).toBeCloseTo(p * A * (1 - (A * A) / (2 * B * B)), 4);
    // На экваторе σ_t < 0 при a/b = 2 — III гипотеза: σ_экв = σ_m − σ_t.
    expect(eq.Neq).toBeCloseTo(eq.Nm - eq.Nt, 9);
  });
  it('цилиндр с коническим днищем на лапах: σ_m на стыке непрерывна по осевой силе', () => {
    const r = solveVessel(base({ segs: [{ kind: 'cone', r1: 0, r2: 1, p: 45, h: 0 }, cyl(1, 2)], pg: 0.2, rho: 1100, level: 2.5, support: 'lugs', zs: 1 }));
    expect(r.ok, r.errors.join()).toBe(true);
    const a = r.pts.filter((q) => q.seg === 0).pop()!,
      b = r.pts.find((q) => q.seg === 1)!;
    // Осевая сила одинакова: N_m·sin β у конуса и у цилиндра на одной высоте.
    expect(a.Nm * a.sb).toBeCloseTo(b.Nm * b.sb, 4);
    expect(r.warnings).toHaveLength(0);
  });
  it('ошибки данных', () => {
    expect(solveVessel(base({ segs: [] })).ok).toBe(false);
    expect(solveVessel(base({ segs: [{ kind: 'cone', r1: 1, r2: 1, p: 30, h: 0 }] })).ok).toBe(false);
    expect(solveVessel(base({ segs: [cyl(1, 2)], support: 'lugs', zs: 5 })).ok).toBe(false);
  });
});

import { VesselStore, parseTask } from '../src/modules/vessels/ui/store';
import { taskProblem, VESSEL_PRESETS, type VesselPresetKey } from '../src/modules/vessels/presets';
import { antonovVessel, ANT_NEEDS, type AntData } from '../src/modules/vessels/model/antonov';
import { renderVessel } from '../src/modules/vessels/draw/vessel';
import { vesselDoc } from '../src/modules/vessels/text/solution';

const A0: AntData = { fig: 1, alpha: 30, H1: 10, H2: 7, H3: 5, D: 2, R: 1.5, Rb: 0.6, p: 0.3, rho3: 1.2, sigma: 100 };

describe('сосуды по схемам Антонова', () => {
  for (let fig = 1; fig <= 16; fig++)
    it(`рис. ${fig}: сосуд строится и рассчитывается`, () => {
      const { problem, errors, reading } = antonovVessel({ ...A0, fig, R: [7, 15].includes(fig) ? 2.5 : A0.R, H1: [3, 7, 11, 15].includes(fig) ? 14 : A0.H1 });
      expect(errors, `рис. ${fig}`).toEqual([]);
      expect(reading.length).toBeGreaterThan(0);
      const r = solveVessel(problem);
      expect(r.ok, `рис. ${fig}: ${r.errors.join()}`).toBe(true);
      expect(r.warnings, `рис. ${fig}`).toEqual([]);
      expect(r.delta).toBeGreaterThan(0);
      for (const x of [renderVessel(problem, r).svg, JSON.stringify(vesselDoc(problem, r, { explain: true, reading }))]) expect(x).not.toMatch(/NaN|undefined|Infinity/);
    });
  it('рис. 1: α — между образующей и осью; высоты и лапы', () => {
    const { problem } = antonovVessel({ ...A0, fig: 1, alpha: 30, H1: 20, H2: 14, D: 2, R: 1 });
    const hc = 1 / Math.tan(Math.PI / 6);
    const r = solveVessel(problem);
    expect(r.height).toBeCloseTo(hc + 20 + 1, 9);
    expect(problem.level).toBeCloseTo(hc + 14, 12);
    expect(problem.zs).toBeCloseTo(hc + 20, 12);
    // Выше уровня жидкости цилиндр нагружен только газом и весом жидкости через лапы сверху: N_t = p_г·r.
    const q = r.pts.find((x) => x.seg === 1 && x.z > hc + 15)!;
    expect(q.Nt).toBeCloseTo(0.3, 9);
  });
  it('рис. 4 и 8: давление газа по пьезометру p_г = ρg(H₁ + H₃ − H₂)', () => {
    const g4 = antonovVessel({ ...A0, fig: 4, H1: 20, H2: 14, H3: 10, D: 3, R: 1.5, rho3: 1.3 });
    const r4 = solveVessel(g4.problem);
    expect(r4.pg).toBeCloseTo((1300 * 9.81 * (20 + 10 - 14)) / 1e6, 12);
    const g8 = antonovVessel({ ...A0, fig: 8, H1: 10, H2: 7, H3: 10, D: 6, rho3: 1.1 });
    const r8 = solveVessel(g8.problem);
    expect(r8.pg).toBeCloseTo((1100 * 9.81 * (10 + 10 - 7)) / 1e6, 12);
    // Цилиндр на основании: осевую силу несёт только газ — N_m = p_г·r/2.
    for (const q of r8.pts.filter((x) => x.seg === 0 && x.z > 1e-6)) expect(q.Nm).toBeCloseTo((r8.pg * 3) / 2, 9);
  });
  it('рис. 3: α — от горизонтали; верхний цилиндр должен помещаться', () => {
    const ok = antonovVessel({ ...A0, fig: 3, alpha: 45, D: 2, H1: 14, H2: 7, R: 1.5 });
    const hcone = (2 - 1) * Math.tan(Math.PI / 4);
    expect(solveVessel(ok.problem).height).toBeCloseTo(14 + 1.5 - Math.sqrt(1.5 ** 2 - 1), 6);
    expect(ok.problem.segs[2].h).toBeCloseTo(14 - 7 - hcone, 12);
    expect(antonovVessel({ ...A0, fig: 3, alpha: 80, D: 2, H1: 9, H2: 7, R: 1.5 }).errors.join()).toMatch(/не помещается/);
  });
  it('недостающие данные — понятное сообщение', () => {
    expect(antonovVessel({ ...A0, fig: 4, H3: 0 }).errors.join()).toMatch(/H₃/);
    expect(ANT_NEEDS[12]).toContain('H3');
  });
});

describe('сосуды: пресеты, файл, чертёж, текст', () => {
  for (const key of Object.keys(VESSEL_PRESETS) as VesselPresetKey[])
    it(`${key}: решается, файл туда-обратно, без NaN`, () => {
      const s = new VesselStore({ preset: key });
      const t = taskProblem(s.get().problem);
      expect(t.errors).toEqual([]);
      const r = solveVessel(t.problem);
      expect(r.ok, r.errors.join()).toBe(true);
      expect(r.warnings, key).toHaveLength(0);
      const s2 = new VesselStore();
      expect(s2.importProject(s.exportProject(new Date(2026, 0, 1)).text)).toBe(true);
      expect(s2.get().problem).toEqual(s.get().problem);
      for (const x of [renderVessel(t.problem, r).svg, JSON.stringify(vesselDoc(t.problem, r, { explain: true }))]) expect(x).not.toMatch(/NaN|undefined|Infinity/);
    });
  it('пресет «цилиндр под газом»: δ = 10 мм', () => expect(solveVessel(taskProblem(VESSEL_PRESETS.cylgas.task).problem).delta * 1000).toBeCloseTo(10, 9));
  it('правка, перенос схемы в свой сосуд, отмена; файл первой редакции; чужой файл', () => {
    const s = new VesselStore({ preset: 'f2r4' });
    s.toCustom(taskProblem(s.get().problem).problem);
    expect(s.get().problem.mode).toBe('custom');
    s.addSeg('sph');
    s.setSegKind(2, 'ell');
    s.removeSeg(0);
    for (let i = 0; i < 4; i++) s.undo();
    expect(s.get().preset).toBe('f2r4');
    const old = { segs: [{ kind: 'cyl', r1: 1, r2: 1, p: 0, h: 2 }], pg: 1, rho: 0, level: 0, support: 'ground', zs: 0, sigma: 100, g: 9.81 };
    const p = parseTask(old);
    expect(p.ok && p.problem.mode === 'custom' && p.problem.custom.tube === 0).toBe(true);
    expect(new VesselStore().importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'gears', problem: {} }))).toBe(false);
  });
});
