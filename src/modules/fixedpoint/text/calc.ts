/** Решение задач по формулам (§19, 20, 25): шаги — исходные данные, формулы с подстановкой, ответ. */
import { b, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { CALC_FIELDS, CALC_KINDS, type CalcProblem, type CalcResult } from '../model/calc';

const f = (x: number) => fmt(x, 4);
const bad = (errors: string[]): Doc => ({
  steps: [
    {
      title: 'Данные',
      blocks: [
        { k: 'badge', tone: 'bad', text: 'проверьте данные' },
        { k: 'ul', items: errors.map((x) => [x]) },
      ],
    },
  ],
});

const THEORY: Record<CalcProblem['kind'], string> = {
  inv: 'Скорость точки тела с неподвижной точкой O: v = ω × r. Для M₁ это три линейных уравнения на ω; для M₂ известно лишь направление v₂ = k·e₂ — добавляется неизвестный множитель k. Система из шести уравнений относительно (ω_x, ω_y, ω_z, k) решается методом Гаусса; её совместность — проверка данных.',
  earth:
    'Положение точки на сфере — широта φ и долгота λ: φ̇ = v_N/R, λ̇ = v_E/(R cos φ). Трёхгранник Дарбу Oξηζ (ξ — на восток, η — на север, ζ — вверх) вращается вместе с Землёй (U) и вместе с точкой по её географическому положению. Для трёхгранника, ось x которого направлена вдоль скорости, добавляется поворот вокруг вертикали (курс).',
  gyro: 'Ось z внутренней рамки определяется углами α (поворот внешней рамки по часовой стрелке от меридиана) и β (подъём над горизонтом). Угловая скорость трёхгранника xyz — сумма скорости вращения географического трёхгранника (вместе с Землёй) и поворотов рамок α̇, β̇, спроектированная на оси x, y, z.',
  cardan:
    'Крестовина шарнира вращается вокруг неподвижной точки; её вилки поворачиваются на углы φ₁ и φ₂ (tg φ₂ = tg φ₁ / cos α). Отношение ω₁/ω₂ = (1 − sin²α cos²φ₁)/cos α меняется от cos α до 1/cos α за оборот.',
  turn: 'Колёса проходят дуги радиусов ρ ± l/2 за одно время с центром поворота на расстоянии ρ от продольной оси: v_колеса = ω·R = v(ρ ± l/2)/ρ. Коробка дифференциала вращается со средней угловой скоростью, сателлит — с относительной ω_r = (R₀/r)(ω₁ − ω₂)/2.',
};

export function calcDoc(pr: CalcProblem, r: CalcResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const steps: Step[] = [];
  const kind = CALC_KINDS.find((k) => k.kind === pr.kind)!;
  {
    const bl: Block[] = [
      { k: 'eq', lines: CALC_FIELDS[pr.kind].map((fl) => ({ c: [`${fl.label} = ${f(pr.p[fl.key])}${fl.unit ? ' ' + fl.unit : ''}`] as Inline[] })) },
    ];
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c: [THEORY[pr.kind]] });
    steps.push({ title: kind.label, blocks: bl });
  }
  {
    const lines = r.rows
      .filter((x) => x.formula)
      .map((x) => ({ c: [`${x.formula} → ${x.label} = `, b(`${f(x.value)}${x.unit ? ' ' + x.unit : ''}`)] as Inline[] }));
    if (lines.length) steps.push({ title: 'Формулы', blocks: [{ k: 'eq', lines }] });
  }
  if (r.lines.length) steps.push({ title: 'Мгновенная ось', blocks: [{ k: 'eq', lines: r.lines.map((x) => ({ c: [x] as Inline[] })) }] });
  const rows: AnswerRow[] = r.rows.map((x, i) => ({
    kind: i < 3 ? 'main' : 'aux',
    val: [`${x.label} = `, b(`${f(x.value)}${x.unit ? ' ' + x.unit : ''}`)] as Inline[],
    note: '',
  }));
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
