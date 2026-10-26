/**
 * Решение по шагам: что такое центроиды, как находится мгновенный центр скоростей, неподвижная и подвижная центроиды
 * (точки, уравнения книги и их невязка), положение при выбранном φ.
 */
import { b, sub, v, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import type { Centrodes, Pose, Source } from '../model/centrodes';
import { bookResiduals } from '../model/centrodes';
import type { CentrodePreset } from '../presets';

const f = (x: number) => fmt(x, 3);
const pairText = (p: [number, number]) => `(${f(p[0])}; ${f(p[1])})`;

export interface CentrodesDocInput {
  preset: CentrodePreset | null;
  values: Record<string, number>;
  src: Source;
  cen: Centrodes;
  pose: Pose;
  phi: number;
  explain: boolean;
  /** Своё движение (пункт 31): уравнения — пользователя, невязки посчитаны заранее. */
  own?: { res: { fixed: number; moving: number } };
}

export function centrodesDoc(i: CentrodesDocInput): Doc {
  const { preset, src, cen, pose, phi } = i;
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (i.explain) bl.push({ k: 'p', cls: 'explain', c });
  };

  // 1. Постановка.
  {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: [
        'Мгновенный центр скоростей ',
        v('P'),
        ' при плоском движении — точка тела, скорость которой в данный момент равна нулю. Её геометрическое место в неподвижной плоскости — ',
        b('неподвижная центроида'),
        ', в плоскости, неподвижно связанной с телом, — ',
        b('подвижная центроида'),
        '. Тело движется так, что подвижная центроида катится без скольжения по неподвижной; точка касания — ',
        v('P'),
        '.',
      ],
    });
    bl.push({
      k: 'p',
      c:
        src.kind === 'mech'
          ? ['Положение механизма задаёт параметр ', v('φ'), ' (°); центроиды ищем для звена ', b(src.body), '.']
          : [
              'Движение тела задано формулами от параметра ',
              v('φ'),
              ' (°): начало подвижных осей ',
              v('O'),
              ' = (',
              v('x'),
              '(',
              v('φ'),
              '), ',
              v('y'),
              '(',
              v('φ'),
              ')), угол оси ξ ',
              v('θ'),
              '(',
              v('φ'),
              ').',
            ],
    });
    if (src.kind === 'motion')
      bl.push({
        k: 'eq',
        lines: [
          { c: [v('x'), ' = ', src.x.replace(/\*/g, '·')] },
          { c: [v('y'), ' = ', src.y.replace(/\*/g, '·')] },
          {
            c: [
              v('θ'),
              ' = ',
              src.theta.replace(/\*/g, '·'),
              '°',
              src.frameRot ? `,  ось ξ — под углом θ ${src.frameRot < 0 ? '−' : '+'} ${Math.abs(src.frameRot)}°` : '',
            ],
          },
        ],
      });
    steps.push({ title: 'Что ищем', blocks: bl });
  }

  if (!cen.ok) {
    steps.push({
      title: 'Центроиды не построены',
      blocks: [
        { k: 'badge', tone: 'bad', text: 'нет мгновенного центра скоростей' },
        { k: 'ul', items: (cen.errors.length ? cen.errors : ['Положение не строится.']).map((e) => [e]) },
      ],
    });
    return { steps };
  }

  // 2. Мгновенный центр.
  {
    const bl: Block[] = [];
    if (src.kind === 'mech') {
      bl.push({
        k: 'p',
        c: [
          'В каждом положении решаем задачу о скоростях механизма (как в разделе «Плоский механизм»): находим угловую скорость ',
          v('ω'),
          ' звена ',
          b(src.body),
          ' и скорость точки ',
          v(src.frame.o),
          '.',
        ],
      });
      bl.push({
        k: 'eq',
        lines: [
          {
            c: [
              v('x'),
              sub('P'),
              ' = ',
              v('x'),
              sub(src.frame.o),
              ' − ',
              v('v'),
              sub('y'),
              '/',
              v('ω'),
              ',   ',
              v('y'),
              sub('P'),
              ' = ',
              v('y'),
              sub(src.frame.o),
              ' + ',
              v('v'),
              sub('x'),
              '/',
              v('ω'),
            ],
          },
        ],
      });
    } else {
      bl.push({
        k: 'p',
        c: [
          'Скорость начала осей: ',
          v('v'),
          sub('x'),
          ' = ',
          v('x'),
          '′, ',
          v('v'),
          sub('y'),
          ' = ',
          v('y'),
          '′, угловая скорость тела ',
          v('ω'),
          ' = ',
          v('θ'),
          '′ (штрих — производная по параметру, угол в радианах). Мгновенный центр:',
        ],
      });
      bl.push({
        k: 'eq',
        lines: [
          { c: [v('x'), sub('P'), ' = ', v('x'), ' − ', v('y'), '′/', v('θ'), '′,   ', v('y'), sub('P'), ' = ', v('y'), ' + ', v('x'), '′/', v('θ'), '′'] },
        ],
      });
    }
    ex(
      bl,
      'Скорость тела в плоском движении — вращение вокруг мгновенного центра: ',
      v('v'),
      ' = ',
      v('ω'),
      '·',
      v('PA'),
      ', вектор скорости перпендикулярен прямой, соединяющей точку с ',
      v('P'),
      '. Если ω = 0, центр уходит в бесконечность (поступательное движение), и в этих положениях линия центроиды обрывается.',
    );
    steps.push({ title: 'Мгновенный центр скоростей', blocks: bl });
  }

  // 3. Неподвижная центроида.
  const fl = cen.fixed,
    ml = cen.moving;
  const sample = (lines: [number, number][][], phis: number[][]) => {
    const rows: Inline[][] = [];
    const flat = lines.flatMap((l, k) => l.map((p, j) => ({ p, phi: phis[k][j] })));
    const m = 5;
    for (let k = 0; k < m && flat.length; k++) {
      const q = flat[Math.round((k * (flat.length - 1)) / Math.max(1, m - 1))];
      rows.push([v('φ'), ` = ${fmt(q.phi, 1)}°:  ${pairText(q.p)}`]);
    }
    return rows;
  };
  const res = i.own ? i.own.res : preset?.check ? bookResiduals(preset.check, i.values, cen) : null;
  const eqLabel = i.own ? 'Проверяемое уравнение: ' : 'Уравнение по ответу книги: ';
  const resLabel = i.own ? 'наибольшая невязка уравнения (расстояние до линии в долях её размера)' : 'наибольшая невязка уравнения книги';
  {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: [
        'Координаты ',
        v('P'),
        ' в неподвижных осях ',
        v('x'),
        v('y'),
        ' при изменении φ дают неподвижную центроиду (линия на чертеже синяя). Несколько её точек:',
      ],
    });
    bl.push({ k: 'ul', items: sample(fl, cen.phis) });
    if (preset) {
      bl.push({ k: 'p', c: [eqLabel, b(preset.book.fixed)] });
      if (res && preset.check && Number.isFinite(res.fixed))
        bl.push({
          k: 'badge',
          tone: res.fixed <= preset.check.tol ? 'ok' : 'warn',
          text: `${resLabel} ${res.fixed < 1e-9 ? '< 10⁻⁹' : res.fixed.toExponential(1).replace('e-', '·10⁻').replace('e+', '·10')}`,
        });
    }
    steps.push({ title: 'Неподвижная центроида', blocks: bl });
  }

  // 4. Подвижная центроида.
  {
    const bl: Block[] = [];
    if (src.kind === 'mech') {
      const rotTxt = src.frame.rot ? `, повёрнутое на ${src.frame.rot}°` : '';
      bl.push({
        k: 'p',
        c: [
          'Подвижные оси ',
          v('ξ'),
          v('η'),
          ' связаны со звеном: начало — точка ',
          b(src.frame.o),
          ', ось ',
          v('ξ'),
          ' направлена от ',
          src.frame.o,
          ' к ',
          src.frame.to,
          rotTxt,
          ', ось ',
          v('η'),
          ' — ось ',
          v('ξ'),
          ', повёрнутая на +90°.',
        ],
      });
    } else {
      bl.push({
        k: 'p',
        c: [
          'Подвижные оси связаны с телом: начало — ',
          v('O'),
          ', ось ',
          v('ξ'),
          ' составляет с осью x угол ',
          v('θ'),
          src.frameRot ? ` ${src.frameRot < 0 ? '−' : '+'} ${Math.abs(src.frameRot)}°` : '',
          ', ось ',
          v('η'),
          ' повёрнута на +90°.',
        ],
      });
    }
    bl.push({
      k: 'eq',
      lines: [
        {
          c: [
            v('ξ'),
            sub('P'),
            ' = (',
            v('P'),
            ' − ',
            v('O'),
            ')·',
            v('e'),
            sub('ξ'),
            ',   ',
            v('η'),
            sub('P'),
            ' = (',
            v('P'),
            ' − ',
            v('O'),
            ')·',
            v('e'),
            sub('η'),
          ],
        },
      ],
    });
    bl.push({ k: 'p', c: ['Те же положения, но в подвижных осях, дают подвижную центроиду (красная линия). Несколько её точек:'] });
    bl.push({ k: 'ul', items: sample(ml, cen.phis) });
    if (preset) {
      bl.push({ k: 'p', c: [eqLabel, b(preset.book.moving)] });
      if (res && preset.check && Number.isFinite(res.moving))
        bl.push({
          k: 'badge',
          tone: res.moving <= preset.check.tol ? 'ok' : 'warn',
          text: `${resLabel} ${res.moving < 1e-9 ? '< 10⁻⁹' : res.moving.toExponential(1).replace('e-', '·10⁻').replace('e+', '·10')}`,
        });
    }
    ex(
      bl,
      'В каждый момент подвижная центроида касается неподвижной в точке ',
      v('P'),
      ', а её длина дуги от начального положения совпадает с длиной дуги неподвижной — так выглядит качение без скольжения. На втором чертеже тело нарисовано в подвижных осях: оно неподвижно, а ',
      v('P'),
      ' бегает по подвижной центроиде.',
    );
    steps.push({ title: 'Подвижная центроида', blocks: bl });
  }

  // 5. Выбранное положение и ответ.
  {
    const bl: Block[] = [];
    if (pose.ok && pose.ic && pose.local) {
      bl.push({
        k: 'eq',
        lines: [
          { c: [v('φ'), ` = ${fmt(phi, 1)}°:   `, v('P'), ` = ${pairText(pose.ic)}   (в неподвижных осях)`] },
          {
            c: [
              v('P'),
              ` = ${pairText(pose.local)}   (в подвижных осях)`,
              ',   ',
              v('ω'),
              ` = ${f(pose.omega)}`,
              src.kind === 'mech' ? ' (при ω ведущего звена = 1)' : ' (на единицу φ)',
            ],
          },
        ],
      });
    } else {
      bl.push({
        k: 'badge',
        tone: 'warn',
        text: pose.ok ? 'в этом положении тело движется поступательно: мгновенный центр в бесконечности' : 'в этом положении механизм не строится',
      });
      if (!pose.ok) bl.push({ k: 'ul', items: pose.errors.map((e) => [e]) });
    }
    steps.push({ title: `Положение φ = ${fmt(phi, 1)}°`, blocks: bl });
  }
  if (preset) {
    steps.push({
      title: 'Ответ',
      blocks: [
        {
          k: 'answer',
          rows: [
            { kind: 'main', val: [preset.book.fixed], note: 'неподвижная центроида' },
            { kind: 'main', val: [preset.book.moving], note: 'подвижная центроида' },
          ],
        },
      ],
    });
  }
  return { steps };
}
