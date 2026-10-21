/** Решение: движение точки относительно вращающейся Земли — переносное, относительное, кориолисово ускорения. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { courseName, norm, type EarthKin, type EarthKinResult, type V3 } from '../model/earth';

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
/** Число с n значащими цифрами; очень малые и большие — с порядком: 1,749·10⁻⁴. */
export function sig(x: number, n = 4): string {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -3 && e < 6) return fmt(x, Math.max(0, n - 1 - e));
  const m = x / Math.pow(10, e);
  return `${fmt(m, n - 1)}·10${String(e).replace(/./g, (c) => SUP[c] ?? c)}`;
}
const V = (p: V3) => `(${sig(p[0])}; ${sig(p[1])}; ${sig(p[2])})`;

export function earthDoc(p: EarthKin, r: EarthKinResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok)
    return {
      steps: [
        {
          title: 'Данные',
          blocks: [
            { k: 'badge', tone: 'bad', text: 'проверьте данные' },
            { k: 'ul', items: r.errors.map((x) => [x]) },
          ],
        },
      ],
    };
  const f = (p.lat * Math.PI) / 180;
  {
    const lines: { c: Inline[] }[] = [
      { c: [`φ = ${fmt(p.lat, 4)}°, r = R + h = ${sig(p.R)} + ${sig(p.h)} = ${sig(r.r)};  `, v('ω'), ` = ${sig(p.omega)} рад/с`] },
      { c: [v('Ω'), ` = ω(0; cos φ; sin φ) = ${V(r.Om)}`] },
    ];
    if (p.vin === 'course')
      lines.push({
        c: [v('v'), sub('E'), ' = v sin k = ', `${sig(p.v)}·sin ${fmt(p.k, 4)}° = ${sig(r.vr[0])};  `, v('v'), sub('N'), ' = v cos k = ', sig(r.vr[1])],
      });
    lines.push({ c: [v('v'), sub('r'), ` = (v_E; v_N; v_h) = ${V(r.vr)}, |`, v('v'), sub('r'), '| = ', b(sig(norm(r.vr)))] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Оси места: x — на восток, y — на север, z — вверх по вертикали. Земля вращается с запада на восток вокруг оси, направленной на север; в осях места вектор её угловой скорости лежит в плоскости меридиана (yz) под углом φ к горизонту. Относительное движение — движение по отношению к Земле.',
    );
    steps.push({ title: 'Оси места и относительная скорость', blocks: bl });
  }
  {
    const lines: { c: Inline[] }[] = [
      { c: [v('v'), sub('e'), ` = Ω × r = rω cos φ на восток = ${sig(r.r)}·${sig(p.omega)}·${fmt(Math.cos(f), 4)} = `, b(sig(r.ve[0]))] },
      { c: [v('v'), ' = ', v('v'), sub('e'), ' + ', v('v'), sub('r'), ` = ${V(r.v)};  |`, v('v'), '| = ', b(sig(norm(r.v)))] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Переносная скорость — скорость той точки Земли, где сейчас находится точка: она описывает параллель радиуса r cos φ, скорость направлена на восток.',
    );
    steps.push({ title: 'Сложение скоростей', blocks: bl });
  }
  {
    const lines: { c: Inline[] }[] = [
      { c: [v('a'), sub('e'), ' = rω² cos φ (к оси Земли) = ', `${sig(norm(r.ae))};  `, v('a'), sub('e'), ` = rω² cos φ·(0; sin φ; −cos φ) = ${V(r.ae)}`] },
      { c: [v('a'), sub('rx'), ` = v̇_E + (v_E v_h − v_E v_N tg φ)/r = ${sig(p.dE)} + ${sig(r.arCurv[0])} = ${sig(r.ar[0])}`] },
      { c: [v('a'), sub('ry'), ` = v̇_N + (v_N v_h + v_E² tg φ)/r = ${sig(p.dN)} + ${sig(r.arCurv[1])} = ${sig(r.ar[1])}`] },
      {
        c: [
          v('a'),
          sub('rz'),
          ` = v̇_h − (v_E² + v_N²)/r = ${sig(p.dh)} + ${sig(r.arCurv[2])} = ${sig(r.ar[2])};  |`,
          v('a'),
          sub('r'),
          '| = ',
          sig(norm(r.ar)),
        ],
      },
      {
        c: [
          v('a'),
          sub('c'),
          ' = 2Ω × ',
          v('v'),
          sub('r'),
          ` = 2ω(v_h cos φ − v_N sin φ; v_E sin φ; −v_E cos φ) = ${V(r.ac)};  |`,
          v('a'),
          sub('c'),
          '| = ',
          b(sig(norm(r.ac))),
        ],
      },
      { c: ['горизонтальная составляющая ', v('a'), sub('c'), ': ', sig(r.acH), r.acH > 0 ? ` — на ${courseName(r.acHk)}` : ''] },
      { c: [v('a'), ' = ', v('a'), sub('e'), ' + ', v('a'), sub('r'), ' + ', v('a'), sub('c'), ` = ${V(r.a)};  |`, v('a'), '| = ', b(sig(norm(r.a)))] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Переносное ускорение — центростремительное ускорение точки Земли: к оси вращения, по модулю ω²·r cos φ. Относительное ускорение в осях места: кроме изменения составляющих скорости v̇, есть члены с 1/r — оси места поворачиваются, когда точка перемещается по шару (при v_E = const точка идёт по параллели и её относительное ускорение направлено к оси Земли, v²/(r cos φ)). Кориолисово ускорение 2Ω × v_r; его горизонтальная составляющая 2ωv sin φ перпендикулярна горизонтальной скорости — влево от неё в северном полушарии.',
    );
    steps.push({ title: 'Сложение ускорений (теорема Кориолиса)', blocks: bl });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [v('v'), ` = ${sig(norm(r.v))}`], note: `v_e = ${sig(r.ve[0])} (на восток), v_r = ${sig(norm(r.vr))}` },
    { kind: 'main', val: [v('a'), ` = ${sig(norm(r.a))}`], note: `составляющие x, y, z: ${V(r.a)}` },
    {
      kind: 'aux',
      val: [v('a'), sub('c'), ` = ${sig(norm(r.ac))}`],
      note: `кориолисово; горизонтальная составляющая ${sig(r.acH)}${r.acH > 0 ? ` — на ${courseName(r.acHk)}` : ''}`,
    },
    { kind: 'aux', val: [v('a'), sub('e'), ` = ${sig(norm(r.ae))}, `, v('a'), sub('r'), ` = ${sig(norm(r.ar))}`], note: 'переносное и относительное' },
    {
      kind: 'aux',
      val: [v('a'), sub('r'), ' + ', v('a'), sub('c'), ` = ${V([r.ar[0] + r.ac[0], r.ar[1] + r.ac[1], r.ar[2] + r.ac[2]])}`],
      note: 'ускорения, зависящие от относительной скорости',
    },
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
