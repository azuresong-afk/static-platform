/** Вращение Земли и обратные задачи сложения скоростей: ответы Мещерского §22–23, 33 и независимые проверки. */
import { describe, expect, it } from 'vitest';
import { norm, OMEGA_SOLAR, solveEarthKin, type EarthKin, type EarthKinResult } from '../src/modules/relative/model/earth';
import { solveTri, TRI_VECS, type TriItem, type TriProblem, type TriResult } from '../src/modules/relative/model/tri';
import { EARTH0, EARTH_PRESETS, TRI0, TRI_PRESETS } from '../src/modules/relative/presets';
import { RelStore } from '../src/modules/relative/ui/store';
import { solveEarthDyn, type EarthDynResult } from '../src/modules/pointdyn/model/earth';
import { EARTH_PRESETS as DYN_PRESETS } from '../src/modules/pointdyn/presets';
import { PointStore } from '../src/modules/pointdyn/ui/store';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};
function pickKin(r: EarthKinResult, k: string): number {
  const m: Record<string, number> = {
    v: norm(r.v),
    a: norm(r.a),
    ae: norm(r.ae),
    ar: norm(r.ar),
    ac: norm(r.ac),
    acH: r.acH,
    acHk: r.acHk,
    rcNmod: Math.abs(r.ar[1] + r.ac[1]),
  };
  return m[k];
}
function pickTri(r: TriResult, k: string): number[] {
  const key = { V: 'v', E: 'e', R: 'r' }[k[1]] as 'v' | 'e' | 'r';
  const two = k.endsWith('2');
  return r.sols.map((s) => {
    const q = two ? s[`${key}2` as 'v2']! : s[key];
    return k[0] === 'm' ? q.mod : (q.dir ?? NaN);
  });
}
function pickDyn(r: EarthDynResult, k: string): number {
  const m: Record<string, number | undefined> = {
    N: r.line?.FH,
    dev: r.line?.dev,
    dh: r.line?.dh,
    devE: r.fall?.dev[0],
    n: r.gr?.n,
    wMul: r.gr?.wMul,
    tH: r.pend && r.pend.t / 3600,
    ThalfH: r.pend && r.pend.Thalf / 3600,
  };
  return m[k] ?? NaN;
}

describe('Мещерский §22–23: движение относительно Земли', () => {
  for (const [key, p] of Object.entries(EARTH_PRESETS))
    it(p.title, () => {
      const r = solveEarthKin(p.problem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      for (const [k, book] of Object.entries(p.book)) {
        const got = pickKin(r, k);
        expect(Math.abs(got - book), `${k}: ${got} против ${book}`).toBeLessThanOrEqual(k === 'acHk' ? 0.5 : p.relTol * Math.abs(book));
      }
    });
  it('расхождения 23.39–23.40 записаны верно: 471,15 м/с и 348,05·10⁻⁴ м/с²', () => {
    const r = solveEarthKin(EARTH_PRESETS.e2339.problem);
    expect(norm(r.v)).toBeCloseTo(471.15, 2);
    expect(norm(r.a) * 1e4).toBeCloseTo(348.05, 2);
  });
  it('формулы 22.24, 23.62–23.64 в общем виде', () => {
    const p: EarthKin = { ...EARTH0, lat: 37, h: 1200, R: 6.4e6, omega: 7e-5, vE: 13, vN: -7, vh: 3 };
    const r = solveEarthKin(p);
    const f = (37 * Math.PI) / 180,
      w = 7e-5,
      R = 6.4e6 + 1200;
    expect(r.v[0]).toBeCloseTo(13 + R * w * Math.cos(f), 9);
    expect(r.v[1]).toBe(-7);
    expect(r.v[2]).toBe(3);
    expect(r.ae[1]).toBeCloseTo(R * w * w * Math.sin(f) * Math.cos(f), 12);
    expect(r.ae[2]).toBeCloseTo(-R * w * w * Math.cos(f) ** 2, 12);
    // 23.62 (v_h = 0): курс k, w_cx = −2vω cos k sin φ, w_cy = 2vω sin k sin φ, w_cz = −2vω sin k cos φ.
    const q = solveEarthKin({ ...p, vin: 'course', v: 11, k: 63, vh: 0 });
    const k = (63 * Math.PI) / 180;
    expect(q.ac[0]).toBeCloseTo(-2 * 11 * w * Math.cos(k) * Math.sin(f), 12);
    expect(q.ac[1]).toBeCloseTo(2 * 11 * w * Math.sin(k) * Math.sin(f), 12);
    expect(q.ac[2]).toBeCloseTo(-2 * 11 * w * Math.sin(k) * Math.cos(f), 12);
    // 23.63: горизонтальная составляющая 2vω sin φ, влево от скорости.
    expect(q.acH).toBeCloseTo(2 * 11 * w * Math.sin(f), 12);
    expect((q.acHk - 63 + 360) % 360).toBeCloseTo(270, 6);
  });
  it('v и a равны производным положения в неподвижных осях (точка с постоянными v_E, v_N, v_h)', () => {
    for (const p of [
      { ...EARTH0, lat: 52, h: 300, R: 6.4e6, omega: 7.3e-5, vE: 250, vN: -180, vh: 40 },
      { ...EARTH0, lat: -20, h: 0, R: 1e5, omega: 3e-3, vE: -90, vN: 60, vh: -15, dE: 0.4, dN: -0.2, dh: 0.1 },
    ] as EarthKin[]) {
      // Сферические координаты относительно Земли: ρ̇ = v_h, φ̇ = v_N/ρ, λ̇ = v_E/(ρ cos φ), составляющие меняются на v̇.
      const step = (s: number[], dt: number) => {
        const d = (q: number[]) => [q[3], q[4] / q[0], q[5] / (q[0] * Math.cos(q[1])), p.dh, p.dN, p.dE];
        const k1 = d(s),
          k2 = d(s.map((x, i) => x + (dt / 2) * k1[i])),
          k3 = d(s.map((x, i) => x + (dt / 2) * k2[i])),
          k4 = d(s.map((x, i) => x + dt * k3[i]));
        return s.map((x, i) => x + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      };
      const s0 = [p.R + p.h, (p.lat * Math.PI) / 180, 0, p.vh, p.vN, p.vE];
      const pos = (t: number) => {
        let s = s0;
        const n = 50;
        for (let i = 0; i < n; i++) s = step(s, t / n);
        const [rho, f, l] = s,
          L = l + p.omega * t;
        return [rho * Math.cos(f) * Math.cos(L), rho * Math.cos(f) * Math.sin(L), rho * Math.sin(f)];
      };
      const h = 0.05;
      const pp = pos(h),
        pm = pos(-h),
        p0 = pos(0);
      const vI = pp.map((x, i) => (x - pm[i]) / (2 * h)),
        aI = pp.map((x, i) => (x - 2 * p0[i] + pm[i]) / (h * h));
      const f = s0[1];
      // Оси места в момент 0 (λ = 0): восток (0, 1, 0), север (−sin φ, 0, cos φ), вверх (cos φ, 0, sin φ).
      const E = [0, 1, 0],
        N = [-Math.sin(f), 0, Math.cos(f)],
        U = [Math.cos(f), 0, Math.sin(f)];
      const pr = (x: number[]) => [E, N, U].map((e) => e[0] * x[0] + e[1] * x[1] + e[2] * x[2]);
      const r = solveEarthKin(p);
      pr(vI).forEach((x, i) => expect(Math.abs(x - r.v[i])).toBeLessThan(1e-4 * norm(r.v)));
      pr(aI).forEach((x, i) => expect(Math.abs(x - r.a[i])).toBeLessThan(2e-4 * norm(r.a)));
    }
  });
});

describe('Мещерский §22: треугольник скоростей', () => {
  for (const [key, p] of Object.entries(TRI_PRESETS))
    it(p.title, () => {
      const r = solveTri(p.problem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      for (const [k, book] of Object.entries(p.book)) {
        const got = pickTri(r, k);
        expect(Math.min(...got.map((g) => Math.abs(g - book))), `${k}: ${got} против ${book}`).toBeLessThanOrEqual(k[0] === 'd' ? 0.01 : tol(book));
      }
    });
  it('любые два неизвестных из шести: решение восстанавливает исходный треугольник', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const items = ['vm', 'vd', 'em', 'ed', 'rm', 'rd'];
    for (let n = 0; n < 40; n++)
      for (let i = 0; i < 6; i++)
        for (let j = i + 1; j < 6; j++)
          for (const what of ['v', 'a'] as const)
            for (const compass of [false, true]) {
              const e = { mod: 1 + 9 * rnd(), dir: 360 * rnd() },
                rr = { mod: 1 + 9 * rnd(), dir: 360 * rnd() },
                c = what === 'a' ? { mod: 3 * rnd(), dir: 360 * rnd() } : { mod: 0, dir: 0 };
              const u = (d: number) =>
                compass ? [Math.sin((d * Math.PI) / 180), Math.cos((d * Math.PI) / 180)] : [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)];
              const vx = e.mod * u(e.dir)[0] + rr.mod * u(rr.dir)[0] + c.mod * u(c.dir)[0],
                vy = e.mod * u(e.dir)[1] + rr.mod * u(rr.dir)[1] + c.mod * u(c.dir)[1];
              const vd = compass ? (Math.atan2(vx, vy) * 180) / Math.PI : (Math.atan2(vy, vx) * 180) / Math.PI;
              const truth: Record<string, number> = { vm: Math.hypot(vx, vy), vd: (vd + 360) % 360, em: e.mod, ed: e.dir, rm: rr.mod, rd: rr.dir };
              const mk = (k: string): TriItem => ({
                mod: truth[k + 'm'],
                dir: truth[k + 'd'],
                qm: items[i] === k + 'm' || items[j] === k + 'm',
                qd: items[i] === k + 'd' || items[j] === k + 'd',
              });
              const p: TriProblem = { ...structuredClone(TRI0), what, compass, c, v: mk('v'), e: mk('e'), r: mk('r') };
              // Неизвестные значения в полях — мусор: решатель не должен их читать.
              for (const k of TRI_VECS) {
                if (p[k].qm) p[k].mod = 123;
                if (p[k].qd) p[k].dir = 77;
              }
              const r = solveTri(p);
              expect(r.ok, r.errors.join()).toBe(true);
              const ok = r.sols.some((s) =>
                TRI_VECS.every(
                  (k) => Math.abs(s[k].mod - truth[k + 'm']) < 1e-7 * 10 && Math.abs((((s[k].dir ?? 0) - truth[k + 'd'] + 540) % 360) - 180) < 1e-6,
                ),
              );
              expect(ok, `${items[i]}, ${items[j]}`).toBe(true);
            }
  });
  it('неверное число неизвестных и незамыкающийся треугольник — сообщение', () => {
    expect(solveTri({ ...structuredClone(TRI0), v: { mod: 1, dir: 0, qm: true, qd: false } }).errors[0]).toMatch(/два/);
    expect(
      solveTri({
        ...structuredClone(TRI0),
        v: { mod: 0.1, dir: 0, qm: false, qd: false },
        e: { mod: 5, dir: 0, qm: false, qd: true },
        r: { mod: 1, dir: 0, qm: false, qd: true },
      }).ok,
    ).toBe(false);
  });
});

describe('Мещерский §33, 23.52: движение вблизи вращающейся Земли', () => {
  for (const [key, p] of Object.entries(DYN_PRESETS))
    it(p.title, () => {
      const r = solveEarthDyn(p.problem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      for (const [k, book] of Object.entries(p.book)) {
        const got = pickDyn(r, k);
        expect(Math.abs(got - book), `${k}: ${got} против ${book}`).toBeLessThanOrEqual(p.relTol * Math.abs(book));
      }
    });
  it('33.4: давление 385,2 кГ на восточный рельс; при движении на юг — на западный', () => {
    const n = solveEarthDyn(DYN_PRESETS.d334.problem).line!;
    expect(n.FH).toBeCloseTo(385.19, 1);
    expect(n.FHk).toBeCloseTo(90, 9);
    const s = solveEarthDyn({ ...DYN_PRESETS.d334.problem, k: 180 }).line!;
    expect(s.FH).toBeCloseTo(n.FH, 9);
    expect(s.FHk).toBeCloseTo(270, 9);
  });
  it('падение: отклонение на восток совпадает с ⅓ωgT³cos φ, на север — второго порядка', () => {
    for (const lat of [10, 45, 80]) {
      const f = solveEarthDyn({ ...DYN_PRESETS.d335.problem, lat, h: 2000 }).fall!;
      expect(f.dev[0]).toBeCloseTo(f.approxE!, 4);
      expect(Math.abs(f.dev[1])).toBeLessThan(0.01 * f.dev[0]);
    }
  });
  it('бросок вверх: точка падает западнее на ⁴⁄₃ω cos φ·v₀³/g²', () => {
    const v0 = 50,
      g = 9.81,
      w = OMEGA_SOLAR,
      f = Math.PI / 4;
    const r = solveEarthDyn({ ...DYN_PRESETS.d335.problem, lat: 45, h: 0, vh: v0 }).fall!;
    // Первое приближение: x = −(4/3)ω cos φ·v₀³/g² (на запад).
    expect(r.dev[0]).toBeCloseTo(((-4 / 3) * w * Math.cos(f) * v0 ** 3) / g ** 2, 5);
  });
  it('g по широте: на полюсе g₀, на экваторе g₀ − ω²R', () => {
    const base = DYN_PRESETS.d3315.problem;
    expect(solveEarthDyn({ ...base, lat: 90 }).gr!.gPhi).toBeCloseTo(base.g, 12);
    expect(solveEarthDyn({ ...base, lat: 0 }).gr!.gPhi).toBeCloseTo(base.g - base.omega ** 2 * base.R, 12);
  });
});

describe('файлы проекта', () => {
  it('«Сложное движение»: режимы «Земля» и «треугольник» сохраняются и открываются', () => {
    for (const k of ['e2357', 't226'] as const) {
      const a = new RelStore({ preset: k });
      const f = a.exportProject();
      const b = new RelStore();
      expect(b.importProject(f.text)).toBe(true);
      expect(b.get().mode).toBe(a.get().mode);
      expect(b.get().earth).toEqual(a.get().earth);
      expect(b.get().tri).toEqual(a.get().tri);
    }
  });
  it('старый файл «Сложного движения» (без режима) открывается как точка на теле', () => {
    const a = new RelStore({ preset: 'r2331' });
    const env = JSON.parse(a.exportProject().text);
    delete env.mode;
    delete env.earth;
    delete env.tri;
    const b = new RelStore({ preset: 't229' });
    expect(b.importProject(JSON.stringify(env))).toBe(true);
    expect(b.get().mode).toBe('body');
    expect(b.get().problem).toEqual(a.get().problem);
  });
  it('«Динамика точки»: режим «вращение Земли» сохраняется и открывается', () => {
    const a = new PointStore({ preset: 'd3317' });
    const b = new PointStore();
    expect(b.importProject(a.exportProject().text)).toBe(true);
    expect(b.get().problem.mode).toBe('earth');
    expect(b.get().problem.earth).toEqual(a.get().problem.earth);
  });
});
