/** Текст: положения равновесия и их устойчивость (условие равновесия, корни, жёсткость, вывод, частоты). */
import { b, type AnswerRow, type Block, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { prettyName, setCoordNames, symText, varName } from '../../../shared/sym';
import type { EqPoint, EquilResult } from '../model/equil';

const f4 = (x: number) => fmt(x, 4);
/** Угол (имя координаты — греческая буква) — значение и в градусах. */
const isAngle = (n: string) => /^[α-ωΑ-Ω]/u.test(n);
const SUPN: Record<number, string> = { 3: '‴', 4: '⁽⁴⁾', 5: '⁽⁵⁾', 6: '⁽⁶⁾', 7: '⁽⁷⁾', 8: '⁽⁸⁾' };

export function equilSteps(er: EquilResult, opts: { explain?: boolean; hasT: boolean }): { steps: Step[]; rows: AnswerRow[] } {
  setCoordNames(er.ctx.coords);
  const names = er.ctx.coords;
  const q = (n: string, ord = 0) => varName(prettyName(n), ord);
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const at = (p: EqPoint) => names.map((n, i) => `${q(n)}* = ${f4(p.q[i])}${isAngle(n) ? ` (${fmt((p.q[i] * 180) / Math.PI, 2)}°)` : ''}`).join(', ');
  const steps: Step[] = [];
  const rows: AnswerRow[] = [];
  {
    const lines: { c: Inline[] }[] = [];
    if (er.T0.length) lines.push({ c: ['T₀ = ', symText(er.T0), ' (часть T без скоростей)'] }, { c: ['W = Π − T₀ = ', symText(er.W)] });
    names.forEach((n, j) =>
      lines.push({ c: [`F`, { t: 'sub', text: prettyName(n) }, ` = −∂W/∂${q(n)}${er.nonPot ? ' + Q^н(q, 0)' : ''} = `, symText(er.F[j]), ' = 0'] }),
    );
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          'В равновесии (покое) скорости и ускорения равны нулю, и уравнения Лагранжа дают ',
          b('∂W/∂qⱼ = Qⱼ^н'),
          er.T0.length ? ', где W = Π − T₀ — приведённая потенциальная энергия:' : ' (W = Π — потенциальная энергия):',
        ],
      },
      { k: 'eq', lines },
    ];
    if (er.indifferent)
      bl.push({ k: 'p', c: ['Обобщённая сила покоя тождественно равна нулю: ', b('любое положение — положение безразличного равновесия'), '.'] });
    else if (er.mode === 'scan') {
      const [a, c] = er.range!;
      const n = names[0];
      bl.push({
        k: 'p',
        c: [
          `Корни ищем на отрезке ${f4(a)} ≤ ${q(n)} ≤ ${f4(c)}${isAngle(n) ? ` (${fmt((a * 180) / Math.PI, 1)}° … ${fmt((c * 180) / Math.PI, 1)}°)` : ''}: `,
          er.points.length
            ? b(`${er.points.length} ${er.points.length === 1 ? 'положение' : er.points.length < 5 ? 'положения' : 'положений'} равновесия`)
            : 'положений равновесия нет',
          '.',
        ],
      });
    } else
      bl.push({
        k: 'p',
        c: [
          er.failed
            ? 'Метод Ньютона от приближения q* (таблица координат) не сошёлся — задайте приближение ближе к положению равновесия.'
            : `Уточняем методом Ньютона от приближения q* (таблица координат): ${at(er.points[0])}, невязка ${fmt(er.points[0].residual, 2)}.`,
        ],
      });
    ex(
      bl,
      er.T0.length
        ? 'Часть кинетической энергии без скоростей T₀ появляется, когда система задана во вращающихся осях: −T₀ — потенциал центробежных сил инерции, и положения равновесия — это положения относительного равновесия.'
        : 'Положения равновесия консервативной системы — точки, где потенциальная энергия стационарна: обобщённые силы ∂Π/∂qⱼ обращаются в нуль.',
    );
    steps.push({ title: 'Положения равновесия', blocks: bl });
  }
  if (er.indifferent) rows.push({ kind: 'aux', val: ['любое положение'], note: 'безразличное равновесие' });
  if (er.points.length) {
    const n0 = names[0];
    const items: Inline[][] = er.points.map((p) => {
      const verdict =
        p.stable === 'stable' ? 'минимум W — равновесие устойчиво' : p.stable === 'unstable' ? 'равновесие неустойчиво' : 'безразличное равновесие';
      const head: Inline[] = [b(at(p)), ': '];
      if (p.kind === 'kink') {
        const [l, r] = p.jump!;
        return [
          ...head,
          `излом W — обобщённая сила меняет знак скачком: слева F = ${f4(l)}, справа F = ${f4(r)}; `,
          p.stable === 'stable' ? 'W убывает, затем растёт — минимум, равновесие устойчиво' : 'максимум W — равновесие неустойчиво',
        ];
      }
      if (er.mode === 'newton') {
        const ev = p.k.map(f4).join('; ');
        return [
          ...head,
          `собственные значения матрицы жёсткости K = −∂F/∂q: ${ev} — `,
          p.stable === 'stable'
            ? 'все положительны: минимум W, равновесие устойчиво'
            : p.stable === 'unstable'
              ? 'есть отрицательное: равновесие неустойчиво'
              : 'есть нулевое: требуется исследование высших членов',
        ];
      }
      if (p.higher) {
        const s = SUPN[p.higher.order] ?? `⁽${p.higher.order}⁾`;
        return [
          ...head,
          `W″ = 0; первая ненулевая производная W${s} = ${f4(p.higher.value)} — `,
          p.higher.order % 2 ? 'нечётного порядка: перегиб, равновесие неустойчиво' : verdict,
        ];
      }
      if (p.stable === 'neutral') return [...head, 'все производные W обращаются в нуль — безразличное равновесие'];
      // Частота малых колебаний: ω² = K/A, A — коэффициент при q̈ (приведённая масса или момент инерции).
      const w = p.w2 && p.w2[0] > 0 ? [`;  частота малых колебаний ω = √(K/A) = `, b(`${f4(Math.sqrt(p.w2[0]))} рад/с`)] : [];
      return [
        ...head,
        `K = ${er.nonPot ? '−dF/d' + q(n0) : 'W″'} = ${f4(p.k[0])} ${p.k[0] > 0 ? '> 0 — ' : '< 0 — '}`,
        p.k[0] > 0 ? 'минимум W, равновесие устойчиво' : 'максимум W, равновесие неустойчиво',
        ...w,
      ];
    });
    const lines: { c: Inline[] }[] = er.mode === 'scan' && !er.nonPot ? [{ c: [`W″ = d²W/d${q(n0)}² = `, symText(er.K[0][0])] }] : [];
    const bl: Block[] = [...(lines.length ? [{ k: 'eq' as const, lines }] : []), { k: 'ul', items }];
    if (er.gyro)
      bl.push({
        k: 'p',
        c: [
          'В T есть члены, линейные по скоростям (гироскопические силы): они не меняют положений равновесия; минимум W по-прежнему гарантирует устойчивость, а при максимуме W устойчивость может обеспечиваться гироскопическими силами — смотрите частоты малых колебаний.',
        ],
      });
    if (!opts.hasT) bl.push({ k: 'p', c: ['Кинетическая энергия не задана — частоты малых колебаний не считаются.'] });
    ex(
      bl,
      'Теорема Лагранжа — Дирихле: если в положении равновесия потенциальная энергия имеет строгий минимум, равновесие устойчиво. Если минимума нет и это видно по членам второго порядка (максимум, W″ < 0) или по первой ненулевой производной нечётного порядка (перегиб), равновесие неустойчиво (теоремы Ляпунова и Четаева).',
    );
    steps.push({ title: 'Устойчивость положений равновесия', blocks: bl });
    for (const p of er.points)
      rows.push({
        kind: 'aux',
        val: [at(p)],
        note:
          p.stable === 'stable'
            ? `устойчиво${p.w2 && p.w2[0] > 0 && er.mode === 'scan' ? `, ω = ${f4(Math.sqrt(p.w2[0]))} рад/с` : ''}`
            : p.stable === 'unstable'
              ? 'неустойчиво'
              : 'безразличное',
      });
  }
  return { steps, rows };
}
