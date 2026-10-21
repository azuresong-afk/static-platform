/**
 * Режим «Силы инерции в машинах» вкладки «Принцип Даламбера» (Мещерский §41): стержень на угле в зависимости от
 * угла, жидкость в ускоренном сосуде, груз на призме, кривошипный механизм, кран, паром, полиспаст, клин между
 * пластинами, вращающиеся стержень, пластина и диск, стабилизатор качки.
 *
 * Метод: к каждому телу прикладываем силу инерции Φ = −m·a (точечные массы) или главный вектор и главный момент сил
 * инерции (тело в плоском движении), затем составляем уравнения равновесия «статики» для реакций и давлений.
 * Ускорение силы тяжести g = 9,81 м/с².
 */
import { sig } from '../relative/text/earth';
import type { Catalog, Machine, MachinePreset, Param, Row, Solved, Step, Vals, Fig } from '../../shared/machines/types';
import { arrow, circle, ground, line, pin, poly, rect, svgOf, text, type P } from '../../shared/machines/sketch';

const G = 9.81;
const PI = Math.PI;
const rad = (a: number) => (a * PI) / 180;
const s4 = (x: number) => sig(x, 4);
const par = (k: string, label: string, def: number, unit?: string, o: Partial<Param> = {}): Param => ({ k, label, def, unit, ...o });
const W = 760,
  H = 300;
const fl = (p: P, s: string, a: 'start' | 'middle' | 'end' = 'start') => text(p, s, a, 'mc-t');
const inert = (a: P, b: P) => arrow(a, b, 'mc-inert');
const react = (a: P, b: P) => arrow(a, b, 'mc-react');

function fin(m: Machine, v: Vals, build: (v: Vals) => { steps: Step[]; rows: Row[]; fig: Fig }, extra: string[] = []): Solved {
  const e = [...m.params.filter((p) => !p.zero && !p.neg && !(v[p.k] > 0)).map((p) => `«${p.label}» должно быть больше нуля.`), ...extra];
  return e.length ? { ok: false, errors: e } : { ok: true, ...build(v) };
}

/* ---------- 41.5–41.6 стержень, опирающийся на угол ---------- */
export interface StickOut {
  Jx: number;
  Jy: number;
  Mc: number;
  Nd: number;
  /** Угловые скорость и ускорение стержня. */
  w: number;
  eps: number;
}
/** Силы инерции стержня и динамическое давление на угол D при заданном угле φ (кинематика: tg φ = H/(x_D − x_A)). */
export function stickAt(G_: number, l: number, Hh: number, v: number, phi: number): StickOut {
  const f = rad(phi);
  const m = G_ / G;
  const w = (v * Math.sin(f) ** 2) / Hh;
  const eps = (2 * v * Math.sin(f) * Math.cos(f) * w) / Hh;
  const aCx = -l * (eps * Math.sin(f) + w * w * Math.cos(f));
  const aCy = l * (eps * Math.cos(f) - w * w * Math.sin(f));
  const Jx = -m * aCx,
    Jy = -m * aCy;
  const Jc = (m * l * l) / 3;
  const Mc = -Jc * eps;
  // Моменты относительно A: давление N_D ⟂ стержню на расстоянии H/sin φ, вес и силы инерции в центре C.
  const Nd = ((G_ * l * Math.cos(f) - (l * Math.cos(f) * Jy - l * Math.sin(f) * Jx) - Mc) * Math.sin(f)) / Hh;
  return { Jx, Jy, Mc, Nd, w, eps };
}
const stick: Machine = {
  id: 'stick',
  name: 'Стержень на упоре и угле: силы инерции от угла',
  params: [
    par('G', 'вес стержня G', 20, 'Н'),
    par('l', 'половина длины l (AB = 2l)', 0.5, 'м'),
    par('H', 'высота угла D над направляющей H', 0.4, 'м'),
    par('v', 'скорость упора v', 2, 'м/с'),
    par('phi', 'угол φ', 45, '°'),
  ],
  solve(vv) {
    return fin(this, vv, ({ G: Gg, l, H: Hh, v, phi }) => {
      const m = Gg / G;
      const o = stickAt(Gg, l, Hh, v, phi);
      const f = rad(phi);
      const NdStat = (Gg * l * Math.cos(f) * Math.sin(f)) / Hh;
      const steps: Step[] = [
        {
          title: 'Кинематика стержня',
          lines: [
            [
              'конец A движется со скоростью v вдоль направляющей, стержень опирается на угол D на высоте H: tg φ = H/(x_D − x_A)',
              'φ̇ = v·sin²φ/H,  φ̈ = 2v·sin φ·cos φ·φ̇/H = 2v²·sin³φ·cos φ/H²',
            ],
            [`ω = ${s4(o.w)} рад/с,  ε = ${s4(o.eps)} рад/с²`],
          ],
          note: 'Дифференцируем H = (x_D − x_A)·tg φ по времени: −ẋ_A = ...; ẋ_A = v постоянна.',
        },
        {
          title: 'Ускорение центра масс C',
          lines: [
            [
              'x_C = x_A + l·cos φ,  y_C = l·sin φ',
              'a_Cx = −l(ε·sin φ + ω²·cos φ) = −3l·v²·sin⁴φ·cos φ/H²',
              'a_Cy = l(ε·cos φ − ω²·sin φ) = l·v²·sin³φ·(3cos²φ − 1)/H²',
            ],
          ],
        },
        {
          title: 'Главный вектор и момент сил инерции',
          lines: [
            [
              'Φ_x = −m·a_Cx = 3(G/g)·(v²/H²)·l·sin⁴φ·cos φ',
              'Φ_y = −m·a_Cy = (G/g)·(v²/H²)·l·(1 − 3cos²φ)·sin³φ',
              'M_Φ = −J_C·ε = −(2/3)(G/g)·l²·(v²/H²)·sin³φ·cos φ,  J_C = m·l²/3',
            ],
            [`m = ${s4(m)} кг:  Φ_x = ${s4(o.Jx)} Н,  Φ_y = ${s4(o.Jy)} Н,  M_Φ = ${s4(o.Mc)} Н·м`],
          ],
        },
        {
          title: 'Давление на угол D',
          lines: [
            [
              'ΣM_A = 0: N_D·AD − G·l·cos φ + (l·cos φ·Φ_y − l·sin φ·Φ_x) + M_Φ = 0,  AD = H/sin φ',
              'динамическое давление (сверх статического): N_D = (8/3)·(v²·l²/(H³·g))·G·sin⁴φ·cos φ',
            ],
            [`статическое  G·l·sin φ·cos φ/H = ${s4(NdStat)} Н;  полное N_D = ${s4(o.Nd)} Н;  динамическое ${s4(o.Nd - NdStat)} Н`],
          ],
        },
        {
          title: 'Зависимость от угла φ',
          lines: [30, 45, 60, 75, 90, 105, 120, 135, 150].map((a) => {
            const q = stickAt(Gg, l, Hh, v, a);
            return [
              `φ = ${a}°:  Φ_x = ${s4(q.Jx)} Н,  Φ_y = ${s4(q.Jy)} Н,  M_Φ = ${s4(q.Mc)} Н·м,  N_D (дин.) = ${s4(q.Nd - (Gg * l * Math.cos(rad(a)) * Math.sin(rad(a))) / Hh)} Н`,
            ];
          }),
        },
      ];
      const y0 = 250;
      const xD = Hh / Math.tan(f),
        xB = 2 * l * Math.cos(f);
      const xr = Math.max(xD + 0.25 * Hh, xB, 0.1),
        yr = Math.max(Hh * 1.15, 2 * l * Math.sin(f), 0.1);
      const sc = Math.min(520 / xr, 190 / yr);
      const A: P = [160, y0];
      const D: P = [A[0] + xD * sc, y0 - Hh * sc];
      const B: P = [A[0] + xB * sc, y0 - 2 * l * sc * Math.sin(f)];
      const C: P = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      const g = [
        ground(60, 740, y0),
        poly([
          [D[0], D[1]],
          [D[0] + 90, D[1]],
          [D[0] + 90, D[1] - 12],
          [D[0], D[1] - 12],
        ]),
        line([D[0] + 90, D[1]], [D[0] + 90, y0], 'mc-hatch'),
        line(A, B),
        pin(A),
        pin(C),
        fl([A[0] - 8, A[1] + 22], 'A', 'end'),
        fl([B[0] + 8, B[1] - 4], 'B'),
        fl([D[0] + 6, D[1] + 20], 'D'),
        fl([C[0] - 12, C[1] - 8], 'C', 'end'),
        arrow([A[0] - 90, y0 - 12], [A[0] - 22, y0 - 12]),
        fl([A[0] - 98, y0 - 20], 'v', 'end'),
        inert(C, [C[0] + (o.Jx >= 0 ? 60 : -60), C[1]]),
        inert(C, [C[0], C[1] + (o.Jy >= 0 ? -50 : 50)]),
        fl([C[0] + 66, C[1] - 6], 'Φ'),
        react([D[0] - 36 * Math.sin(f) * -1, D[1] - 36 * Math.cos(f)], [D[0], D[1]]),
        fl([D[0] - 14, D[1] - 42], 'N_D', 'end'),
      ];
      return {
        steps,
        rows: [
          { key: 'Jx', label: ['Φ', { t: 'sub', text: 'x' }], val: o.Jx, unit: 'Н' },
          { key: 'Jy', label: ['Φ', { t: 'sub', text: 'y' }], val: o.Jy, unit: 'Н' },
          { key: 'Mc', label: ['M', { t: 'sub', text: 'Φ' }], val: o.Mc, unit: 'Н·м' },
          { key: 'Nd', label: ['N', { t: 'sub', text: 'D' }, ' (динамическое)'], val: o.Nd - NdStat, unit: 'Н' },
        ],
        fig: svgOf(W, H, g),
      };
    });
  },
};

/* ---------- 41.8 жидкость в тендере ---------- */
const tender: Machine = {
  id: 'tender',
  name: 'Жидкость в ускоренном сосуде (тендер)',
  params: [par('v', 'скорость в конце разгона v', 72, 'км/ч'), par('t', 'время разгона t', 20, 'с')],
  solve(vv) {
    return fin(this, vv, ({ v, t }) => {
      const w = v / 3.6 / t;
      const tg = w / G;
      const a = (Math.atan(tg) * 180) / PI;
      const steps: Step[] = [
        { title: 'Ускорение', lines: [['движение равноускоренное: w = v/t'], [`w = ${s4(v / 3.6)}/${s4(t)} = ${s4(w)} м/с²`]] },
        {
          title: 'Силы инерции и поверхность',
          lines: [
            [
              'на каждую частицу воды действуют вес m·g и сила инерции m·w против ускорения; свободная поверхность перпендикулярна их равнодействующей',
              'tg α = w/g',
            ],
            [`tg α = ${s4(w)}/${s4(G)} = ${s4(tg)},  α = ${s4(a)}°`],
          ],
        },
      ];
      const g = [
        ground(60, 700, 250),
        rect(200, 120, 300, 110),
        poly(
          [
            [200, 160],
            [500, 160 - 300 * tg],
            [500, 230],
            [200, 230],
          ],
          'mc-liquid',
        ),
        arrow([140, 175], [190, 175]),
        fl([130, 170], 'w', 'end'),
        inert([510, 180], [460, 180]),
        fl([470, 172], 'Φ'),
      ];
      return {
        steps,
        rows: [
          { key: 'tg', label: ['tg α'], val: tg, unit: '' },
          { key: 'alpha', label: ['α'], val: a, unit: '°' },
        ],
        fig: svgOf(W, H, g),
      };
    });
  },
};

/* ---------- 41.9 жидкостный акселерометр ---------- */
const accel: Machine = {
  id: 'accel',
  name: 'Жидкостный акселерометр (изогнутая трубка)',
  params: [
    par('a1', 'угол α₁ заднего колена', 45, '°'),
    par('a2', 'угол α₂ переднего колена', 45, '°'),
    par('h1', 'уровень h₁ в заднем колене', 25, 'мм'),
    par('h2', 'уровень h₂ в переднем колене', 75, 'мм'),
  ],
  solve(vv) {
    return fin(
      this,
      vv,
      ({ a1, a2, h1, h2 }) => {
        const t1 = Math.tan(rad(a1)),
          t2 = Math.tan(rad(a2));
        const w = (G * (h2 - h1) * t1 * t2) / (h1 * t2 + h2 * t1);
        const steps: Step[] = [
          {
            title: 'Условие равновесия жидкости',
            lines: [
              [
                'при торможении сила инерции m·w направлена вперёд; оба свободных уровня лежат на одной эквипотенциальной поверхности: g·h₂ − w·h₂·ctg α₂ = g·h₁ + w·h₁·ctg α₁',
              ],
              ['w = g·(h₂ − h₁)/(h₁·ctg α₁ + h₂·ctg α₂) = g·(h₂ − h₁)·tg α₁·tg α₂/(h₁·tg α₂ + h₂·tg α₁)'],
            ],
            note: 'x₂ = h₂·ctg α₂ — смещение уровня переднего колена от нижней точки трубки вперёд, x₁ = −h₁·ctg α₁ — заднего назад.',
          },
          {
            title: 'Замедление',
            lines: [[`w = ${s4(G)}·(${s4(h2)} − ${s4(h1)})·${s4(t1)}·${s4(t2)}/(${s4(h1)}·${s4(t2)} + ${s4(h2)}·${s4(t1)}) = ${s4(w)} м/с² = ${s4(w / G)}·g`]],
          },
        ];
        const bx = 330,
          by = 230,
          L = 210;
        const p1: P = [bx - L * Math.cos(rad(a1)), by - L * Math.sin(rad(a1))];
        const p2: P = [bx + L * Math.cos(rad(a2)), by - L * Math.sin(rad(a2))];
        const k = 1.5;
        const l1: P = [bx - (h1 * k) / Math.tan(rad(a1)), by - h1 * k];
        const l2: P = [bx + (h2 * k) / Math.tan(rad(a2)), by - h2 * k];
        const g = [
          line(p1, [bx, by]),
          line([bx, by], p2),
          poly([[bx, by], l1, l2], 'mc-liquid'),
          arrow([bx + 330, 110], [bx + 270, 110]),
          fl([bx + 340, 106], 'w'),
          line([l1[0] - 30, l1[1]], [l1[0] + 10, l1[1]], 'mc-axis'),
          line([l2[0] - 10, l2[1]], [l2[0] + 30, l2[1]], 'mc-axis'),
          line([bx - 120, by], [bx - 120, l1[1]], 'mc-axis'),
          fl([bx - 126, (by + l1[1]) / 2], 'h₁', 'end'),
          line([bx + 150, by], [bx + 150, l2[1]], 'mc-axis'),
          fl([bx + 156, (by + l2[1]) / 2], 'h₂'),
        ];
        return {
          steps,
          rows: [
            { key: 'w', label: ['w'], val: w, unit: 'м/с²' },
            { key: 'wg', label: ['w/g'], val: w / G, unit: '', aux: true },
          ],
          fig: svgOf(W, H, g),
        };
      },
      vv.h2 > vv.h1 ? [] : ['Уровень h₂ в переднем колене должен быть выше h₁.'],
    );
  },
};

/* ---------- 41.10 груз на призме ---------- */
const prism: Machine = {
  id: 'prism',
  name: 'Груз на боковой грани призмы',
  params: [par('alpha', 'угол грани α', 30, '°'), par('Q', 'вес груза Q', 10, 'Н')],
  solve(vv) {
    return fin(this, vv, ({ alpha, Q }) => {
      const t = Math.tan(rad(alpha));
      const w = G * t;
      const N = Q / Math.cos(rad(alpha));
      const steps: Step[] = [
        {
          title: 'Силы на грузе',
          lines: [
            [
              'груз покоится относительно призмы, которая движется с ускорением w; сила инерции Φ = Q·w/g направлена против ускорения',
              'вес Q, нормальная реакция N (гладкая грань), Φ образуют равновесную систему',
            ],
          ],
        },
        {
          title: 'Равновесие вдоль грани',
          lines: [['Φ·cos α − Q·sin α = 0  ⇒  w = g·tg α;  N = Q/cos α'], [`w = ${s4(G)}·tg ${s4(alpha)}° = ${s4(w)} м/с²,  N = ${s4(N)} Н`]],
        },
      ];
      const f = rad(alpha);
      const g = [
        ground(60, 700, 250),
        poly([
          [260, 250],
          [520, 250],
          [520, 250 - 260 * Math.tan(f)],
        ]),
        rect(380, 250 - 130 * Math.tan(f) - 24, 24, 24),
        arrow([560, 220], [610, 220]),
        fl([620, 226], 'w'),
        fl([300, 238], 'α'),
      ];
      return {
        steps,
        rows: [
          { key: 'w', label: ['w'], val: w, unit: 'м/с²' },
          { key: 'N', label: ['N'], val: N, unit: 'Н', aux: true },
        ],
        fig: svgOf(W, H, g),
      };
    });
  },
};

/* ---------- 41.11 испытание на усталость: сила в бруске ---------- */
const crank: Machine = {
  id: 'crank',
  name: 'Испытание на усталость: кривошипный механизм',
  params: [
    par('Q', 'вес груза Q', 100, 'Н'),
    par('r', 'длина кривошипа r', 0.05, 'м'),
    par('l', 'длина шатуна l', 0.25, 'м'),
    par('w', 'угловая скорость ω', 100, 'рад/с'),
  ],
  solve(vv) {
    return fin(
      this,
      vv,
      ({ Q, r, l, w }) => {
        const S = (a: number) => Q + (Q / G) * r * w * w * (Math.cos(a) + (r / l) * Math.cos(2 * a));
        // Точное: ползун B движется по закону x(t) = r·cos ωt + √(l² − r²·sin²ωt); ускорение — вторая производная.
        const xb = (a: number) => r * Math.cos(a) + Math.sqrt(l * l - r * r * Math.sin(a) ** 2);
        const dd = 1e-4;
        const accE = (a: number) => ((xb(a + dd) - 2 * xb(a) + xb(a - dd)) / (dd * dd)) * w * w;
        const Se = (a: number) => Q - (Q / G) * accE(a);
        const steps: Step[] = [
          {
            title: 'Перемещение ползуна',
            lines: [
              [
                'ползун B движется по вертикали вниз от O: x_B = r·cos ωt + √(l² − r²·sin²ωt)',
                '√(1 − (r/l)²·sin²ωt) ≈ 1 − ½(r/l)²·sin²ωt  ⇒  x_B ≈ l + r·cos ωt − (r²/4l)(1 − cos 2ωt)',
              ],
            ],
          },
          {
            title: 'Ускорение и сила инерции',
            lines: [
              ['a_B = ẍ_B = −r·ω²(cos ωt + (r/l)·cos 2ωt)', 'на груз Q действуют вес Q и сила инерции Φ = −(Q/g)·a_B; брусок растянут силой S = Q + Φ'],
              ['S = Q + (Q/g)·r·ω²·(cos ωt + (r/l)·cos 2ωt)'],
            ],
            note: 'Координата x_B отсчитывается вниз от оси O, угол ωt — от нижнего положения кривошипа: при ωt = 0 ползун в нижней мёртвой точке и ускорен вверх, сила в бруске наибольшая; при ωt = π — наименьшая.',
          },
          {
            title: 'Крайние значения',
            lines: [
              [`ωt = 0:  S_max = Q + (Q/g)·rω²(1 + r/l) = ${s4(S(0))} Н  (точно ${s4(Se(0))} Н)`],
              [`ωt = π:  S_min = Q + (Q/g)·rω²(r/l − 1) = ${s4(S(PI))} Н  (точно ${s4(Se(PI))} Н)`],
            ],
          },
        ];
        const pts: P[] = [];
        const lo = Math.min(S(0), S(PI), Q),
          hi = Math.max(S(0), S(PI), Q);
        for (let i = 0; i <= 120; i++) {
          const a = (i / 120) * 2 * PI;
          pts.push([380 + (a / (2 * PI)) * 320, 220 - ((S(a) - lo) / Math.max(hi - lo, 1e-9)) * 160]);
        }
        const g = [
          line([380, 50], [380, 240], 'mc-axis'),
          line([380, 220 - ((Q - lo) / Math.max(hi - lo, 1e-9)) * 160], [700, 220 - ((Q - lo) / Math.max(hi - lo, 1e-9)) * 160], 'mc-axis'),
          poly(pts, 'mc-react', false),
          fl([380, 270], 'ωt = 0', 'middle'),
          fl([700, 270], '2π', 'end'),
          fl([372, 56], 'S', 'end'),
          circle([150, 100], 36),
          line([150, 100], [150 + 36 * Math.cos(rad(60)), 100 - 36 * Math.sin(rad(60))]),
          line([150 + 36 * Math.cos(rad(60)), 100 - 36 * Math.sin(rad(60))], [150, 250 - 70]),
          rect(138, 180, 24, 20),
          line([150, 200], [150, 240]),
          rect(125, 240, 50, 26),
          fl([150, 258], 'Q', 'middle'),
        ];
        return {
          steps,
          rows: [
            { key: 'Smax', label: ['S', { t: 'sub', text: 'max' }], val: S(0), unit: 'Н' },
            { key: 'Smin', label: ['S', { t: 'sub', text: 'min' }], val: S(PI), unit: 'Н' },
            { key: 'Smaxx', label: ['S', { t: 'sub', text: 'max' }, ' (точно, без разложения в ряд)'], val: Se(0), unit: 'Н', aux: true },
          ],
          fig: svgOf(W, H, g),
        };
      },
      vv.l > vv.r ? [] : ['Шатун должен быть длиннее кривошипа.'],
    );
  },
};

/* ---------- 41.12–41.13 поворотный кран ---------- */
const crane: Machine = {
  id: 'crane',
  name: 'Поворотный кран: подъём груза, движение тележки',
  params: [
    par('H', 'расстояние AB между опорами', 5, 'м'),
    par('a', 'вылет тележки D', 5, 'м'),
    par('xc', 'расстояние центра тяжести крана C от оси', 2, 'м'),
    par('Pc', 'вес крана', 2, 'т'),
    par('Pt', 'вес тележки', 0.5, 'т'),
    par('Q', 'вес груза E', 3, 'т', { zero: true }),
    par('kv', 'ускорение груза вверх, в долях g', 1 / 3, '', { zero: true, neg: true }),
    par('kt', 'ускорение тележки влево, в долях g', 0, '', { zero: true, neg: true }),
  ],
  solve(vv) {
    return fin(this, vv, ({ H: Hh, a, xc, Pc, Pt, Q, kv, kt }) => {
      const Ql = Q * (1 + kv);
      const Phi = Pt * kt;
      const sumWx = Pc * xc + Pt * a + Ql * a;
      const XB = -sumWx / Hh - Phi;
      const XA = -XB - Phi;
      const YA = Pc + Pt + Ql;
      const steps: Step[] = [
        {
          title: 'Силы инерции',
          lines: [
            [
              'груз поднимается с ускорением kv·g: к нему добавляется сила инерции Q·kv вниз — эффективный вес Q(1 + kv)',
              'тележка движется влево с ускорением kt·g: сила инерции Φ = P_т·kt направлена вправо и приложена на высоте опоры B',
            ],
            [`Q·(1 + k_v) = ${s4(Ql)} т,  Φ = ${s4(Phi)} т`],
          ],
        },
        {
          title: 'Уравнения равновесия',
          lines: [
            ['ΣM_A = 0: −X_B·AB − Φ·AB − (P_к·x_C + P_т·a + Q(1 + k_v)·a) = 0', 'ΣX = 0: X_A + X_B + Φ = 0;  ΣY = 0: Y_A − P_к − P_т − Q(1 + k_v) = 0'],
            [`X_B = ${s4(XB)} т,  X_A = ${s4(XA)} т,  Y_A = ${s4(YA)} т`],
          ],
          note: 'Ось x вправо, y вверх; A — подпятник внизу, B — подшипник вверху.',
        },
      ];
      const A: P = [200, 250],
        B: P = [200, 70];
      const sx = 40;
      const g = [
        ground(120, 400, 250),
        line(A, B),
        pin(A),
        pin(B),
        line([200, 70], [200 + a * sx, 70]),
        rect(200 + a * sx - 14, 60, 28, 18),
        line([200 + a * sx, 78], [200 + a * sx, 170]),
        rect(200 + a * sx - 12, 170, 24, 22),
        line([200 + xc * sx, 190], [200, 120], 'mc-body'),
        fl([A[0] - 10, A[1] + 6], 'A', 'end'),
        fl([B[0] - 10, B[1]], 'B', 'end'),
        react([A[0] - 40, A[1] - 10], [A[0] - 4, A[1] - 10]),
        fl([A[0] - 46, A[1] - 6], 'X_A', 'end'),
        react([B[0] + 40, B[1]], [B[0] + 4, B[1]]),
        fl([B[0] + 46, B[1] - 8], 'X_B'),
        react([A[0] + 20, A[1] + 40], [A[0] + 20, A[1] + 4]),
        fl([A[0] + 26, A[1] + 40], 'Y_A'),
      ];
      return {
        steps,
        rows: [
          { key: 'XA', label: ['X', { t: 'sub', text: 'A' }], val: XA, unit: 'т' },
          { key: 'XB', label: ['X', { t: 'sub', text: 'B' }], val: XB, unit: 'т' },
          { key: 'YA', label: ['Y', { t: 'sub', text: 'A' }], val: YA, unit: 'т' },
        ],
        fig: svgOf(W, H, g),
      };
    });
  },
};

/* ---------- 41.14 паром ---------- */
const ferry: Machine = {
  id: 'ferry',
  name: 'Грузовик тормозит на пароме: натяжение канатов',
  params: [
    par('P', 'вес грузовика', 7, 'т'),
    par('v', 'скорость въезда v', 12, 'км/ч'),
    par('s', 'путь торможения s', 3, 'м'),
    par('n', 'число канатов n', 2, ''),
  ],
  solve(vv) {
    return fin(this, vv, ({ P, v, s, n }) => {
      const w = (v / 3.6) ** 2 / (2 * s);
      const F = (P * w) / G;
      const T = F / n;
      const steps: Step[] = [
        { title: 'Замедление грузовика', lines: [['v² = 2·w·s'], [`w = (${s4(v / 3.6)} м/с)²/(2·${s4(s)}) = ${s4(w)} м/с²`]] },
        {
          title: 'Сила трения и натяжение канатов',
          lines: [
            ['сила трения колёс о настил F = (P/g)·w, она передаётся парому; паром неподвижен (его масса и ускорение не учитываются): n·T = F'],
            [`F = ${s4(P)}·${s4(w)}/${s4(G)} = ${s4(F)} т,  T = F/n = ${s4(T)} т`],
          ],
        },
      ];
      const g = [
        rect(180, 190, 400, 14),
        rect(260, 150, 110, 40),
        circle([290, 205], 10),
        circle([345, 205], 10),
        line([180, 197], [100, 160], 'mc-thread'),
        line([580, 197], [660, 160], 'mc-thread'),
        ground(60, 700, 230),
        arrow([480, 140], [400, 140]),
        fl([490, 146], 'w'),
      ];
      return {
        steps,
        rows: [
          { key: 'w', label: ['w'], val: w, unit: 'м/с²', aux: true },
          { key: 'T', label: ['T'], val: T, unit: 'т' },
        ],
        fig: svgOf(W, H, g),
      };
    });
  },
};

/* ---------- 41.16 полиспаст с грузами P и Q ---------- */
const hoistDyn: Machine = {
  id: 'hoistdyn',
  name: 'Полиспаст: ускорение грузов',
  params: [par('P', 'вес груза P (опускается)', 3, 'кГ'), par('Q', 'вес груза Q (поднимается)', 10, 'кГ')],
  solve(vv) {
    return fin(this, vv, ({ P, Q }) => {
      const w = (4 * G * (4 * P - Q)) / (16 * P + Q);
      const T = P * (1 - w / G);
      const steps: Step[] = [
        { title: 'Кинематика', lines: [['груз Q удерживают четыре ветви каната: он движется в 4 раза медленнее груза P: w_Q = w/4']] },
        {
          title: 'Силы инерции и равновесие',
          lines: [
            ['груз P: P − (P/g)·w − T = 0  ⇒  T = P(1 − w/g)', 'груз Q (подвижные блоки без массы): 4T − Q − (Q/g)·(w/4) = 0'],
            ['4P(1 − w/g) = Q(1 + w/(4g))  ⇒  w = 4g·(4P − Q)/(16P + Q)'],
            [`w = 4·${s4(G)}·(4·${s4(P)} − ${s4(Q)})/(16·${s4(P)} + ${s4(Q)}) = ${s4(w)} м/с²,  T = ${s4(T)} кГ`],
          ],
          note: 'Знак w: w > 0 — груз P опускается; при 4P = Q движение равномерно: P/Q = 1/4.',
        },
      ];
      const g = [
        line([260, 40], [560, 40], 'mc-ground'),
        circle([300, 80], 22),
        circle([420, 150], 22),
        circle([300, 200], 22),
        line([278, 80], [278, 190], 'mc-thread'),
        rect(262, 230, 48, 26),
        fl([286, 248], 'Q', 'middle'),
        rect(560, 120, 44, 26),
        fl([582, 138], 'P', 'middle'),
        line([322, 80], [560, 80], 'mc-thread'),
      ];
      return {
        steps,
        rows: [
          { key: 'w', label: ['w'], val: w, unit: 'м/с²' },
          { key: 'ratio', label: ['P/Q (равномерное движение)'], val: 0.25, unit: '', aux: true },
        ],
        fig: svgOf(W, H, g),
      };
    });
  },
};

/* ---------- 41.17 клин между пластинами ---------- */
const wedgeDyn: Machine = {
  id: 'wedgedyn',
  name: 'Клин раздвигает две пластины',
  params: [par('P', 'вес клина P', 10, 'кГ'), par('P1', 'вес каждой пластины P₁', 5, 'кГ'), par('alpha', 'половина угла при вершине α', 20, '°')],
  solve(vv) {
    return fin(this, vv, ({ P, P1, alpha }) => {
      const t = Math.tan(rad(alpha));
      const w = (G * P) / (P + 2 * P1 * t * t);
      const w1 = w * t;
      const N = (P1 * w1) / (G * Math.cos(rad(alpha)));
      const steps: Step[] = [
        { title: 'Кинематика', lines: [['клин опускается с ускорением w, каждая пластина скользит по столу с ускорением w₁ = w·tg α']] },
        {
          title: 'Силы инерции и равновесие',
          lines: [
            ['пластина (по горизонтали): N·cos α = (P₁/g)·w₁  ⇒  N = P₁·w₁/(g·cos α)', 'клин (по вертикали): P − (P/g)·w − 2N·sin α = 0'],
            ['w = g·P·ctg α/(P·ctg α + 2P₁·tg α)'],
            [`w = ${s4(w)} м/с²,  w₁ = ${s4(w1)} м/с²,  N = ${s4(N)} кГ`],
          ],
          note: 'Грань клина образует угол α с вертикалью; N — давление клина на пластину, перпендикулярное грани.',
        },
      ];
      const f = rad(alpha);
      const g = [
        ground(60, 700, 250),
        poly([
          [380, 250],
          [380 - 80 * Math.tan(f), 130],
          [380 + 80 * Math.tan(f), 130],
        ]),
        rect(190, 214, 150, 36),
        rect(420, 214, 150, 36),
        arrow([380, 90], [380, 128]),
        fl([390, 100], 'w'),
        arrow([190, 232], [140, 232]),
        fl([130, 238], 'w₁', 'end'),
      ];
      return {
        steps,
        rows: [
          { key: 'w', label: ['w'], val: w, unit: 'м/с²' },
          { key: 'w1', label: ['w', { t: 'sub', text: '1' }], val: w1, unit: 'м/с²' },
          { key: 'N', label: ['N'], val: N, unit: 'кГ' },
        ],
        fig: svgOf(W, H, g),
      };
    });
  },
};

/* ---------- 41.20 маховик стабилизатора ---------- */
const stabilizer: Machine = {
  id: 'stabilizer',
  name: 'Маховик с эксцентриситетом (стабилизатор качки)',
  params: [par('P', 'вес маховика', 110, 'т'), par('e', 'смещение центра тяжести e', 1.08, 'мм'), par('n', 'частота вращения n', 910, 'об/мин')],
  solve(vv) {
    return fin(this, vv, ({ P, e, n }) => {
      const w = (n * PI) / 30;
      const N = (P / G) * w * w * (e / 1000);
      const steps: Step[] = [
        {
          title: 'Сила инерции',
          lines: [
            [
              'центр тяжести описывает окружность радиуса e с угловой скоростью ω: Φ = m·e·ω² (центробежная сила инерции, направлена по прямой через ось и центр тяжести)',
              'ω = π·n/30',
            ],
            [`ω = ${s4(w)} рад/с,  Φ = (${s4(P)}/${s4(G)})·${s4(e / 1000)}·${s4(w)}² = ${s4(N)} т`],
          ],
          note: 'Дополнительное давление на подшипники равно силе инерции — в сумме обеих опор.',
        },
      ];
      const g = [
        circle([380, 150], 80),
        circle([380, 150], 4, 'mc-body', true),
        circle([420, 150], 12, 'mc-body', true),
        line([380, 150], [420, 150], 'mc-axis'),
        react([380, 150], [500, 150]),
        fl([510, 146], 'N'),
        fl([400, 134], 'e'),
      ];
      return { steps, rows: [{ key: 'N', label: ['N'], val: N, unit: 'т' }], fig: svgOf(W, H, g) };
    });
  },
};

/* ---------- 41.21–41.23 разрыв вращающихся тел ---------- */
const rod: Machine = {
  id: 'rod',
  name: 'Растяжение вращающегося стержня',
  params: [
    par('P', 'вес стержня P', 20, 'Н'),
    par('l', 'длина стержня l', 1, 'м'),
    par('a', 'сечение на расстоянии a от оси', 0.4, 'м', { zero: true }),
    par('w', 'угловая скорость ω', 10, 'рад/с'),
  ],
  solve(vv) {
    return fin(this, vv, ({ P, l, a, w }) => {
      const F = (P * (l * l - a * a) * w * w) / (2 * G * l);
      const steps: Step[] = [
        {
          title: 'Силы инерции',
          lines: [
            [
              'часть стержня за сечением (от a до l): масса m₁ = P(l − a)/(g·l), центр масс на расстоянии (l + a)/2 от оси',
              'равнодействующая центробежных сил инерции этой части уравновешивается силой в сечении: F = m₁·ω²·(l + a)/2',
            ],
            [`F = ${s4(P)}·(${s4(l)}² − ${s4(a)}²)·${s4(w)}²/(2·${s4(G)}·${s4(l)}) = ${s4(F)} Н`],
          ],
        },
      ];
      const g = [
        line([100, 150], [660, 150], 'mc-body'),
        line([100, 120], [100, 180]),
        line([100 + (a / l) * 560, 130], [100 + (a / l) * 560, 170], 'mc-axis'),
        inert([660, 150], [700, 150]),
        fl([706, 146], 'Φ'),
        react([100 + (a / l) * 560, 150], [100 + (a / l) * 560 - 50, 150]),
        fl([100 + (a / l) * 560 - 56, 140], 'F', 'end'),
      ];
      return { steps, rows: [{ key: 'F', label: ['F'], val: F, unit: 'Н' }], fig: svgOf(W, H, g) };
    });
  },
};
const plate: Machine = {
  id: 'plate',
  name: 'Разрыв вращающейся пластины',
  params: [par('P', 'вес пластины P', 20, 'Н'), par('a', 'расстояние a (пластина 2a × a)', 0.4, 'м'), par('w', 'угловая скорость ω', 10, 'рад/с')],
  solve(vv) {
    return fin(this, vv, ({ P, a, w }) => {
      const F = (P * a * w * w) / (4 * G);
      const steps: Step[] = [
        {
          title: 'Силы инерции',
          lines: [
            [
              'половина пластины по одну сторону оси: масса m₁ = P/(2g), центр масс на расстоянии a/2 от оси',
              'сила, разрывающая пластину по сечению через ось: F = m₁·ω²·a/2',
            ],
            [`F = ${s4(P)}·${s4(a)}·${s4(w)}²/(4·${s4(G)}) = ${s4(F)} Н`],
          ],
        },
      ];
      const g = [
        rect(220, 70, 320, 160),
        line([380, 40], [380, 260], 'mc-axis'),
        inert([460, 150], [520, 150]),
        fl([526, 146], 'Φ'),
        fl([380, 62], 'ω', 'middle'),
      ];
      return { steps, rows: [{ key: 'F', label: ['F'], val: F, unit: 'Н' }], fig: svgOf(W, H, g) };
    });
  },
};
const disk: Machine = {
  id: 'disk',
  name: 'Разрыв вращающегося диска по диаметру',
  params: [par('P', 'вес диска P', 20, 'Н'), par('R', 'радиус R', 0.3, 'м'), par('w', 'угловая скорость ω', 10, 'рад/с')],
  solve(vv) {
    return fin(this, vv, ({ P, R, w }) => {
      const F = (2 * P * R * w * w) / (3 * PI * G);
      const steps: Step[] = [
        {
          title: 'Силы инерции',
          lines: [
            ['половина диска: масса m₁ = P/(2g), центр масс на расстоянии 4R/(3π) от оси вращения', 'F = m₁·ω²·4R/(3π) = 2P·R·ω²/(3π·g)'],
            [`F = 2·${s4(P)}·${s4(R)}·${s4(w)}²/(3π·${s4(G)}) = ${s4(F)} Н`],
          ],
        },
      ];
      const g = [circle([380, 150], 100), line([380, 30], [380, 270], 'mc-axis'), inert([440, 150], [510, 150]), fl([516, 146], 'Φ'), fl([392, 50], 'ω')];
      return { steps, rows: [{ key: 'F', label: ['F'], val: F, unit: 'Н' }], fig: svgOf(W, H, g) };
    });
  },
};

export const KINETO_MACHINES: Machine[] = [stick, tender, accel, prism, crank, crane, ferry, hoistDyn, wedgeDyn, stabilizer, rod, plate, disk];

const pr = (
  title: string,
  machine: string,
  vals: Vals | undefined,
  book: Record<string, number> | undefined,
  o: Partial<MachinePreset> = {},
): MachinePreset => ({ title, machine, vals, book, ...o });
const sn = (a: number) => Math.sin(rad(a));
const cs = (a: number) => Math.cos(rad(a));
const T0 = { G: 20, l: 0.5, H: 0.4, v: 2, phi: 45 };
const gm = T0.G / G;
const Cr = { Q: 100, r: 0.05, l: 0.25, w: 100 };

export const KINETO_PRESETS: Record<string, MachinePreset> = {
  m4156: pr(
    'Мещерский 41.5–41.6: стержень на упоре и угле',
    'stick',
    T0,
    {
      Jx: 3 * gm * (T0.v ** 2 / T0.H ** 2) * T0.l * sn(45) ** 4 * cs(45),
      Jy: gm * (T0.v ** 2 / T0.H ** 2) * T0.l * (1 - 3 * cs(45) ** 2) * sn(45) ** 3,
      Mc: -(2 / 3) * gm * T0.l ** 2 * (T0.v ** 2 / T0.H ** 2) * sn(45) ** 3 * cs(45),
      Nd: (8 / 3) * ((T0.v ** 2 * T0.l ** 2) / (T0.H ** 3 * G)) * T0.G * sn(45) ** 4 * cs(45),
    },
    { note: 'В книге ответы в буквах; числа G = 20 Н, l = 0,5 м, H = 0,4 м, v = 2 м/с, φ = 45° заданы приложением. Для других φ — шаг «Зависимость от угла».' },
  ),
  m418: pr(
    'Мещерский 41.8: жидкость в тендере паровоза',
    'tender',
    undefined,
    { tg: 0.102 },
    { relTol: 0.005, note: 'Книга: плоскость под углом α = arctg 0,102 = 5°50′ к горизонту.' },
  ),
  m419: pr('Мещерский 41.9: жидкостный акселерометр троллейбуса', 'accel', undefined, { w: 0.5 * G }),
  m4110: pr(
    'Мещерский 41.10: груз на боковой грани призмы',
    'prism',
    { alpha: 30, Q: 10 },
    { w: G * Math.tan(rad(30)) },
    { note: 'Угол α в книге — буквой; взят 30°.' },
  ),
  m4111: pr(
    'Мещерский 41.11: испытание бруска на усталость',
    'crank',
    Cr,
    { Smax: Cr.Q + (Cr.Q / G) * Cr.r * Cr.w ** 2 * (1 + Cr.r / Cr.l), Smin: Cr.Q + (Cr.Q / G) * Cr.r * Cr.w ** 2 * (Cr.r / Cr.l - 1) },
    {
      note: 'Ответ книги S = Q + (Q/g)·rω²(cos ωt + (r/l)·cos 2ωt) — в буквах, проверен в точках ωt = 0 и π; числа заданы приложением. «Точное» значение — без разложения корня в ряд.',
    },
  ),
  m4112: pr('Мещерский 41.12: поворотный кран, подъём груза с ускорением g/3', 'crane', undefined, { XA: 5.3, XB: -5.3, YA: 6.5 }),
  m4113: pr('Мещерский 41.13: поворотный кран, тележка движется с ускорением 0,5g', 'crane', { Q: 0, kv: 0, kt: 0.5 }, { XA: 1.3, XB: -1.55, YA: 2.5 }),
  m4114: pr('Мещерский 41.14: грузовик тормозит на пароме', 'ferry', undefined, { T: 0.66 }, { relTol: 0.01 }),
  m4116: pr(
    'Мещерский 41.16: полиспаст, ускорение груза P',
    'hoistdyn',
    undefined,
    { w: (4 * G * (4 * 3 - 10)) / (16 * 3 + 10), ratio: 0.25 },
    { note: 'Книга: w = 4g(4P − Q)/(16P + Q); равномерное движение при P/Q = 1/4. Веса P = 3 кГ, Q = 10 кГ заданы приложением.' },
  ),
  m4117: pr(
    'Мещерский 41.17: клин между двумя пластинами',
    'wedgedyn',
    undefined,
    { w: (G * 10) / (10 + 2 * 5 * Math.tan(rad(20)) ** 2), w1: ((G * 10) / (10 + 2 * 5 * Math.tan(rad(20)) ** 2)) * Math.tan(rad(20)) },
    { note: 'Ответ книги в буквах; P = 10, P₁ = 5 кГ, α = 20° заданы приложением.' },
  ),
  m4120: pr(
    'Мещерский 41.20: стабилизатор качки, маховик с эксцентриситетом',
    'stabilizer',
    undefined,
    { N: 109.7 },
    { relTol: 0.005, note: 'Расчёт при g = 9,81 м/с² даёт 109,96 т, книга — 109,7 т (расхождение 0,2 %, округление).' },
  ),
  m4121: pr(
    'Мещерский 41.21: растягивающая сила во вращающемся стержне',
    'rod',
    undefined,
    { F: (20 * (1 - 0.16) * 100) / (2 * G) },
    { note: 'Числа заданы приложением: F = P(l² − a²)ω²/(2gl).' },
  ),
  m4122: pr(
    'Мещерский 41.22: разрыв вращающейся пластины',
    'plate',
    undefined,
    { F: (20 * 0.4 * 100) / (4 * G) },
    { note: 'Числа заданы приложением: F = Paω²/(4g).' },
  ),
  m4123: pr(
    'Мещерский 41.23: разрыв вращающегося диска',
    'disk',
    undefined,
    { F: (2 * 20 * 0.3 * 100) / (3 * PI * G) },
    { note: 'Числа заданы приложением: F = 2PRω²/(3πg).' },
  ),
};

export const KINETO_CATALOG: Catalog = {
  moduleId: 'dalembert',
  modeName: 'Силы инерции в машинах',
  title: 'Принцип Даламбера: силы инерции в машинах',
  lede: 'Метод кинетостатики (Мещерский, §41): добавляем силы инерции к заданным силам и решаем задачу как задачу статики — давления на угол, опорные реакции крана, натяжения канатов, поверхность жидкости, силы в вращающихся телах.',
  machines: KINETO_MACHINES,
  presets: KINETO_PRESETS,
  start: 'm4156',
};
