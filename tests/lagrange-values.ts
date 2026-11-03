/** Величины готовой задачи «Уравнений Лагранжа» по ключам ответа (см. src/modules/lagrange/presets34.ts). */
import { findEquilibria } from '../src/modules/lagrange/model/equil';
import { solveLagrange, type LagProblem } from '../src/modules/lagrange/model/lagrange';
import { solveReact } from '../src/modules/lagrange/model/react';
import { evalSym } from '../src/shared/sym';
import { gauss } from '../src/shared/gauss';

export function lagValues(pr: LagProblem): Record<string, number> {
  const out: Record<string, number> = {};
  const eq = findEquilibria(pr);
  if (eq && eq.ok)
    eq.points.forEach((pt, i) => {
      out[`eq${i + 1}`] = pt.q[0];
      out[`eqStable${i + 1}`] = pt.stable === 'stable' ? 1 : 0;
    });
  // Только положения равновесия (T не задана).
  if (!pr.T.trim()) return out;
  const r = solveLagrange(pr);
  if (!r.ok) throw new Error(r.field + ': ' + r.error);
  const q0 = pr.coords.map((c) => c.q0),
    v0 = pr.coords.map((c) => c.v0);
  r.acc0.forEach((a, i) => (out[`a${i + 1}`] = a));
  const val = () => (name: string, ord: number) => {
    const i = r.ctx.coords.indexOf(name);
    if (i >= 0) return ord === 0 ? q0[i] : v0[i];
    return pr.params.find((p) => p.name === name)?.value ?? NaN;
  };
  for (const t of [0.07, 0.1, 0.4]) {
    const M = r.A.map((row) => row.map((x) => evalSym(x, val(), t)));
    const f = r.b.map((x) => -evalSym(x, val(), t));
    gauss(M, f).forEach((a, i) => (out[`a${i + 1}@${t}`] = a));
  }
  out.T0 = evalSym(r.T, val());
  out.P0 = evalSym(r.P, val());
  if (r.small && r.small.residual < 1e-8)
    r.small.w2
      .filter((w) => w > 1e-9)
      .sort((a, b) => a - b)
      .forEach((w, i) => (out[`w${i + 1}`] = Math.sqrt(w)));
  if (r.sim) {
    const n = r.sim.t.length - 1;
    r.sim.q.forEach((q, i) => {
      out[`qEnd${i + 1}`] = q[n];
      out[`qMax${i + 1}`] = Math.max(...q);
    });
    r.sim.v.forEach((v, i) => {
      out[`vEnd${i + 1}`] = v[n];
      // Период: моменты, когда q̇ меняет знак с + на − (максимумы q), линейная интерполяция.
      const ts: number[] = [];
      for (let k = 1; k <= n; k++) if (v[k - 1] > 0 && v[k] <= 0) ts.push(r.sim!.t[k - 1] + ((r.sim!.t[k] - r.sim!.t[k - 1]) * v[k - 1]) / (v[k - 1] - v[k]));
      if (ts.length >= 2) out[`period${i + 1}`] = (ts[ts.length - 1] - ts[0]) / (ts.length - 1);
    });
  }
  const re = solveReact(pr, r);
  if (re.ok) {
    if (re.body) [out.Re0, out.Rn0] = re.body.R0;
    if (re.event) out.evV1 = re.event.v[0];
  }
  return out;
}
