import { describe, expect, it } from 'vitest';
import { keplerE, nuOfE, eOfNu, pointOf, pointOfE, solveBinet, solveTraj, type TrajProblem } from '../src/modules/orbit/model/traj';
import { elementsOf } from '../src/modules/orbit/model/orbit';
import { traj } from '../src/modules/orbit/presets';

const MU = 398000;
const rad = (a: number) => (a * Math.PI) / 180;

describe('уравнение Кеплера и аномалии', () => {
  it('E − e sin E = M для любых e < 1 и M', () => {
    for (const e of [0, 0.01, 0.3, 0.7, 0.95, 0.999])
      for (let i = -12; i <= 12; i++) {
        const M = i * 0.5;
        const { E } = keplerE(M, e);
        let d = E - e * Math.sin(E) - M;
        d = ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
        expect(Math.abs(d), `e=${e} M=${M}`).toBeLessThan(1e-12);
      }
  });
  it('50.30: tg(ν/2) = √((1+e)/(1−e))·tg(E/2), обратное преобразование', () => {
    for (const e of [0.1, 0.5, 0.9])
      for (const E of [-2.5, -1, 0.3, 1.2, 3]) {
        const nu = nuOfE(E, e);
        expect(Math.tan(nu / 2)).toBeCloseTo(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E / 2), 9);
        expect(eOfNu(nu, e)).toBeCloseTo(E, 12);
        expect(1 + e * Math.cos(nu)).toBeCloseTo((1 - e * e) / (1 - e * Math.cos(E)), 12);
      }
  });
  it('50.31: v² = μ(2/r − 1/a) = (μ/a)(1 + e cos E)/(1 − e cos E); 50.33: компоненты', () => {
    const a = 9000,
      e = 0.35;
    for (const E of [0.4, 1.3, 2.2, -2.8]) {
      const q = pointOfE(MU, a, e, E);
      expect(q.v ** 2).toBeCloseTo(MU * (2 / q.r - 1 / a), 9);
      expect(q.v ** 2).toBeCloseTo((MU / a) * ((1 + e * Math.cos(E)) / (1 - e * Math.cos(E))), 9);
      expect(Math.hypot(q.vx, q.vy)).toBeCloseTo(q.v, 9);
      // орбитальная система: v = √(μ/p)·(e_r sin ν + e_φ (1 + e cos ν))
      const p = a * (1 - e * e);
      expect(q.vr).toBeCloseTo(Math.sqrt(MU / p) * e * Math.sin(q.nu), 9);
      // инерциальная: v_x = −√(μ/a)·sin E/(1 − e cos E)
      expect(q.vx).toBeCloseTo((-Math.sqrt(MU / a) * Math.sin(E)) / (1 - e * Math.cos(E)), 9);
      expect(q.vy).toBeCloseTo((Math.sqrt(MU / a) * Math.sqrt(1 - e * e) * Math.cos(E)) / (1 - e * Math.cos(E)), 9);
    }
  });
  it('50.32: v² = v_п·v_а в точках E = ±90° (концы малой оси)', () => {
    const a = 12000,
      e = 0.6;
    const vp = pointOfE(MU, a, e, 0).v,
      va = pointOfE(MU, a, e, Math.PI).v;
    for (const E of [Math.PI / 2, -Math.PI / 2]) expect(pointOfE(MU, a, e, E).v).toBeCloseTo(Math.sqrt(vp * va), 9);
  });
  it('50.34: наибольший угол с горизонтом — при E = ±90°, sin γ = e', () => {
    const a = 12000,
      e = 0.6;
    let best = 0,
      at = 0;
    for (let i = 1; i < 3600; i++) {
      const E = (i * Math.PI) / 3600;
      const g = pointOfE(MU, a, e, E).gamma;
      if (g > best) ((best = g), (at = E));
    }
    expect(at).toBeCloseTo(Math.PI / 2, 2);
    expect(Math.sin(rad(best))).toBeCloseTo(e, 5);
    const r = solveTraj(traj({ kind: 'point', a, e, anom: 'E', x1: 30 }));
    expect(r.special!.gammaMax).toBeCloseTo(Math.asin(e) * (180 / Math.PI), 9);
  });
  it('50.28: среднее значение r по времени = a(1 + e²/2), по углу φ — b, по E — a', () => {
    const a = 7000,
      e = 0.4;
    const T = 2 * Math.PI * Math.sqrt(a ** 3 / MU);
    const N = 200000;
    let st = 0,
      sphi = 0,
      sE = 0;
    for (let i = 0; i < N; i++) {
      const M = ((i + 0.5) / N) * 2 * Math.PI;
      const { E } = keplerE(M, e);
      const q = pointOfE(MU, a, e, E);
      st += q.r / N;
      sE += q.r / N; // равномерно по M — это среднее по времени
    }
    expect(st).toBeCloseTo(a * (1 + (e * e) / 2), 3);
    for (let i = 0; i < N; i++) {
      const f = ((i + 0.5) / N) * 2 * Math.PI;
      sphi += (a * (1 - e * e)) / (1 + e * Math.cos(f)) / N;
    }
    expect(sphi).toBeCloseTo(a * Math.sqrt(1 - e * e), 3);
    let sEE = 0;
    for (let i = 0; i < N; i++) sEE += (a * (1 - e * Math.cos(((i + 0.5) / N) * 2 * Math.PI))) / N;
    expect(sEE).toBeCloseTo(a, 6);
    const r = solveTraj(traj({ kind: 'mean', a, e }));
    expect(r.mean!.t).toBeCloseTo(a * (1 + (e * e) / 2), 9);
    expect(r.T).toBeCloseTo(T, 6);
    void sE;
  });
  it('время пролёта: перицентр → апоцентр = T/2, четверть оборота по ν не равна T/4', () => {
    const r = solveTraj(traj({ kind: 'time', a: 8000, e: 0.5, anom: 'nu', x1: 0, x2: 180, muMode: 'mu', mu: MU }));
    expect(r.dt!).toBeCloseTo(r.T / 2, 6);
    const q = solveTraj(traj({ kind: 'time', a: 8000, e: 0.5, anom: 'nu', x1: 0, x2: 90, muMode: 'mu', mu: MU }));
    // E = acos(e) = 60°, M = π/3 − e sin 60° → t
    expect(q.dt!).toBeCloseTo((Math.PI / 3 - 0.5 * Math.sin(Math.PI / 3)) / q.n, 6);
    const w = solveTraj(traj({ kind: 'time', a: 8000, e: 0.5, anom: 'nu', x1: 90, x2: 0, muMode: 'mu', mu: MU }));
    expect(w.dt! + q.dt!).toBeCloseTo(q.T, 6);
    // точка по времени возвращает ту же аномалию
    const pt = pointOf(MU, 8000, 0.5, 't', q.dt!);
    expect(pt.nu).toBeCloseTo(rad(90), 9);
  });
});

describe('граница падения 50.24–50.25', () => {
  const mu = MU,
    R = 6370;
  it('v_крит даёт перицентр r_п = R; выше — не падает, ниже — падает', () => {
    for (const [H, th] of [
      [300, 0],
      [300, -5],
      [1000, 3],
      [5000, -20],
    ]) {
      const r0 = R + H;
      const f = solveTraj(traj({ kind: 'fall', muMode: 'mu', mu, R, r0, th0: th, v0: 0 })).fall!;
      expect(f.vcrit).not.toBeNull();
      const e = elementsOf(mu, r0, f.vcrit!, th, 0, R);
      expect(e.rp).toBeCloseTo(R, 6);
      expect(elementsOf(mu, r0, f.vcrit! * 1.02, th, 0, R).hit).toBeNull();
      if (th <= 0 || H > 0) expect(elementsOf(mu, r0, f.vcrit! * 0.98, th, 0, R).hit).not.toBeNull();
    }
  });
  it('внутри конуса падение при любой скорости', () => {
    const r0 = R + 300;
    const cone = Math.acos(R / r0) * (180 / Math.PI);
    const f = solveTraj(traj({ kind: 'fall', muMode: 'mu', mu, R, r0, th0: -cone - 1, v0: 20 })).fall!;
    expect(f.inside).toBe(true);
    expect(f.hits).toBe(true);
    expect(f.vcrit).toBeNull();
    const g = solveTraj(traj({ kind: 'fall', muMode: 'mu', mu, R, r0, th0: -cone + 1, v0: 3 })).fall!;
    expect(g.inside).toBe(false);
  });
  it('формула книги: v₀² = v₁²·2RH/((R+H)²cos²θ₀ − R²)', () => {
    const H = 300,
      th = -4;
    const r0 = R + H,
      v1 = Math.sqrt(mu / r0);
    const f = solveTraj(traj({ kind: 'fall', muMode: 'mu', mu, R, r0, th0: th, v0: 0 })).fall!;
    expect(f.vcrit! ** 2).toBeCloseTo(v1 ** 2 * ((2 * R * H) / ((R + H) ** 2 * Math.cos(rad(th)) ** 2 - R * R)), 6);
  });
});

describe('обратные задачи 50.15, 50.17, 50.18, 50.27', () => {
  it('50.15: a = p/(1−e²), b = p/√(1−e²), T = 2πab/c', () => {
    const r = solveTraj(traj({ kind: 'inverse', inv: 'axes', p: 7002, e: 0.0649, c: 52790 })).inverse!;
    expect(r.mu!).toBeCloseTo(52790 ** 2 / 7002, 6);
    expect(r.T!).toBeCloseTo(2 * Math.PI * Math.sqrt(r.a! ** 3 / r.mu!), 6);
  });
  it('50.17: e = (H/2)·∛(4π²/(μT²)); сверка с орбитой с a, e', () => {
    const a = 8000,
      e = 0.12;
    const T = 2 * Math.PI * Math.sqrt(a ** 3 / MU);
    const r = solveTraj(traj({ kind: 'inverse', inv: 'ecc', muMode: 'mu', mu: MU, T, Hd: 2 * a * e })).inverse!;
    expect(r.e!).toBeCloseTo(e, 9);
    expect(r.aNeed!).toBeCloseTo(a, 6);
  });
  it('50.18: большая полуось по e и отношению высот перигея и апогея', () => {
    const R = 6370,
      a = 9000,
      e = 0.2;
    const gam = (a * (1 - e) - R) / (a * (1 + e) - R);
    const r = solveTraj(traj({ kind: 'inverse', inv: 'sma', R, e, gam })).inverse!;
    expect(r.aNeed!).toBeCloseTo(a, 6);
    expect(solveTraj(traj({ kind: 'inverse', inv: 'sma', R, e: 0.9, gam: 0.5 })).ok).toBe(false);
  });
  it('50.27: масса Юпитера ≈ 1/1000 массы Солнца', () => {
    const aIo = 5.91 * 11.14 * 6370,
      aJ = 5.2 * 23000 * 6370;
    const r = solveTraj(traj({ kind: 'inverse', inv: 'mass', a1: aIo, T1: 1.77 * 86400, a2: aJ, T2: (11 * 365.25 + 314.84) * 86400 })).inverse!;
    expect(1 / r.ratio!).toBeGreaterThan(990);
    expect(1 / r.ratio!).toBeLessThan(1010);
  });
});

describe('формула Бине 50.12–50.13', () => {
  it('коника r = p/(1 + e cos φ): a_r = −μ/r², μ = c²/p', () => {
    const p = 7002,
      e = 0.0649,
      c = 52790;
    const b = solveBinet(`${p}/(1 + ${e} cos(t))`, c, 40);
    if (typeof b === 'string') throw new Error(b);
    expect(b.inverseSquare).toBe(true);
    expect(b.mu!).toBeCloseTo((c * c) / p, 3);
    expect(b.at.ar * b.at.r ** 2).toBeCloseTo(-(c * c) / p, 3);
    expect(b.power).toBeCloseTo(-2, 6);
  });
  it('28.18: r = 2e^φ → a_r = −2c²/r³; 28.19: r = 2cos φ → −8c²/r⁵', () => {
    const s = solveBinet('2 exp(t)', Math.sqrt(0.5), 20);
    if (typeof s === 'string') throw new Error(s);
    expect(s.inverseSquare).toBe(false);
    expect(s.power).toBeCloseTo(-3, 6);
    expect(s.at.ar * s.at.r ** 3).toBeCloseTo(-1, 9);
    const q = solveBinet('2 cos(t)', 1, 30);
    if (typeof q === 'string') throw new Error(q);
    expect(q.power).toBeCloseTo(-5, 5);
    expect(q.at.ar * q.at.r ** 5).toBeCloseTo(-8, 8);
  });
  it('окружность с центром в силовом центре: u″ + u = u, a = −c²/r³', () => {
    const q = solveBinet('5', 3, 0);
    if (typeof q === 'string') throw new Error(q);
    expect(q.at.ar).toBeCloseTo(-9 / 125, 12);
    expect(q.at.v).toBeCloseTo(3 / 5, 12);
  });
  it('лемниската r² = a²cos 2φ: сила ∝ r⁻⁷ (r = √cos 2φ), ошибка в формуле — сообщение', () => {
    const q = solveBinet('sqrt(cos(2t))', 1, 10);
    if (typeof q === 'string') throw new Error(q);
    expect(q.power).toBeCloseTo(-7, 4);
    expect(typeof solveBinet('2 +', 1, 0)).toBe('string');
    expect(typeof solveBinet('cos(t)', 1, 120)).toBe('string');
  });
});

describe('трасса спутника 50.6', () => {
  const base = { kind: 'track' as const, muMode: 'planet' as const, g: 9.81, R: 6370, H: 500, alpha: 60, Trot: 86164 };
  it('tg β = sin α/(cos α − Ω/n); Ω/n = Ω√(r³/μ)', () => {
    const r = solveTraj(traj(base));
    expect(r.ok).toBe(true);
    const t = r.track!;
    const mu = 9.81 * 6370 ** 2 * 1e-3;
    const k = ((2 * Math.PI) / 86164) * Math.sqrt(6870 ** 3 / mu);
    expect(t.k).toBeCloseTo(k, 12);
    expect(Math.tan(rad(t.beta))).toBeCloseTo(Math.sin(rad(60)) / (Math.cos(rad(60)) - k), 9);
    // «+» книги — для обратного вращения (α → 180° − α)
    const back = solveTraj(traj({ ...base, alpha: 120 })).track!;
    expect(back.beta).toBeCloseTo(180 - t.betaBook!, 9);
  });
  it('трасса: широта до наклонения, сдвиг за виток ΩT, первая точка на экваторе, угол на экваторе — β', () => {
    const t = solveTraj(traj({ ...base, turns: 3 })).track!;
    expect(Math.max(...t.pts.map((p) => p.lat))).toBeLessThanOrEqual(60 + 1e-9);
    expect(t.shift).toBeCloseTo((360 / 86164) * t.T, 6);
    expect(t.pts[0].lat).toBeCloseTo(0, 9);
    const q = t.pts[1],
      dl = q.lon - t.pts[0].lon;
    const beta = (Math.atan2(q.lat, dl * Math.cos(0)) * 180) / Math.PI;
    expect(beta).toBeCloseTo(t.beta, 0);
  });
  it('стационарная орбита в плоскости экватора — точка', () => {
    const mu = 9.81 * 6370 ** 2 * 1e-3;
    const rs = Math.cbrt((mu * 86164 ** 2) / (4 * Math.PI ** 2));
    const t = solveTraj(traj({ ...base, H: rs - 6370, alpha: 0 })).track!;
    expect(t.geo).toBe(true);
    expect(Math.abs(t.pts[50].lon)).toBeLessThan(1e-4);
  });
});

describe('ошибки данных', () => {
  const bads: Partial<TrajProblem>[] = [
    { kind: 'point', a: -1 },
    { kind: 'point', e: 1 },
    { kind: 'time', anom: 't' },
    { kind: 'fall', r0: 5000, R: 6370 },
    { kind: 'track', alpha: 200 },
    { kind: 'binet', cb: 0 },
  ];
  for (const b of bads)
    it(JSON.stringify(b), () => {
      const r = solveTraj(traj({ muMode: 'mu', mu: MU, ...b }));
      expect(r.ok).toBe(false);
      expect(r.errors.length).toBeGreaterThan(0);
    });
});

describe('§51: два тела и маховик', () => {
  it('51.1, 51.5: период по μ и по μ₁ около центра масс совпадают, a₁ + a₂ = a', () => {
    const r = solveTraj(traj({ kind: 'two', unit: 'm', m1: 5.972e24, m2: 7.348e22, a: 3.844e8, e: 0.05 })).two!;
    expect(r.T1).toBeCloseTo(r.T, 6);
    expect(r.a1 + r.a2).toBeCloseTo(3.844e8, 0);
    expect(r.mu1 + r.mu2).toBeLessThan(r.mu);
    // центр масс Земля — Луна внутри Земли (a₁ ≈ 4,67·10⁶ м < R = 6,37·10⁶ м)
    expect(r.a1).toBeLessThan(6.37e6);
    expect(solveTraj(traj({ kind: 'two', m1: 0 })).ok).toBe(false);
  });
  it('51.9: A = J₀(J₀ − J)Ω₀²/(2J) — разность кинетических энергий', () => {
    const f = solveTraj(traj({ kind: 'flywheel', fw: 'stop', Jf: 5, J0: 100, Om0: 0.1 })).fly!;
    expect(f.A).toBeCloseTo(0.5 * 5 * f.omF ** 2 - 0.5 * 100 * 0.01, 12);
    expect(solveTraj(traj({ kind: 'flywheel', Jf: 100, J0: 100 })).ok).toBe(false);
  });
  it('51.10–51.11: интегрирование — T, ψ и условие совпадают с формулами', () => {
    const J = 5,
      J0 = 100,
      Om0 = 0.1,
      kap = 2;
    const M0 = 8;
    const f = solveTraj(traj({ kind: 'flywheel', fw: 'motor', Jf: J, J0, Om0, M0, kap })).fly!;
    // Корпус: (J₀ − J)Ω̇ = −M, маховик (абсолютно): J(Ω̇ + ω̇) = M, M = M₀ − κω.
    let Om = Om0,
      w = 0,
      psi = 0,
      t = 0;
    const dt = 1e-5;
    while (Om > 0 && t < 100) {
      const M = M0 - kap * w;
      const dOm = -M / (J0 - J);
      const dw = M / J - dOm;
      psi += Om * dt;
      Om += dOm * dt;
      w += dw * dt;
      t += dt;
    }
    expect(t).toBeCloseTo(f.T!, 3);
    expect(psi).toBeCloseTo(f.psi!, 3);
    expect(solveTraj(traj({ kind: 'flywheel', fw: 'motor', Jf: J, J0, Om0, M0: f.Mmin! * 0.99, kap })).fly!.ok).toBe(false);
  });
  it('51.12: интегрирование с переключением u — корпус повернулся на ψ и остановился', () => {
    const J = 5,
      J0 = 100,
      Tc = 2,
      u0 = 1;
    const psiDeg = 30;
    const f = solveTraj(traj({ kind: 'flywheel', fw: 'turn', Jf: J, J0, Tc, u0, psi: psiDeg })).fly!;
    let w = 0,
      ang = 0,
      t = 0;
    const dt = 1e-5;
    const tEnd = f.t1! + f.t2!;
    while (t < tEnd) {
      const u = t < f.t1! ? u0 : -u0;
      w += (u - w / Tc) * dt;
      ang += (J / J0) * w * dt;
      t += dt;
    }
    expect(Math.abs(w)).toBeLessThan(2e-3);
    expect((ang * 180) / Math.PI).toBeCloseTo(psiDeg, 2);
    expect(f.omPeak!).toBeCloseTo(Tc * u0 * (1 - Math.exp(-f.t1! / Tc)), 9);
  });
});
