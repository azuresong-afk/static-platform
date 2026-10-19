/** Точка входа ядра: конструкция → модель → решение → текст. Без зависимостей от DOM. */
import type { Structure } from './model/types';
import { buildModel, eqCount, oneSidedLinks, type Model } from './solver/model';
import { solve, type CaseTry, type Solution } from './solver/solve';
import { docHTML, type Doc } from '../../shared/doc';
import { solutionDoc, type SolutionOptions } from './text/solution';

export interface Analysis {
  model: Model;
  solution: Solution;
  doc: Doc;
  html: string;
}

export function analyze(s: Structure, opts: SolutionOptions = {}): Analysis {
  let model = buildModel(s);
  let solution = solve(model);
  const cased = byCases(s, model, solution);
  if (cased) ({ model, solution } = cased);
  const doc = solutionDoc(model, solution, opts);
  return { model, solution, doc, html: docHTML(doc) };
}

/**
 * Односторонние связи между телами (гладкие касания, нити) и неизвестных больше, чем уравнений: работают не все связи.
 * Как в задачниках (Яблонский, С.9), перебираем предположения: какие связи работают, а какие нет (их силы равны нулю),
 * так чтобы неизвестных стало столько же, сколько уравнений. Подходит предположение, при котором все давления
 * и натяжения работающих связей не отрицательны.
 */
function byCases(s: Structure, m: Model, sol: Solution): { model: Model; solution: Solution } | null {
  const ids = oneSidedLinks(m).map((l) => l.link.id);
  if (m.unkLoads.length || !ids.length) return null;
  // Лишние неизвестные: неопределимость или связи, дублирующие друг друга (давление и натяжение на одной прямой).
  if (sol.status !== 'indeterminate' && !(sol.status === 'mechanism' && sol.rank != null && sol.n > sol.rank)) return null;
  const k = sol.status === 'indeterminate' ? m.unknowns.length - eqCount(m) : sol.n - sol.rank!;
  if (k <= 0 || k > ids.length || ids.length > 12) return null;
  const tries: CaseTry[] = [];
  let found: { model: Model; solution: Solution } | null = null;
  // Работающие связи — сочетания по ids.length − k в порядке связей (сначала работают первые).
  const combos = (n: number, r: number): number[][] => {
    const out: number[][] = [];
    const rec = (start: number, acc: number[]) => {
      if (acc.length === r) return void out.push(acc);
      for (let i = start; i < n; i++) rec(i + 1, [...acc, i]);
    };
    rec(0, []);
    return out;
  };
  for (const w of combos(ids.length, ids.length - k)) {
    const work = w.map((i) => ids[i]),
      off = ids.filter((id) => !work.includes(id));
    const m2 = buildModel(s, { off: new Set(off) });
    const s2 = solve(m2);
    let neg: CaseTry['neg'] = null;
    if (s2.status === 'noequilibrium' && s2.slack?.length) {
      const key = s2.slack[0];
      neg = { key, val: s2.vals[key] };
    }
    const ok = s2.status === 'ok';
    tries.push({ work, off, status: s2.status, neg, ok });
    if (ok) {
      found = { model: m2, solution: s2 };
      break;
    }
  }
  if (found) {
    found.solution.cases = tries;
    return found;
  }
  // Ни одно предположение не подходит: изменяемая система так и остаётся изменяемой, иначе равновесие невозможно.
  if (sol.status === 'mechanism') return null;
  return { model: m, solution: { ...sol, status: 'noequilibrium', cases: tries } };
}
