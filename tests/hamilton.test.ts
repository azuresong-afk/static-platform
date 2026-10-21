/** Интегралы движения, функции Рауса и Гамильтона, устойчивость, нелинейные колебания (Мещерский §49, 55, 56). */
import { describe, expect, it } from 'vitest';
import { lettersPlots, nonlinPlots, rollPlots, routhPlots, stabPlots, stringPlots } from '../src/modules/hamilton/draw/plots';
import { solveHJ, solveString, type HJSolution, type StringSolution } from '../src/modules/hamilton/model/jacobi';
import { solveLetters, type LetSolution } from '../src/modules/hamilton/model/letters';
import { solveNonlin, type NonlinSolution } from '../src/modules/hamilton/model/nonlin';
import { solveRoll, type RollSolution } from '../src/modules/hamilton/model/roll';
import { solveRouth, type RouthSolution } from '../src/modules/hamilton/model/routh';
import { charPoly, polyRoots, solveStability, type StabSolution } from '../src/modules/hamilton/model/stability';
import { HAM_PRESETS, type HamPreset, type HamProblem } from '../src/modules/hamilton/presets';
import { hjDoc, lettersDoc, rollDoc, stringDoc } from '../src/modules/hamilton/text/general';
import { nonlinDoc, routhDoc, stabDoc } from '../src/modules/hamilton/text/solution';
import { HamStore } from '../src/modules/hamilton/ui/store';
import { docHTML, type Doc } from '../src/shared/doc';
import { evalSym, setCoordNames, symText } from '../src/shared/sym';
import { taskInfo } from '../src/shared/tasks';

function got(pr: HamProblem): Record<string, number> {
  const g: Record<string, number> = {};
  const stable = (v: string) => (v === 'asym' || v === 'linear' ? 1 : 0);
  if (pr.mode === 'routh') {
    const r = solveRouth(pr.routh);
    if (!r.ok) throw new Error(r.error);
    if (r.nVal.length) g.n = r.nVal[0];
    if (r.steady && r.steady.residual < 1e-8) {
      g.stable = stable(r.steady.verdict);
      if (r.steady.freqs.length) {
        g.w = r.steady.freqs[0];
        g.T = (2 * Math.PI) / g.w;
      }
    }
  } else if (pr.mode === 'stab') {
    const r = solveStability(pr.stab);
    if (!r.ok) throw new Error(r.error);
    g.stable = stable(r.verdict);
    if (r.scan?.bounds.length) g.bound = r.scan.bounds[0];
  } else if (pr.mode === 'letters') {
    const r = solveLetters(pr.letters);
    if (!r.ok) throw new Error(r.error);
    if (r.verdict !== 'neutral') g.stable = stable(r.verdict);
    if (r.unknown) g.X = r.unknown.value;
    g.q = r.q[0];
    if (r.scan?.bounds.length) g.bound = r.scan.bounds[0];
    const sv = r.conds.find((c) => c.solved)?.solved;
    if (sv) g.cb = Math.pow(sv.value, 1 / sv.pow);
    if (r.freqs.length) {
      g.w = r.freqs[0];
      g.T = (2 * Math.PI) / g.w;
    }
    if (r.law) g.amp = r.law.amp;
  } else if (pr.mode === 'roll') {
    const r = solveRoll(pr.roll);
    if (!r.ok) throw new Error(r.error);
    g.stable = stable(r.verdict);
    if (r.scan?.bounds.length) g.bound = r.scan.bounds[0];
    const sv = r.cond.solved;
    if (sv) g.cb = Math.pow(sv.value, 1 / sv.pow);
    if (r.freq) g.w = r.freq;
  } else if (pr.mode === 'jacobi') {
    if (pr.jacobi.form === 'hj') {
      const r = solveHJ(pr.jacobi.hj);
      if (!r.ok) throw new Error(r.error);
      g.sep = r.separable ? 1 : 0;
      if (r.check) g.pdev = r.check.pDev;
    } else {
      const r = solveString(pr.jacobi.str);
      if (!r.ok) throw new Error(r.error);
      g.w1 = r.omega[0];
      g.w2 = r.omega[1];
    }
  } else {
    const r = solveNonlin(pr.nonlin);
    if (!r.ok) throw new Error(r.error);
    const c = r.cycles.find((x) => x.stable);
    if (c) {
      g.a = c.a;
      g.T = (2 * Math.PI) / c.omega;
    }
    if (r.measured) {
      g.Tm = r.measured.T;
      g.a1 = r.measured.a1;
    }
    // Частота гармонической линеаризации при амплитуде начального отклонения.
    if (r.avg) {
      const i = r.avg.a.findIndex((a) => a >= pr.nonlin.x0 - 1e-12);
      if (i >= 0) g.w = r.avg.w[i];
    }
  }
  return g;
}

describe('готовые задачи: ответы книги', () => {
  for (const [key, p0] of Object.entries(HAM_PRESETS)) {
    const p = p0 as HamPreset;
    it(p.title, () => {
      expect(['mesh', 'yab']).toContain(taskInfo(p.title).book);
      const g = got(p.problem);
      for (const [k, book] of Object.entries(p.book ?? {})) {
        expect(g[k], `${key}: нет ${k}`).toBeDefined();
        const tol = p.relTol ?? 1e-6;
        if (k === 'stable') expect(g[k], key).toBe(book);
        else expect(Math.abs(g[k] - book), `${key} ${k}: ${g[k]} против ${book}`).toBeLessThanOrEqual(tol * Math.max(1e-9, Math.abs(book)));
      }
    });
  }
  it('решение и графики строятся для всех задач', () => {
    for (const [key, p] of Object.entries(HAM_PRESETS)) {
      const html = render((p as HamPreset).problem, key);
      expect(html, key).toContain('Ответ');
      expect(html, key).not.toContain('NaN');
      expect(html, key).not.toContain('undefined');
    }
  });
});

/** Текст решения и графики задачи (ошибка решения — исключение). */
function render(pr: HamProblem, key: string): string {
  const o = { explain: true };
  const need = <T>(r: T | { ok: false; error: string }): T => {
    if ((r as { ok: boolean }).ok === false) throw new Error(`${key}: ${(r as { error: string }).error}`);
    return r as T;
  };
  let doc: Doc, svg: string | null;
  if (pr.mode === 'routh') {
    const r = need(solveRouth(pr.routh)) as RouthSolution;
    [doc, svg] = [routhDoc(pr.routh, r, o), routhPlots(r)?.svg ?? null];
  } else if (pr.mode === 'stab') {
    const r = need(solveStability(pr.stab)) as StabSolution;
    [doc, svg] = [stabDoc(pr.stab, r, o), stabPlots(r).svg];
  } else if (pr.mode === 'nonlin') {
    const r = need(solveNonlin(pr.nonlin)) as NonlinSolution;
    [doc, svg] = [nonlinDoc(pr.nonlin, r, o), nonlinPlots(r).svg];
  } else if (pr.mode === 'letters') {
    const r = need(solveLetters(pr.letters)) as LetSolution;
    [doc, svg] = [lettersDoc(pr.letters, r, o), lettersPlots(r)?.svg ?? null];
  } else if (pr.mode === 'roll') {
    const r = need(solveRoll(pr.roll)) as RollSolution;
    [doc, svg] = [rollDoc(pr.roll, r, o), rollPlots(r).svg];
  } else if (pr.jacobi.form === 'hj') {
    const r = need(solveHJ(pr.jacobi.hj)) as HJSolution;
    [doc, svg] = [hjDoc(pr.jacobi.hj, r, o), routhPlots(r.routh)?.svg ?? null];
  } else {
    const r = need(solveString(pr.jacobi.str)) as StringSolution;
    [doc, svg] = [stringDoc(pr.jacobi.str, r, o), stringPlots(r).svg];
  }
  if (svg) expect(svg, key).not.toContain('NaN');
  return docHTML(doc);
}

const routh = (k: keyof typeof HAM_PRESETS) => {
  const r = solveRouth(HAM_PRESETS[k].problem.routh);
  if (!r.ok) throw new Error(r.error);
  setCoordNames(r.ctx.coords);
  return r;
};

describe('§49: интегралы, функция Рауса, функция Гамильтона', () => {
  it('49.2, 49.6: сферический маятник — циклический интеграл, R и уравнение по θ', () => {
    const r = routh('m492');
    expect(r.cyclic).toEqual([1]);
    expect(symText(r.p[1])).toBe('l²·m·sin² θ·ψ̇');
    expect(symText(r.routh!.R)).toBe('l²·m·θ̇²/2 + g·l·m·cos θ − n²/(2·l²·m·sin² θ)');
    expect(symText(r.routh!.eqs[0].Ered)).toBe('l²·m·θ̈ − n²·cos θ/(l²·m·sin³ θ) + g·l·m·sin θ');
    expect(symText(r.energy!)).toBe('l²·m·sin² θ·ψ̇²/2 + l²·m·θ̇²/2 − g·l·m·cos θ');
  });
  it('49.9: H = p²/(2ml²) − mgl cos φ, канонические уравнения', () => {
    const r = routh('m499');
    expect(symText(r.ham!.H)).toBe('−g·l·m·cos φ + p_φ²/(2·l²·m)');
    expect(symText(r.ham!.dq[0])).toBe('p_φ/(l²·m)');
    expect(symText(r.ham!.dp[0])).toBe('−g·l·m·sin φ');
    expect(r.lagDiff!).toBeLessThan(1e-9);
  });
  it('49.10: H маятника на вращающемся шарнире', () => {
    const r = routh('m494');
    expect(symText(r.ham!.H)).toBe('−g·l·m·cos φ + p_φ²/(2·l²·m) − l²·m·ω²·sin² φ/2');
  });
  it('49.13: H волчка совпадает с ответом книги в любой точке', () => {
    const r = routh('m4913');
    const book = (v: Record<string, number>) =>
      v.p_θ ** 2 / (2 * v.A) + (v.p_ψ - v.p_φ * Math.cos(v.θ)) ** 2 / (2 * v.A * Math.sin(v.θ) ** 2) + v.p_φ ** 2 / (2 * v.C) + v.m * v.g * v.l * Math.cos(v.θ);
    for (const θ of [0.3, 1.1, 2.4]) {
      const v: Record<string, number> = { A: 1.3, C: 0.7, m: 2, g: 9.81, l: 0.4, θ, p_θ: 0.5, p_ψ: -1.2, p_φ: 2.1 };
      expect(evalSym(r.ham!.H, (n) => v[n])).toBeCloseTo(book(v), 10);
    }
    expect(r.cyclic).toEqual([1, 2]);
    expect(r.lagDiff!).toBeLessThan(1e-8);
    expect(r.hamDrift!).toBeLessThan(1e-8);
  });
  it('49.7: центральное поле — R = m/2(ṙ² − c²/r²) − Π при n = mc', () => {
    const r = routh('m497');
    expect(symText(r.routh!.R)).toBe('m·ṙ²/2 + k·m/r − n²/(2·m·r²)');
  });
  it('49.1: обобщённый интеграл энергии не равен T + Π', () => {
    const r = routh('m491');
    expect(symText(r.energy!)).toBe('m·ẋ²/2 − m·ω²·(l + x)²·sin² α/2 + c·x²/2 + g·m·x·cos α');
  });
});

describe('§55: устойчивость по первому приближению', () => {
  const stab = (k: keyof typeof HAM_PRESETS) => {
    const r = solveStability(HAM_PRESETS[k].problem.stab);
    if (!r.ok) throw new Error(r.error);
    setCoordNames([]);
    return r;
  };
  it('55.18: условие Гурвица β·c·J − A·B·m > 0 (AB < Jcβ/m)', () => {
    const r = stab('m5518');
    expect(
      r.conds
        .find((c) => c.k === 2)!
        .rest.map((t) => t.c)
        .sort(),
    ).toEqual([-1, 1]);
    expect(symText(r.conds.find((c) => c.k === 2)!.rest)).toBe('−A·B·m + J·c·β');
  });
  it('55.16: β²c₁₁ − mc₁₂² > 0', () => {
    const r = stab('m5516');
    expect(symText(r.conds.find((c) => c.k === 3)!.rest)).toBe('c₁₁·β² − c₁₂²·m');
  });
  it('55.15: без сопротивления — неустойчиво', () => {
    const pr = {
      ...HAM_PRESETS.m5516.problem.stab,
      params: HAM_PRESETS.m5516.problem.stab.params.map((p) => (p.name === 'β' ? { ...p, value: 0 } : p)),
      scan: null,
    };
    const r = solveStability(pr);
    expect(r.ok && r.verdict).toBe('unstable');
  });
  it('55.21: пропущенное в ответе условие — при c < 6/7 неустойчиво', () => {
    const r = stab('m5521');
    expect(r.zeroRoots).toBe(1);
    expect(r.scan!.bounds[0]).toBeCloseTo(6 / 7, 5);
  });
  it('55.22 как напечатано: корни 0, −1, ±i; 55.23: двукратный нуль с одним вектором', () => {
    const a = stab('m5522');
    expect(a.coef.map((c) => Math.round(c))).toEqual([1, 1, 1, 1]);
    expect(a.verdict).toBe('linear');
    const b = stab('m5523');
    expect(b.imag[0].mult).toBe(2);
    expect(b.imag[0].geo).toBe(1);
    expect(b.verdict).toBe('unstable');
  });
  it('корни многочлена и характеристический многочлен', () => {
    const roots = polyRoots([1, -6, 11, -6]).map((z) => z[0]);
    expect(roots[0]).toBeCloseTo(3, 10);
    expect(roots[2]).toBeCloseTo(1, 10);
    expect(
      charPoly([
        [0, 1],
        [-4, -1],
      ]),
    ).toEqual([1, 1, 4]);
  });
});

describe('§56: нелинейные колебания', () => {
  it('56.6: предельный цикл a = α/k устойчив, траектории наматываются на него', () => {
    const r = solveNonlin(HAM_PRESETS.m566.problem.nonlin);
    if (!r.ok) throw new Error(r.error);
    expect(r.cycles).toHaveLength(1);
    expect(r.cycles[0].stable).toBe(true);
    expect(r.measured!.amp).toBeCloseTo(0.5, 3);
    expect(r.singular[0].kind).toBe('focus-u');
  });
  it('56.10: T·a не зависит от амплитуды', () => {
    const r = solveNonlin(HAM_PRESETS.m5610.problem.nonlin);
    if (!r.ok) throw new Error(r.error);
    const ta = r.periods.map((p) => p.T * p.a);
    for (const x of ta) expect(x / ta[0]).toBeCloseTo(1, 5);
  });
});

const letters = (k: keyof typeof HAM_PRESETS) => {
  const r = solveLetters(HAM_PRESETS[k].problem.letters);
  if (!r.ok) throw new Error(r.error);
  setCoordNames(r.ctx.coords);
  return r;
};
const solvedText = (c: { solved: { p: string; pow: number; rel: string; rhs: Parameters<typeof symText>[0] } | null }) =>
  c.solved ? `${c.solved.p}^${c.solved.pow} ${c.solved.rel} ${symText(c.solved.rhs)}` : '';

describe('§52, 55, 49.12: равновесие и устойчивость в общем виде', () => {
  it('52.1: момент M = Pa sin α sin θ в буквах; 52.2: Q = 3p — безразличное равновесие', () => {
    expect(symText(letters('m521').unknown!.expr)).toBe('P·a·sin α·sin θ');
    const r = letters('m522');
    expect(symText(r.unknown!.expr)).toBe('3·p');
    expect(r.neutralAll).toBe(true);
  });
  it('52.15: условия Сильвестра совпадают с ответом книги (сокращены на h, h², h³)', () => {
    const r = letters('m5215');
    const v = r.values;
    const ev = (s: Parameters<typeof symText>[0]) => evalSym(s, (n) => v.get(n) ?? NaN);
    const [c, h, m, g] = ['c', 'h', 'm', 'g'].map((n) => v.get(n)!);
    const book = [
      (13 * c * h * h - 4 * m * g * h) / h,
      (49 * c * c * h ** 4 - 59 * m * g * c * h ** 3 + 12 * m * m * g * g * h * h) / h ** 2,
      (36 * c ** 3 * h ** 6 - 153 * m * g * c * c * h ** 5 + 130 * m * m * g * g * c * h ** 4 - 24 * m ** 3 * g ** 3 * h ** 3) / h ** 3,
    ];
    r.conds.forEach((x, i) => expect(ev(x.rest)).toBeCloseTo(book[i], 6));
  });
  it('55.2, 55.3, 55.6: условия, решённые относительно ω', () => {
    expect(solvedText(letters('m552').conds[0])).toBe('ω^2 < c·g/a²');
    expect(solvedText(letters('m553').conds[0])).toBe('ω^2 < g/p');
    expect(solvedText(letters('m556').conds[0])).toBe('ω^2 < M·g·h/(B − C)');
  });
  it('52.3: q* — не равновесие: уравнение в буквах и корень Ньютоном', () => {
    const r = letters('m523');
    expect(r.equil).toBe('no');
    expect(r.residual).toBeLessThan(1e-10);
  });
  it('49.12: канонические уравнения и условие C²n² > 4Amgl', () => {
    const r = letters('m4912');
    expect(r.kind).toBe('gyro');
    const C = r.canon!;
    expect(symText(C.dq[0][1])).toBe('C·n/A');
    expect(symText(C.dq[0][2])).toBe('1/A');
    expect(symText(C.dp[0][0])).toBe('g·l·m');
    expect(symText(C.dp[1][1])).toBe('−C²·n²/A + g·l·m');
    expect(symText(C.dp[1][2])).toBe('−C·n/A');
    expect(symText(r.conds[2].rest)).toBe('−4·A·g·l·m + C²·n²');
  });
  it('Д.23: закон y = 0,357 sin(27,09t + 0,595) см', () => {
    const r = letters('yd23');
    expect(r.law!.k).toBeCloseTo(27.086, 2);
    expect(r.law!.amp * 100).toBeCloseTo(0.357, 3);
    expect(r.law!.phase).toBeCloseTo(0.595, 3);
  });
});

describe('55.12–55.14: катящийся диск', () => {
  const roll = (k: keyof typeof HAM_PRESETS) => {
    const r = solveRoll(HAM_PRESETS[k].problem.roll);
    if (!r.ok) throw new Error(r.error);
    setCoordNames([]);
    return r;
  };
  it('условия в буквах совпадают с ответами книги', () => {
    expect(solvedText(roll('m5512').cond)).toBe('ω^2 > g/(4·a)');
    expect(solvedText(roll('m5514').cond)).toBe('ω^2 > 2·g/(3·a)');
  });
  it('медленный обруч падает, быстрый — нет', () => {
    const p = structuredClone(HAM_PRESETS.m5512.problem.roll);
    p.params = p.params.map((x) => (x.name === 'ω' ? { ...x, value: 1 } : x));
    const r = solveRoll(p);
    if (!r.ok) throw new Error(r.error);
    expect(r.verdict).toBe('unstable');
    expect(Math.max(...r.sim!.th.map(Math.abs))).toBeGreaterThan(1);
    expect(Math.max(...roll('m5512').sim!.th.map(Math.abs))).toBeLessThan(0.3);
  });
});

describe('49.15–49.22: Якоби — Гамильтон, струна и нить', () => {
  it('полный интеграл согласуется с численным решением', () => {
    for (const k of ['m4915', 'm4917', 'm4918'] as const) {
      const r = solveHJ(HAM_PRESETS[k].problem.jacobi.hj);
      if (!r.ok) throw new Error(r.error);
      expect(r.separable, k).toBe(true);
      expect(r.check!.pDev, k).toBeLessThan(1e-6);
      for (const d of r.check!.firstDev) expect(d, k).toBeLessThan(1e-8);
    }
  });
  it('49.16: V = −ht + α_x·x − (2h − α_x² − 2gy)^(3/2)/(3g)', () => {
    const r = solveHJ(HAM_PRESETS.m4915.problem.jacobi.hj);
    if (!r.ok) throw new Error(r.error);
    const [h, a, g, x, y, t] = [5, 0.7, 9.81, 0.3, 0.1, 0.4];
    const vals = new Map([
      ['h', h],
      ['α_x', a],
      ['g', g],
      ['x', x],
      ['y', y],
    ]);
    const V = evalSym(r.V!, (n) => vals.get(n) ?? NaN, t);
    expect(V).toBeCloseTo(-h * t + a * x - (2 * h - a * a - 2 * g * y) ** 1.5 / (3 * g), 10);
  });
  it('струна: ωₖ = kπ√(T/ρ)/l; свободный конец — (2k − 1)π√(T/ρ)/(2l)', () => {
    const r = solveString({
      params: [
        { name: 'ρ', value: 2 },
        { name: 'T', value: 8 },
        { name: 'l', value: 1.5 },
      ],
      rho: 'ρ',
      T: 'T',
      l: 'l',
      bc: 'free',
      modes: 3,
    });
    if (!r.ok) throw new Error(r.error);
    r.omega.forEach((w, k) => expect(w).toBeCloseTo(((2 * k + 1) * Math.PI * 2) / 3, 3));
    expect(r.shapes.y[0][0]).toBe(0);
  });
});

describe('файл проекта', () => {
  it('сохраняется и открывается во всех режимах', () => {
    for (const k of ['m5524', 'm5521', 'm566', 'm5214', 'm559', 'm5512', 'm4918', 'm4921'] as const) {
      const a = new HamStore({ preset: k });
      const f = a.exportProject(new Date(2026, 9, 19));
      const b = new HamStore({ preset: 'm499' });
      expect(b.importProject(f.text, f.name)).toBe(true);
      expect(b.get().problem).toEqual(a.get().problem);
    }
  });
  it('файл без новых режимов (до пункта 25) открывается', () => {
    const a = new HamStore({ preset: 'm5524' });
    const f = JSON.parse(a.exportProject(new Date(2026, 9, 19)).text);
    for (const k of ['letters', 'roll', 'jacobi']) delete f.problem[k];
    const b = new HamStore({ preset: 'm499' });
    expect(b.importProject(JSON.stringify(f))).toBe(true);
    expect(b.get().problem.routh).toEqual(a.get().problem.routh);
  });
  it('чужой раздел не открывается', () => {
    const b = new HamStore();
    expect(b.importProject('{"format":"statika-project","version":2,"module":"lagrange","problem":{}}')).toBe(false);
  });
});
