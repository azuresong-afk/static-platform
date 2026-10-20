/** Точка входа ядра: конструкция → модель → решение → текст. Без зависимостей от DOM. */
import type { Structure } from './model/types';
import { buildModel, eqCount, oneSidedLinks, type Model } from './solver/model';
import { solve, type CaseTry, type Solution } from './solver/solve';
import { docHTML, type Block, type Doc } from '../../shared/doc';
import { eqSym, lhsNum, solutionDoc, type SolutionOptions } from './text/solution';
import { firstViolated } from './solver/check';
import { fmt } from '../../shared/format';
import { searchPositions, type SearchResult } from './solver/search';
import { instantiate } from './model/search';
import { pinFrictionStep, searchStep } from './text/search';

export interface Analysis {
  model: Model;
  solution: Solution;
  doc: Doc;
  html: string;
  /** Конструкция, для которой выполнен расчёт: при поиске положения — в найденном положении. */
  structure: Structure;
  /** Поиск положения равновесия и номер выбранного корня (границы). */
  search?: SearchResult;
  pick?: number | null;
}

export interface AnalyzeOptions extends SolutionOptions {
  /** Какой из найденных корней (границ) показать; по умолчанию — первый подходящий. */
  pick?: number;
}

/** Решение одной конструкции: модель, решение (с перебором случаев для односторонних связей). */
function solveStructure(s: Structure): { model: Model; solution: Solution } {
  const model = buildModel(s);
  // При поиске положения неизвестных реакций может не быть: тогда уравнения равновесия только проверяются.
  if (s.search && !model.unknowns.length) {
    const bad = firstViolated(model.cands, {});
    const solution: Solution = { status: bad ? 'noequilibrium' : 'ok', n: 0, steps: [], joint: null, vals: {}, check: null };
    if (bad) Object.assign(solution, { badEq: bad, badR: bad.cst });
    return { model, solution };
  }
  const solution = solve(model);
  return byCases(s, model, solution) ?? { model, solution };
}

/** Без неизвестных: уравнения равновесия — проверка, выполняются ли они. */
function checkOnlyDoc(model: Model): Doc {
  const eqs = model.cands.filter((e) => e.terms.length);
  const blocks: Block[] = [
    { k: 'p', c: ['Неизвестных реакций нет: уравнения равновесия должны выполняться сами собой.'] },
    { k: 'eq', lines: eqs.flatMap((e) => [{ c: eqSym(e) }, { num: true, c: [...lhsNum(e, {}, model), ` = ${fmt(e.cst, 4)}`] }]) },
  ];
  const ok = eqs.every((e) => Math.abs(e.cst) < 1e-6 * Math.max(1, ...e.terms.map((t) => Math.abs(t.c * (t.val ?? 0)))));
  blocks.push({ k: 'badge', tone: ok ? 'ok' : 'bad', text: ok ? 'Равновесие есть' : 'Равновесия нет' });
  return { steps: [{ title: 'Проверяем уравнения равновесия', blocks }] };
}

export function analyze(s: Structure, opts: AnalyzeOptions = {}): Analysis {
  if (s.search) return analyzeSearch(s, opts);
  const { model, solution } = solveStructure(s);
  const doc = solutionDoc(model, solution, opts);
  withPinFriction(doc, model, solution, !!opts.explain);
  return { model, solution, doc, html: docHTML(doc), structure: s };
}

/** Шаг о трении в шарнирах — сразу после проверки определимости. */
function withPinFriction(doc: Doc, model: Model, solution: Solution, ex: boolean) {
  if (!model.pinFr.length || solution.friction || solution.status === 'unsupported') return;
  const i = doc.steps.findIndex((st) => st.title.startsWith('Проверяем статическую'));
  doc.steps.splice(i < 0 ? doc.steps.length : i + 1, 0, pinFrictionStep(model, solution, ex));
}

/** Почему корень уравнения совместности не является положением равновесия. */
function whyNot(sol: Solution): string | undefined {
  if (sol.status === 'ok') return undefined;
  if (sol.slack?.length || (sol.cases && !sol.cases.some((c) => c.ok))) return 'давление касания или натяжение нити получается отрицательным';
  if (sol.status === 'mechanism') return 'в этом положении система изменяема';
  if (sol.status === 'indeterminate') return 'в этом положении система статически неопределима';
  return 'уравнения равновесия не выполняются';
}

function analyzeSearch(s: Structure, opts: AnalyzeOptions): Analysis {
  const res = searchPositions(s);
  const sr = s.search!;
  const solved = res.points.map((pt) => {
    const s2 = instantiate(s, res.fns, pt.p);
    return s2 ? { s2, ...solveStructure(s2) } : null;
  });
  res.points.forEach((pt, i) => {
    if (pt.kind !== 'root') return;
    const r = solved[i];
    pt.why = r ? whyNot(r.solution) : 'схема не строится';
    pt.ok = !pt.why;
  });
  let pick: number | null = null;
  if (res.points.length) {
    const want = opts.pick ?? -1;
    pick =
      want >= 0 && want < res.points.length
        ? want
        : Math.max(
            0,
            res.points.findIndex((pt) => pt.ok),
          );
  }
  let base: { s2: Structure; model: Model; solution: Solution } | null = pick != null ? solved[pick] : null;
  if (!base) {
    const mid = (sr.min + sr.max) / 2;
    const s2 = (res.fns.length && instantiate(s, res.fns, mid)) || s;
    base = { s2, ...solveStructure(s2) };
  }
  const { model, solution } = base;
  const doc = model.unknowns.length ? solutionDoc(model, solution, opts) : checkOnlyDoc(model);
  withPinFriction(doc, model, solution, !!opts.explain);
  doc.steps.unshift(searchStep(s, res, pick, !!opts.explain));
  return { model, solution, doc, html: docHTML(doc), structure: { ...base.s2, search: sr }, search: res, pick };
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
