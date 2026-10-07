/**
 * Решение уравнениями Лагранжа второго рода по шагам: производные кинетической энергии, обобщённые силы,
 * уравнения движения, ускорения, интеграл энергии, малые колебания.
 */
import { b, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { prettyName, setCoordNames, symText, termText, varName } from '../../../shared/sym';
import type { LagProblem, LagSolution } from '../model/lagrange';

const f4 = (x: number) => fmt(x, 4);
/** Скобки — только вокруг суммы. */
const par = (s: string) => (/ [+−] /.test(s) || s.startsWith('−') ? `(${s})` : s);

export function lagrangeDoc(pr: LagProblem, r: LagSolution, opts: { explain?: boolean } = {}): Doc {
  setCoordNames(r.ctx.coords);
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const q = (n: string, ord = 0) => varName(prettyName(n), ord);
  const names = r.ctx.coords;
  {
    const bl: Block[] = [
      { k: 'p', c: ['Обобщённые координаты: ', b(names.map((n) => q(n)).join(', ')), names.length > 1 ? ` — система с ${names.length} степенями свободы.` : ' — система с одной степенью свободы.'] },
      {
        k: 'eq',
        lines: [{ c: ['T = ', symText(r.T)] }, { c: ['Π = ', symText(r.P)] }, ...r.rows.filter((x) => x.qNp.length).map((x) => ({ c: ['Q', { t: 'sub' as const, text: prettyName(x.name) }, '^н = ', symText(x.qNp)] }))],
      },
      {
        k: 'p',
        c: ['Уравнения Лагранжа второго рода: ', b('d/dt(∂T/∂q̇ⱼ) − ∂T/∂qⱼ = Qⱼ'), ', где обобщённая сила Qⱼ = −∂Π/∂qⱼ + Qⱼ^н (потенциальные силы — через потенциальную энергию, остальные — непотенциальная часть).'],
      },
    ];
    ex(
      bl,
      'Кинетическая энергия записывается через обобщённые координаты и скорости; связи идеальные, поэтому их реакции в уравнения не входят. Непотенциальная обобщённая сила Qⱼ^н — коэффициент при δqⱼ в сумме работ непотенциальных сил на возможном перемещении (силы сопротивления, движущие моменты и т. п.).',
    );
    steps.push({ title: 'Система', blocks: bl });
  }
  for (const x of r.rows) {
    const n = x.name;
    const lines: { c: Inline[] }[] = [
      { c: [`∂T/∂${q(n, 1)} = `, symText(x.p)] },
      { c: [`d/dt(∂T/∂${q(n, 1)}) = `, symText(x.dp)] },
      { c: [`∂T/∂${q(n)} = `, symText(x.tq)] },
      { c: [`Q`, { t: 'sub', text: prettyName(n) }, ` = −∂Π/∂${q(n)}${x.qNp.length ? ' + Q^н' : ''} = `, symText(x.qPot) + (x.qNp.length ? ' + (' + symText(x.qNp) + ')' : '')] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    const same = x.factor.f.length === 0 && Math.abs(x.factor.c) === 1;
    const eqLines: { c: Inline[] }[] = [{ c: [symText(x.E), ' = 0'] }];
    if (!same) eqLines.push({ c: ['сокращаем на ', termText(x.factor, true), ':  ', b(symText(x.Ered) + ' = 0')] });
    else eqLines[0] = { c: [b(symText(x.Ered) + ' = 0')] };
    bl.push({ k: 'p', c: ['Уравнение для координаты ', q(n), ':'] }, { k: 'eq', lines: eqLines });
    ex(bl, 'Производная по времени берётся от ∂T/∂q̇ как от сложной функции: каждая координата даёт множитель — свою скорость, каждая скорость — своё ускорение. Все члены переносятся в левую часть.');
    steps.push({ title: `Уравнение по координате ${q(n)}`, blocks: bl });
  }
  {
    const bl: Block[] = [];
    if (names.length === 1) {
      const A = r.A[0][0];
      const acc = r.acc1 ? symText(r.acc1) : `−(${symText(r.b[0])})/(${symText(A)})`;
      bl.push({ k: 'eq', lines: [{ c: [b(`${q(names[0], 2)} = ${acc}`)] }] });
    } else {
      bl.push({ k: 'p', c: ['Уравнения линейны относительно ускорений — система A·q̈ + b = 0:'] });
      bl.push({ k: 'eq', lines: r.A.map((row, i) => ({ c: [row.map((a, j) => `${par(symText(a))}·${q(names[j], 2)}`).join(' + '), ' + ', par(symText(r.b[i])), ' = 0'] })) });
      bl.push({ k: 'p', c: ['Решаем её численно при заданных значениях параметров.'] });
    }
    bl.push({ k: 'p', c: ['В начальный момент (', names.map((n, i) => `${q(n)} = ${f4(pr.coords[i].q0)}, ${q(n, 1)} = ${f4(pr.coords[i].v0)}`).join('; '), '): ', b(names.map((n, i) => `${q(n, 2)} = ${f4(r.acc0[i])}`).join('; ')), '.'] });
    ex(bl, 'Значения параметров подставляются только в числах; формулы остаются в буквах.');
    steps.push({ title: 'Ускорения', blocks: bl });
  }
  {
    const bl: Block[] = [];
    if (r.conservative) {
      bl.push({ k: 'eq', lines: [{ c: ['H = Σ q̇ⱼ·∂T/∂q̇ⱼ − T + Π = ', symText(r.H), ' = const'] }] });
      if (r.energyDrift != null) bl.push({ k: 'p', c: [`При численном интегрировании (Рунге — Кутта, шаг ${fmt(pr.tEnd / 2000, 4)} с) H меняется ${r.energyDrift < 1e-6 ? 'меньше чем на 0,0001 %' : `не больше чем на ${fmt(r.energyDrift * 100, 4)} %`} — проверка интегрирования.`] });
      ex(bl, 'Непотенциальных сил нет и T, Π не зависят от времени явно — сохраняется обобщённый интеграл энергии (Якоби). Если T — квадратичная форма скоростей, H = T + Π (полная механическая энергия).');
    } else bl.push({ k: 'p', c: ['Есть непотенциальные силы или явная зависимость от времени — механическая энергия не сохраняется.'] });
    steps.push({ title: 'Интеграл энергии', blocks: bl });
  }
  if (r.small) {
    const s = r.small;
    const bl: Block[] = [{ k: 'p', c: ['Положение ', names.map((n, i) => `${q(n)}* = ${f4(s.eq[i])}`).join(', '), s.residual < 1e-8 ? ' — равновесие (ускорения при нулевых скоростях равны нулю).' : ` — не положение равновесия: ускорение ${f4(s.residual)} ≠ 0. Задайте положение равновесия в таблице координат.`] }];
    if (s.residual < 1e-8) {
      bl.push({ k: 'p', c: ['Линеаризуем уравнения около равновесия: M·δq̈ + K·δq = 0, M = A(q*), K = ∂b/∂q (q*):'] });
      bl.push({ k: 'eq', lines: [{ c: ['M = [', s.M.map((row) => row.map(f4).join('  ')).join(';  '), ']'] }, { c: ['K = [', s.K.map((row) => row.map(f4).join('  ')).join(';  '), ']'] }] });
      const items: Inline[][] = s.w2.map((w2, i) =>
        !Number.isFinite(w2)
          ? ['частоты не вещественны (комплексные корни) — проверьте данные']
          : Math.abs(w2) < 1e-9
            ? [`ω${names.length > 1 ? '₁₂₃'[i] : ''}² = 0 — безразличное направление (движение без возвращающей силы)`]
            : w2 < 0
              ? [`ω${names.length > 1 ? '₁₂₃'[i] : ''}² = ${f4(w2)} < 0 — положение неустойчиво`]
              : [`ω${names.length > 1 ? '₁₂₃'[i] : ''}² = ${f4(w2)};  ω = `, b(f4(Math.sqrt(w2)) + ' рад/с'), `;  период T = 2π/ω = `, b(f4((2 * Math.PI) / Math.sqrt(w2)) + ' с')],
      );
      bl.push({ k: 'ul', items });
      ex(bl, 'Частоты — корни уравнения det(K − ω²M) = 0. Отрицательное ω² означает, что отклонение растёт (положение неустойчиво).');
    }
    steps.push({ title: 'Малые колебания', blocks: bl });
  }
  steps.push({
    title: 'Ответ',
    blocks: [
      {
        k: 'answer',
        rows: [
          ...r.rows.map((x) => ({ kind: 'main' as const, val: [symText(x.Ered) + ' = 0'] as Inline[], note: `уравнение по ${q(x.name)}` })),
          ...(r.small && r.small.residual < 1e-8
            ? r.small.w2.filter((w) => w > 1e-9).map((w) => ({ kind: 'aux' as const, val: [`ω = ${f4(Math.sqrt(w))} рад/с`] as Inline[], note: `период малых колебаний ${f4((2 * Math.PI) / Math.sqrt(w))} с` }))
            : []),
        ],
      },
    ],
  });
  return { steps };
}
