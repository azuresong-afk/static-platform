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

import { VesselStore, parseVessel } from '../src/modules/vessels/ui/store';
import { VESSEL_PRESETS, type VesselPresetKey } from '../src/modules/vessels/presets';
import { renderVessel } from '../src/modules/vessels/draw/vessel';
import { vesselDoc } from '../src/modules/vessels/text/solution';

describe('сосуды: пресеты, файл, чертёж, текст', () => {
  for (const key of Object.keys(VESSEL_PRESETS) as VesselPresetKey[])
    it(`${key}: решается, файл туда-обратно, без NaN`, () => {
      const s = new VesselStore({ preset: key });
      const p = s.get().problem,
        r = solveVessel(p);
      expect(r.ok, r.errors.join()).toBe(true);
      expect(r.warnings, key).toHaveLength(0);
      const s2 = new VesselStore();
      expect(s2.importProject(s.exportProject(new Date(2026, 0, 1)).text)).toBe(true);
      expect(s2.get().problem).toEqual(p);
      for (const x of [renderVessel(p, r).svg, JSON.stringify(vesselDoc(p, r, { explain: true }))]) expect(x).not.toMatch(/NaN|undefined|Infinity/);
    });
  it('пресет «цилиндр под газом»: δ = 10 мм', () => expect(solveVessel(VESSEL_PRESETS.cylgas.problem as VesselProblem).delta * 1000).toBeCloseTo(10, 9));
  it('правка участков и отмена; чужой файл', () => {
    const s = new VesselStore({ preset: 'a2' });
    s.addSeg('sph');
    s.setSegKind(2, 'ell');
    s.removeSeg(0);
    s.undo();
    s.undo();
    s.undo();
    expect(s.get().preset).toBe('a2');
    expect(new VesselStore().importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'gears', problem: {} }))).toBe(false);
    expect(parseVessel({ segs: [] }).ok).toBe(false);
  });
});
