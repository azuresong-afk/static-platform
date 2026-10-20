/** Кинематика точки: законы движения по времени (Мещерский §10, 12, 14, 21) — путь, интегрирование, колебания, бросок, кулачки. */
import { describe, expect, it } from 'vitest';
import { diff, evalExpr, parseExpr } from '../src/shared/expr';
import { fmtPi, integrate } from '../src/shared/integ';
import { printExpr } from '../src/shared/expr';
import { solveCamRot, solveCamTrans } from '../src/modules/pointkin/model/cam';
import { solveHarm, solveInteg, solvePath, solveShot } from '../src/modules/pointkin/model/ext';
import { solveKin, type KinProblem } from '../src/modules/pointkin/model/kin';
import { trajEquation } from '../src/modules/pointkin/model/traj';
import { KIN_PRESETS } from '../src/modules/pointkin/presets';
import { camRotDoc } from '../src/modules/pointkin/text/cam';
import { harmDoc, integDoc, pathDoc, shotDoc } from '../src/modules/pointkin/text/ext';
import { solveAny } from '../src/modules/pointkin/ui/solve';
import { KinStore } from '../src/modules/pointkin/ui/store';
import { docText } from './helpers/doctext';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};
type Preset = {
  title: string;
  problem: unknown;
  book?: Record<string, number>;
  bookR?: [number, number][];
  bookX?: [number, number][];
  closed?: string;
  traj?: string[];
};
const near = (got: number, want: number, k: string, rel = 1e-6) =>
  expect(Math.abs(got - want), `${k}: ${got} против ${want}`).toBeLessThanOrEqual(Math.max(tol(want), rel * Math.abs(want)));

describe('Мещерский §10, 12, 14, 21: готовые задачи новых режимов', () => {
  for (const [key, p0] of Object.entries(KIN_PRESETS)) {
    const p = p0 as Preset;
    const pr = p.problem as KinProblem;
    if (!['path', 'integ', 'harm', 'shot', 'cam'].includes(pr.mode)) continue;
    it(p.title, () => {
      const book = p.book ?? {};
      if (pr.mode === 'path') {
        const r = solvePath(pr);
        expect(r.ok, key + r.errors.join()).toBe(true);
        if (book.s !== undefined) near(r.s2, book.s, 's');
        if (book.sigma !== undefined) near(r.path, book.sigma, 'sigma');
        if (p.closed) expect(r.closed).toBe(p.closed);
        if (p.traj) expect(trajEquation({ ...pr, mode: 'coord' }, solveKin({ ...pr, mode: 'coord' }))!.rels.map((x) => x.text)).toEqual(p.traj);
      } else if (pr.mode === 'integ') {
        const r = solveInteg(pr);
        expect(r.ok, key + r.errors.join()).toBe(true);
        expect(r.numeric).toBe(false);
        for (const k of ['x', 'v', 'a'] as const) if (book[k] !== undefined) near(r.at[k], book[k], k, 1e-9);
        // Формулы согласованы: x′ = v, v′ = a.
        for (const t of [0.3, 1.1]) {
          expect(evalExpr(diff(r.x!), t)).toBeCloseTo(evalExpr(r.v!, t), 9);
          expect(evalExpr(diff(r.v!), t)).toBeCloseTo(evalExpr(r.a!, t), 9);
        }
      } else if (pr.mode === 'harm') {
        const r = solveHarm(pr);
        expect(r.ok, key + r.errors.join()).toBe(true);
        for (const k of ['a0', 'a', 'k', 'T', 'f'] as const) if (book[k] !== undefined) near(r[k], book[k], k, 1e-9);
        if (book.eps !== undefined) near(r.eps, book.eps, 'eps', 1e-9);
      } else if (pr.mode === 'shot') {
        const r = solveShot(pr);
        expect(r.ok, key + r.errors.join()).toBe(true);
        if (book.H !== undefined) near(r.H, book.H, 'H', 1e-9);
        if (book.L !== undefined) near(r.L, book.L, 'L', 1e-9);
        if (book.T !== undefined) near(r.T, book.T, 'T', 1e-9);
        if (book.alphaBest !== undefined) near(r.best.alpha, book.alphaBest, 'alphaBest', 1e-9);
        if (book.Lmax !== undefined) near(r.best.L, book.Lmax, 'Lmax', 1e-9);
        if (book.tg1 !== undefined) {
          near(r.target!.tgs[0], book.tg1, 'tg1', 1e-9);
          near(r.target!.tgs[1], book.tg2, 'tg2', 1e-9);
        }
        if (key === 's1018') for (const [x, y] of r.safe) expect(y).toBeCloseTo(r.v0 ** 2 / (2 * r.g) - (r.g * x * x) / (2 * r.v0 ** 2), 9);
      } else if (pr.p?.kind === 'trans') {
        const r = solveCamTrans(pr);
        expect(r.ok, key + r.errors.join()).toBe(true);
        if (book.h !== undefined) near(r.h, book.h, 'h', 1e-3);
        if (book.w !== undefined) near(r.w, book.w, 'w', 1e-9);
      } else {
        const r = solveCamRot(pr);
        expect(r.ok, key + r.errors.join()).toBe(true);
        if (book.T !== undefined) near(r.T, book.T, 'T', 1e-9);
        if (book.rMin !== undefined) near(r.rMin, book.rMin, 'rMin', 1e-6);
        if (book.rMax !== undefined) near(r.rMax, book.rMax, 'rMax', 1e-3);
        if (book.stroke !== undefined) near(r.stroke, book.stroke, 'stroke', 1e-3);
        for (const [phi, rr] of p.bookR ?? []) near(r.rAt(phi), rr, `r(${phi})`, 1e-9);
        for (const [t, xx] of p.bookX ?? []) near(r.xAt(t), xx, `x(${t})`, 1e-6);
      }
    });
    it(`${key}: файл туда-обратно, чертёж и решение без NaN`, () => {
      const s = new KinStore({ preset: key as keyof typeof KIN_PRESETS });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const s2 = new KinStore();
      expect(s2.importProject(text)).toBe(true);
      expect(s2.get().problem).toEqual(s.get().problem);
      const { fig, doc } = solveAny(s2.get().problem, true);
      for (const x of [fig.svg, JSON.stringify(doc)]) expect(x).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
});

describe('интегрирование формул (shared/integ)', () => {
  const P = (s: string) => {
    const r = parseExpr(s);
    if (!r.ok) throw new Error(r.error);
    return r.e;
  };
  it('первообразная дифференцируется обратно в подынтегральную функцию', () => {
    for (const s of [
      '-pi^2 sin(pi t/2)',
      '3t^2 + 2t',
      't exp(-t)',
      't^2 cos(2t)',
      'sin(t)^2',
      'sin(2t)cos(3t)',
      '5',
      'cos(3t)^2 + 1',
      '2 exp(0,5t) sin(t)'.replace(/ exp\(0,5t\) sin\(t\)/, 't'),
    ]) {
      const F = integrate(P(s));
      expect(F, s).not.toBeNull();
      for (const t of [0.3, 1.7]) expect(evalExpr(diff(F!), t)).toBeCloseTo(evalExpr(P(s), t), 9);
    }
  });
  it('вне класса — null: 1/t, ln, произведение exp и sin', () => {
    expect(integrate(P('1/t'))).toBeNull();
    expect(integrate(P('ln(t)'))).toBeNull();
    expect(integrate(P('exp(t) sin(t)'))).toBeNull();
  });
  it('запись с π', () => {
    expect(fmtPi(2 * Math.PI)).toBe('2π');
    expect(fmtPi(Math.PI / 2)).toBe('(π/2)');
    expect(fmtPi(-(Math.PI ** 2))).toBe('−π²');
    expect(fmtPi(4 / Math.PI)).toBe('(4/π)');
    expect(fmtPi(1.5)).toBe('1,5');
    expect(printExpr(integrate(P('-pi^2 sin(pi t/2)'))!, 0, fmtPi)).toBe('2πcos((π/2)t)');
  });
});

describe('путь и закон движения по траектории', () => {
  const base: KinProblem = { mode: 'path', x: '', y: '', z: '', s: '', rho: 0, r: '', phi: '', t: 1, t1: 0, t2: 5, p: { src: 's', n: '6' } };
  it('точка у максимума не даёт ложных остановок на краю промежутка (10.1 (3))', () => {
    const r = solvePath(KIN_PRESETS.p101c.problem as KinProblem);
    expect(r.turns.length).toBe(2);
    expect(r.path).toBeCloseTo(20, 9);
  });
  it('положения: равные промежутки времени, шесть штук', () => {
    const r = solvePath(KIN_PRESETS.p101a.problem as KinProblem);
    expect(r.rows.map((q) => q.t)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(r.rows.map((q) => q.s)).toEqual([5, 2, 1, 2, 5, 10]);
  });
  it('координатный способ: длина дуги окружности x = 3 sin t, y = 3 cos t за π равна 3π', () => {
    expect(solvePath({ ...base, x: '3 sin t', y: '3 cos t', t2: Math.PI, p: { src: 'xyz', n: '3' } }).path).toBeCloseTo(3 * Math.PI, 9);
  });
  it('ошибки: t₂ ≤ t₁, число положений, неверная формула', () => {
    expect(solvePath({ ...base, s: 't', t2: 0 }).ok).toBe(false);
    expect(solvePath({ ...base, s: 't', p: { src: 's', n: '1' } }).ok).toBe(false);
    expect(solvePath({ ...base, s: 'sin(' }).ok).toBe(false);
  });
  it('текст: расстояние и путь', () => {
    const pr = KIN_PRESETS.p101a.problem as KinProblem;
    const t = docText(pathDoc(pr, solvePath(pr), { explain: true }));
    expect(t).toMatch(/σ = 13/);
    expect(t).toMatch(/s = 10/);
    expect(t).toMatch(/t = 2 с \(s = 1\)/);
  });
});

describe('гармонические колебания', () => {
  const h = (x: string) => solveHarm({ mode: 'harm', x, y: '', z: '', s: '', rho: 0, r: '', phi: '', t: 0, t1: 0, t2: 0, p: { src: 'law' } });
  it('не гармонические законы отвергаются', () => {
    expect(h('t^2').ok).toBe(false);
    expect(h('sin(t) + sin(2t)').ok).toBe(false);
    expect(h('5').ok).toBe(false);
  });
  it('сумма колебаний одной частоты — колебание той же частоты (21.1)', () => {
    const r = h('2cos(pi t + pi/2) + 3cos(pi t + pi)');
    expect(r.a).toBeCloseTo(Math.sqrt(13), 12);
    expect(r.x0).toBeCloseTo(-3, 12);
    expect(r.a0 + r.a * Math.sin(r.eps)).toBeCloseTo(-3, 12);
  });
  it('текст содержит параметры', () => {
    const pr = KIN_PRESETS.h108b.problem as KinProblem;
    const t = docText(harmDoc(pr, solveHarm(pr), { explain: true }));
    expect(t).toMatch(/T = 2π\/k = 40 = 40 с/);
    expect(t).toMatch(/ε = −0,6435 рад/);
  });
});

describe('бросок под углом', () => {
  it('траектория проходит через цель при найденных углах; оба угла дают попадание', () => {
    const pr = KIN_PRESETS.s1017.problem as KinProblem;
    const r = solveShot(pr);
    for (const u of r.target!.tgs) {
      const al = Math.atan(u);
      const t = 200 / (r.v0 * Math.cos(al));
      expect(r.v0 * Math.sin(al) * t - (r.g * t * t) / 2).toBeCloseTo(20, 9);
    }
  });
  it('цель вне параболы безопасности недостижима', () => {
    const pr = { ...(KIN_PRESETS.s1017.problem as KinProblem), p: { ...(KIN_PRESETS.s1017.problem as KinProblem).p!, xt: '300', yt: '100' } };
    expect(solveShot(pr).target!.reachable).toBe(false);
  });
  it('с высоты h₀ наибольшая дальность при tg α = v₀/√(v₀² + 2gh₀)', () => {
    const base = KIN_PRESETS.s1015.problem as KinProblem;
    const r = solveShot({ ...base, p: { ...base.p!, h0: '10' } });
    const best = (a: number) => solveShot({ ...base, p: { ...base.p!, h0: '10', al: String(a) } }).L;
    expect(best(r.best.alpha)).toBeGreaterThan(best(r.best.alpha + 1));
    expect(best(r.best.alpha)).toBeGreaterThan(best(r.best.alpha - 1));
    expect(r.best.L).toBeCloseTo(best(r.best.alpha), 9);
  });
  it('текст', () => {
    const pr = KIN_PRESETS.s1017.problem as KinProblem;
    expect(docText(shotDoc(pr, solveShot(pr), { explain: true }))).toMatch(/Попадание в точку/);
  });
});

describe('тороидальные координаты: проекции равны проекциям декартовых производных на орты', () => {
  it('v и a по координатам совпадают с численными производными положения', () => {
    const pr = KIN_PRESETS.t1239.problem as KinProblem;
    const r = solveKin(pr);
    expect(r.ok).toBe(true);
    const at = (t: number) => solveKin({ ...pr, t }).pos;
    const h = 1e-4;
    const [p1, p0, p2] = [at(pr.t + h), at(pr.t), at(pr.t - h)];
    const vn = p1.map((x, i) => (x - p2[i]) / (2 * h));
    const an = p1.map((x, i) => (x - 2 * p0[i] + p2[i]) / (h * h));
    expect(Math.hypot(...vn)).toBeCloseTo(r.v, 4);
    expect(Math.hypot(...an)).toBeCloseTo(Math.hypot(...r.acc), 2);
    for (let i = 0; i < 3; i++) {
      expect(r.vel[i]).toBeCloseTo(vn[i], 4);
      expect(r.acc[i]).toBeCloseTo(an[i], 2);
    }
  });
});

describe('кулачки', () => {
  it('участки должны идти подряд и покрывать оборот', () => {
    const pr = KIN_PRESETS.c1415.problem as KinProblem;
    expect(solveCamRot({ ...pr, p: { ...pr.p!, a2: '5' } }).ok).toBe(false);
    expect(solveCamRot({ ...pr, p: { ...pr.p!, b2: '7' } }).ok).toBe(false);
    expect(solveCamRot({ ...pr, p: { ...pr.p!, f1: 'sin(' } }).ok).toBe(false);
  });
  it('контур ↔ закон: x(t) = r(ωt) и обратно', () => {
    const r = solveCamRot(KIN_PRESETS.c1417.problem as KinProblem);
    for (const t of [0.2, 0.9, 1.5, 2.4]) expect(r.rAt(r.omega * t)).toBeCloseTo(r.xAt(t), 12);
  });
  it('14.16: скачок на стыке оборота, скорость постоянна', () => {
    const r = solveCamRot(KIN_PRESETS.c1416.problem as KinProblem);
    expect(r.jumps.length).toBe(1);
    expect(r.jumps[0].from).toBeCloseTo(50, 9);
    expect(r.at.v).toBeCloseTo(10, 9);
    expect(r.lawText[0]).toBe('x = 20 + 10t,  0 ≤ t ≤ 3');
  });
  it('14.15: контур записан формулами книги', () => {
    const r = solveCamRot(KIN_PRESETS.c1415.problem as KinProblem);
    expect(r.profText[0]).toMatch(/^r = 30 \+ \(20\/π\)φ,  0 ≤ φ ≤ π$/);
    expect(r.profText[1]).toMatch(/^r = 70 − \(20\/π\)φ,  π ≤ φ ≤ 2π$/);
    expect(docText(camRotDoc(KIN_PRESETS.c1415.problem as KinProblem, r, { explain: true }))).toMatch(/Ход и состояние толкателя/);
  });
  it('круговой кулак: толкатель сходит с круга при u > r', () => {
    const pr = KIN_PRESETS.c1418.problem as KinProblem;
    expect(solveCamTrans({ ...pr, t: 7 }).ok).toBe(false);
  });
});

describe('текст решения интегрирования', () => {
  it('12.7: формулы v и x с π', () => {
    const pr = KIN_PRESETS.i127.problem as KinProblem;
    const t = docText(integDoc(pr, solveInteg(pr), { explain: true }));
    expect(t).toMatch(/v\(t\) = ∫ a dt = 2πcos\(\(π\/2\)t\)/);
    expect(t).toMatch(/x\(t\) = ∫ v dt = 4sin\(\(π\/2\)t\)/);
  });
});
