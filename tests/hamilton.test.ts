/** Интегралы движения, функции Рауса и Гамильтона, устойчивость, нелинейные колебания (Мещерский §49, 55, 56). */
import { describe, expect, it } from 'vitest';
import { solveNonlin } from '../src/modules/hamilton/model/nonlin';
import { solveRouth, type RouthSolution } from '../src/modules/hamilton/model/routh';
import { charPoly, polyRoots, solveStability } from '../src/modules/hamilton/model/stability';
import { HAM_PRESETS, type HamPreset, type HamProblem } from '../src/modules/hamilton/presets';
import { nonlinDoc, routhDoc, stabDoc } from '../src/modules/hamilton/text/solution';
import { HamStore } from '../src/modules/hamilton/ui/store';
import { docHTML } from '../src/shared/doc';
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
      expect(taskInfo(p.title).book).toBe('mesh');
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
      const pr = (p as HamPreset).problem;
      const html =
        pr.mode === 'routh'
          ? docHTML(routhDoc(pr.routh, solveRouth(pr.routh) as RouthSolution, { explain: true }))
          : pr.mode === 'stab'
            ? (() => {
                const r = solveStability(pr.stab);
                if (!r.ok) throw new Error(key);
                return docHTML(stabDoc(pr.stab, r, { explain: true }));
              })()
            : (() => {
                const r = solveNonlin(pr.nonlin);
                if (!r.ok) throw new Error(key);
                return docHTML(nonlinDoc(pr.nonlin, r, { explain: true }));
              })();
      expect(html, key).toContain('Ответ');
      expect(html, key).not.toContain('NaN');
    }
  });
});

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

describe('файл проекта', () => {
  it('сохраняется и открывается во всех режимах', () => {
    for (const k of ['m5524', 'm5521', 'm566'] as const) {
      const a = new HamStore({ preset: k });
      const f = a.exportProject(new Date(2026, 9, 19));
      const b = new HamStore({ preset: 'm499' });
      expect(b.importProject(f.text, f.name)).toBe(true);
      expect(b.get().problem).toEqual(a.get().problem);
    }
  });
  it('чужой раздел не открывается', () => {
    const b = new HamStore();
    expect(b.importProject('{"format":"statika-project","version":2,"module":"lagrange","problem":{}}')).toBe(false);
  });
});
