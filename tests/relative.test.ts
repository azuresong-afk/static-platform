/** Сложное движение точки: ответы Мещерского §23 и независимые проверки. */
import { describe, expect, it } from 'vitest';
import { norm, solveRel, type RelProblem, type RelResult } from '../src/modules/relative/model/rel';
import { REL_PRESETS } from '../src/modules/relative/presets';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};
function pick(r: RelResult, k: string): number {
  const m: Record<string, number> = { v: norm(r.v), a: norm(r.a), vx: r.v[0], vy: r.v[1], ax: r.a[0], ay: r.a[1], az: r.a[2], ac: norm(r.ac), aT: r.aT ?? NaN, aN: r.aN ?? NaN };
  if (k === 'angMO') {
    const mo = r.pos.map((q) => -q);
    return (Math.acos((r.a[0] * mo[0] + r.a[1] * mo[1] + r.a[2] * mo[2]) / (norm(r.a) * Math.hypot(...mo))) * 180) / Math.PI;
  }
  return m[k];
}

describe('Мещерский §23', () => {
  for (const [key, p] of Object.entries(REL_PRESETS))
    it(p.title, () => {
      const r = solveRel(p.problem as RelProblem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) {
        const got = pick(r, k);
        expect(Math.abs(got - book), `${k}: ${got} против ${book}`).toBeLessThanOrEqual(k === 'angMO' ? 0.5 : tol(book));
      }
    });
  it('23.29 при t = 2: 0,4456aπ² (в книге 0,44 — третий знак отброшен); 23.11 в крайнем положении w_c = 0', () => {
    expect(norm(solveRel({ ...(REL_PRESETS.r2329.problem as RelProblem), t: 2 }).a) / Math.PI ** 2).toBeCloseTo(0.4456, 4);
    expect(norm(solveRel({ ...(REL_PRESETS.r2311.problem as RelProblem), t: 1 / 16 }).ac)).toBeCloseTo(0, 9);
  });
});

describe('сложное движение: независимая проверка', () => {
  // Абсолютное движение в неподвижных осях: r(t) = Rot_z(φ(t))·ρ(t); численно дифференцируем и поворачиваем обратно.
  it('v и a равны численным производным абсолютного движения (вращение и поступательное)', () => {
    for (const key of ['r2327', 'r2329', 'r2313', 'r2314', 'r231'] as const) {
      const pr = REL_PRESETS[key].problem as RelProblem;
      const at = (t: number) => solveRel({ ...pr, t });
      const abs = (t: number) => {
        const r = at(t);
        const phi = pr.carrier === 'rot' ? (r.carrier.e[0] ? evalPhi(pr, t) : 0) : 0;
        const c = Math.cos(phi),
          s = Math.sin(phi);
        const p = [r.pos[0] * c - r.pos[1] * s, r.pos[0] * s + r.pos[1] * c, r.pos[2]];
        if (pr.carrier === 'trans') {
          const e = transPos(pr, t);
          return [p[0] + e[0], p[1] + e[1], p[2] + e[2]];
        }
        return p;
      };
      const t = pr.t,
        h = 1e-4;
      const rp = abs(t + h),
        rm = abs(t - h),
        r0 = abs(t);
      const vAbs = rp.map((q, i) => (q - rm[i]) / (2 * h));
      const aAbs = rp.map((q, i) => (q - 2 * r0[i] + rm[i]) / (h * h));
      const r = at(t);
      const phi = pr.carrier === 'rot' ? evalPhi(pr, t) : 0;
      const back = (w: number[]) => [w[0] * Math.cos(phi) + w[1] * Math.sin(phi), -w[0] * Math.sin(phi) + w[1] * Math.cos(phi), w[2]];
      const vb = back(vAbs),
        ab = back(aAbs);
      for (let i = 0; i < 3; i++) {
        expect(r.v[i], `${key} v${i}`).toBeCloseTo(vb[i], 4);
        expect(r.a[i], `${key} a${i}`).toBeCloseTo(ab[i], 1);
      }
    }
  });
  it('ошибки формул', () => {
    expect(solveRel({ ...(REL_PRESETS.r2331.problem as RelProblem), phi: 'sin(' }).ok).toBe(false);
    expect(solveRel({ ...(REL_PRESETS.r2313.problem as RelProblem), R: '0' }).ok).toBe(false);
  });
});

import { evalExpr, parseExpr } from '../src/shared/expr';
function evalPhi(pr: RelProblem, t: number) {
  const p = parseExpr(pr.phi);
  return p.ok ? evalExpr(p.e, t) : 0;
}
function transPos(pr: RelProblem, t: number) {
  return [pr.xe, pr.ye, pr.ze].map((s) => {
    const p = parseExpr(s || '0');
    return p.ok ? evalExpr(p.e, t) : 0;
  });
}

import { RelStore, parseRel } from '../src/modules/relative/ui/store';
import { renderRel } from '../src/modules/relative/draw/rel';
import { relDoc } from '../src/modules/relative/text/solution';
import type { RelPresetKey } from '../src/modules/relative/presets';

describe('сложное движение: файл, чертёж, текст', () => {
  for (const key of Object.keys(REL_PRESETS) as RelPresetKey[])
    it(`${key}: файл туда-обратно, чертёж и решение без NaN`, () => {
      const s = new RelStore({ preset: key });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const s2 = new RelStore();
      expect(s2.importProject(text)).toBe(true);
      expect(s2.get().problem).toEqual(s.get().problem);
      const p = s.get().problem,
        r = solveRel(p);
      for (const x of [renderRel(p, r, 'v').svg, renderRel(p, r, 'a').svg, JSON.stringify(relDoc(p, r, { explain: true }))]) expect(x).not.toMatch(/NaN|undefined|Infinity/);
    });
  it('правка и отмена; чужой файл', () => {
    const s = new RelStore({ preset: 'r2331' });
    s.setPath('circle');
    s.typeStr('R', '2');
    s.undo();
    s.undo();
    expect(s.get().preset).toBe('r2331');
    expect(new RelStore().importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'gears', problem: {} }))).toBe(false);
    expect(parseRel({ carrier: 'x' }).ok).toBe(false);
  });
});
