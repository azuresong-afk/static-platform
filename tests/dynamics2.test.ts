/** Пункт 28: доработки динамики — вторые экраны разделов (Мещерский §26–45, 50; Яблонский Д.1, Д.5–Д.13). */
import { describe, expect, it } from 'vitest';
import { docHTML } from '../src/shared/doc';
import { plotSvg, solveExtra, type AskDef, type ExtraProblem } from '../src/shared/extra';
import { POINT_EXTRA_ASKS } from '../src/modules/pointdyn/model/extra';
import { POINT_EXTRA_PRESETS } from '../src/modules/pointdyn/extraPresets';
import { OSC_ASKS } from '../src/modules/oscillation/model/extra';
import { OSC_EXTRA_PRESETS } from '../src/modules/oscillation/extraPresets';

const near = (got: number, book: number, rel: number) => Math.abs(got - book) <= rel * Math.abs(book) + 1e-12;
type P = Record<string, { title: string; problem: ExtraProblem; book: Record<string, number>; relTol: number }>;
const SETS: [string, AskDef[], P][] = [
  ['Динамика точки', POINT_EXTRA_ASKS, POINT_EXTRA_PRESETS],
  ['Удар и колебания', OSC_ASKS, OSC_EXTRA_PRESETS],
];

for (const [name, asks, presets] of SETS)
  describe(`${name}: готовые задачи`, () => {
    for (const [key, ps] of Object.entries(presets))
      it(ps.title, () => {
        const out = solveExtra(asks, ps.problem, true);
        expect(out.ok, key + out.errors.join()).toBe(true);
        for (const [k, book] of Object.entries(ps.book)) expect(near(out.vals[k], book, ps.relTol), `${key} ${k}: ${out.vals[k]} против ${book}`).toBe(true);
        expect(docHTML({ steps: out.steps })).not.toContain('NaN');
        expect(plotSvg(out.plot, out.ok).svg).not.toContain('NaN');
      });
  });
