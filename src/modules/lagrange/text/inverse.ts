/** Текст: обратная задача относительного равновесия — параметр по заданному положению q* (пункт 29). */
import { b, type AnswerRow, type Block, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { prettyName, setCoordNames, symText, varName } from '../../../shared/sym';
import type { EquilResult } from '../model/equil';
import type { InverseOut } from '../model/inverse';

const f4 = (x: number) => fmt(x, 4);
const isAngle = (n: string) => /^[α-ωΑ-Ω]/u.test(n);
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '.': '·' };
const sup = (k: number) => (k === 1 ? '' : String(k).replace(/./g, (c) => SUP[c] ?? c));

export function inverseSteps(er: EquilResult, iv: InverseOut, opts: { explain?: boolean }): { steps: Step[]; rows: AnswerRow[] } {
  if (!iv.ok)
    return {
      steps: [
        {
          title: 'Параметр по положению равновесия',
          blocks: [
            { k: 'badge', tone: 'bad', text: 'проверьте данные' },
            { k: 'p', c: [iv.error] },
          ],
        },
      ],
      rows: [],
    };
  setCoordNames(er.ctx.coords);
  const names = er.ctx.coords;
  const qn = (n: string) => varName(prettyName(n), 0);
  const P = prettyName(iv.param);
  const at = names.map((n, i) => `${qn(n)}* = ${f4(iv.q[i])}${isAngle(n) ? ` (${fmt((iv.q[i] * 180) / Math.PI, 2)}°)` : ''}`).join(', ');
  const Fj: Inline[] = ['F', { t: 'sub', text: prettyName(names[iv.j]) }];
  const lines: { c: Inline[] }[] = [];
  if (iv.split) {
    lines.push({ c: [...Fj, ' = A + B·', P, sup(iv.split.k), ',   A = ', symText(iv.split.A), ',   B = ', symText(iv.split.B)] });
    lines.push({ c: [b(`${P}${sup(iv.split.k)} = −A/B = `), symText(iv.split.rhs)] });
  }
  lines.push({ c: [...Fj, `(${at}) = `, symText(iv.Fq), ' = 0'] });
  const bl: Block[] = [
    {
      k: 'p',
      c: [
        'Положение задано, ищем значение параметра ',
        b(P),
        ', при котором обобщённая сила покоя в этом положении равна нулю (условие равновесия из предыдущего шага):',
      ],
    },
    { k: 'eq', lines },
  ];
  if (opts.explain)
    bl.push({
      k: 'p',
      cls: 'explain',
      c: [
        iv.split
          ? `Параметр входит в условие равновесия только множителем ${P}${sup(iv.split.k)} (как квадрат угловой скорости в центробежном потенциале −T₀), поэтому выражается из него явно.`
          : `Параметр входит в условие сложнее, чем множителем; корни ищем на отрезке ${f4(iv.range[0])} ≤ ${P} ≤ ${f4(iv.range[1])}.`,
      ],
    });
  const rows: AnswerRow[] = [];
  if (!iv.roots.length)
    bl.push({
      k: 'p',
      c: [b('Подходящего значения параметра нет'), iv.split ? ` (${P}${sup(iv.split.k)} получается отрицательным или бесконечным).` : ' на заданном отрезке.'],
    });
  else {
    const items: Inline[][] = iv.roots.map((r) => {
      const verdict = r.anyQ
        ? `обобщённая сила при этом ${P} равна нулю при любом положении — равновесие безразличное, возможно только при этом значении и в любом положении`
        : r.stable === 'stable'
          ? `K = ${r.k.map(f4).join('; ')} > 0 — равновесие устойчиво`
          : r.stable === 'unstable'
            ? `K = ${r.k.map(f4).join('; ')} — равновесие неустойчиво`
            : `K = ${r.k.map(f4).join('; ')} — нужен анализ высших членов`;
      return [
        b(`${P} = ${f4(r.p)}`),
        `: ${verdict}${r.residual > 1e-6 ? `; невязка остальных уравнений ${fmt(r.residual, 2)} — положение q* не равновесно по всем координатам` : ''}.`,
      ];
    });
    bl.push({ k: 'ul', items });
    for (const r of iv.roots)
      rows.push({
        kind: 'main',
        val: [b(`${P} = ${f4(r.p)}`)],
        note: r.anyQ ? 'при этом значении равновесие безразличное' : `${at}: значение параметра для равновесия`,
      });
  }
  return { steps: [{ title: 'Параметр по положению равновесия', blocks: bl }], rows };
}
