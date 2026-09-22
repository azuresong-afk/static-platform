/** Точка входа ядра: конструкция → модель → решение → текст. Без зависимостей от DOM. */
import type { Structure } from './model/types';
import { buildModel, type Model } from './solver/model';
import { solve, type Solution } from './solver/solve';
import { docHTML, type Doc } from './text/doc';
import { solutionDoc, type SolutionOptions } from './text/solution';

export interface Analysis {
  model: Model;
  solution: Solution;
  doc: Doc;
  html: string;
}

export function analyze(s: Structure, opts: SolutionOptions = {}): Analysis {
  const model = buildModel(s);
  const solution = solve(model);
  const doc = solutionDoc(model, solution, opts);
  return { model, solution, doc, html: docHTML(doc) };
}
