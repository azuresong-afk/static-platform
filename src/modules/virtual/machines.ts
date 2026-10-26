/**
 * Режим «Машины» вкладки «Возможные перемещения» (Мещерский §46): домкраты, прессы, рычажные системы, полиспасты,
 * тормоза, механизмы с кривошипом — равновесие машины с одной степенью свободы принципом возможных перемещений.
 *
 * Для каждой машины даём малое перемещение входного звена (поворот рукоятки δφ, ход δs груза) и находим перемещение
 * точки приложения искомой силы из геометрии; принцип: Σ δA = 0, идеальные связи работы не совершают. Положения
 * (угол α, φ) входят в передаточное отношение через производную координаты по обобщённой координате.
 */
import { sig } from '../relative/text/earth';
import type { Catalog, Fig, Machine, MachinePreset, Param, Row, Solved, Step, Vals } from '../../shared/machines/types';
import { VIRTUAL_MACHINES_29, VIRTUAL_MACHINE_PRESETS_29 } from './machines29';
import { arrow, circle, ground, line, pin, poly, rect, svgOf, text, turn, type P } from '../../shared/machines/sketch';

const PI = Math.PI;
const rad = (a: number) => (a * PI) / 180;
const s4 = (x: number) => sig(x, 4);
const par = (k: string, label: string, def: number, unit?: string, o: Partial<Param> = {}): Param => ({ k, label, def, unit, ...o });

/** Проверка: все числа положительные (кроме разрешённых). */
function bad(m: Machine, v: Vals): string[] {
  return m.params.filter((p) => !p.zero && !p.neg && !(v[p.k] > 0)).map((p) => `«${p.label}» должно быть больше нуля.`);
}
const fin = (m: Machine, v: Vals, build: (v: Vals) => { steps: Step[]; rows: Row[]; fig: Fig }, extra: string[] = []): Solved => {
  const e = [...bad(m, v), ...extra];
  return e.length ? { ok: false, errors: e } : { ok: true, ...build(v) };
};
const W = 760,
  H = 300;
const fl = (p: P, s: string, a: 'start' | 'middle' | 'end' = 'start') => text(p, s, a, 'mc-t');

/** Брусок на наклонной плоскости: основание грани в точке base, угол ang к горизонту, dir = 1 — грань поднимается вправо, −1 — влево; t — положение вдоль грани, a — сторона бруска. */
function onSlope(base: P, ang: number, dir: 1 | -1, t: number, a: number): P[] {
  const u: P = [dir * Math.cos(ang), -Math.sin(ang)];
  const n: P = [-dir * Math.sin(ang), -Math.cos(ang)];
  const o: P = [base[0] + u[0] * t, base[1] + u[1] * t];
  return [o, [o[0] + u[0] * a, o[1] + u[1] * a], [o[0] + u[0] * a + n[0] * a, o[1] + u[1] * a + n[1] * a], [o[0] + n[0] * a, o[1] + n[1] * a]];
}

/* ---------- 46.1 винтовой домкрат ---------- */
const screw: Machine = {
  id: 'screw',
  name: 'Винтовой домкрат',
  params: [par('P', 'сила на рукоятке P', 16, 'кГ'), par('a', 'длина рукоятки OA', 0.6, 'м'), par('h', 'шаг винта h', 12, 'мм')],
  solve(v) {
    return fin(this, v, ({ P, a, h }) => {
      const hm = h / 1000;
      const Q = (2 * PI * P * a) / hm;
      const steps: Step[] = [
        {
          title: 'Возможное перемещение',
          lines: [['рукоятка поворачивается на δφ; конец рукоятки проходит a·δφ, груз поднимается на δs = h·δφ/(2π)']],
          note: 'За один оборот винт поднимается на шаг h, поэтому подъём пропорционален углу поворота.',
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [
            ['P·a·δφ − Q·δs = 0', 'P·a·δφ = Q·h·δφ/(2π)'],
            ['Q = 2π·P·a/h', `Q = 2π·${s4(P)}·${s4(a)}/${s4(hm)} = ${s4(Q)} кГ`],
          ],
        },
      ];
      const g: string[] = [
        rect(250, 232, 260, 16),
        rect(330, 120, 100, 112),
        line([380, 232], [380, 300]),
        rect(340, 100, 80, 20),
        line([380, 100], [380, 70]),
        fl([405, 74], 'Q'),
        arrow([380, 52], [380, 30]),
        ground(250, 510, 248),
        line([430, 190], [600, 190], 'mc-body'),
        pin([430, 190]),
        fl([436, 180], 'O'),
        fl([600, 180], 'A', 'end'),
        arrow([600, 160], [600, 230]),
        fl([616, 220], 'P'),
      ];
      return { steps, rows: [{ key: 'Q', label: ['Q'], val: Q, unit: 'кГ', digits: 4 }], fig: svgOf(W, H, g) };
    });
  },
};

/* ---------- 46.2 коленчатый пресс ---------- */
const rhombus: Machine = {
  id: 'rhombus',
  name: 'Коленчатый пресс (ромб)',
  params: [
    par('M', 'момент на маховичке M', 100, 'Н·м'),
    par('h', 'шаг нарезки h', 4, 'мм'),
    par('alpha', 'угол α (половина угла при вершине)', 30, '°'),
    par('a', 'сторона ромба a', 0.2, 'м'),
  ],
  solve(v) {
    return fin(this, v, ({ M, h, alpha, a }) => {
      const hm = h / 1000,
        al = rad(alpha);
      // Положение: горизонтальная диагональ u = 2a·sin α, вертикальная y = 2a·cos α. Производная — центральной разностью.
      const dd = (f: (t: number) => number, t: number) => (f(t + 1e-6) - f(t - 1e-6)) / 2e-6;
      const dy = dd((t) => 2 * a * Math.cos(t), al),
        du = dd((t) => 2 * a * Math.sin(t), al);
      const dyPerPhi = Math.abs(dy / du) * ((2 * hm) / (2 * PI));
      const P = M / dyPerPhi;
      const steps: Step[] = [
        {
          title: 'Возможное перемещение',
          lines: [
            [
              'маховичок поворачивается на δφ; обе гайки на нарезках противоположного направления сближаются: δu = −2h·δφ/(2π)',
              'горизонтальная диагональ ромба u = 2a·sin α, вертикальная y = 2a·cos α',
            ],
            ['δu = 2a·cos α·δα,  δy = −2a·sin α·δα  ⇒  δy = −tg α·δu', `δy = h·tg α·δφ/π`],
          ],
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [['M·δφ − P·|δy| = 0  ⇒  P = M·δφ/|δy| = π·M·ctg α/h'], [`P = π·${s4(M)}·ctg ${s4(alpha)}°/${s4(hm)} = ${s4(P)} Н`]],
          note: 'Давление пресса на предмет направлено против перемещения нижней вершины ромба.',
        },
      ];
      const c: P = [380, 150],
        k = 70;
      const ax = k * Math.sin(al),
        ay = k * Math.cos(al);
      const g = [
        line([c[0] - ax, c[1]], [c[0], c[1] - ay]),
        line([c[0], c[1] - ay], [c[0] + ax, c[1]]),
        line([c[0] + ax, c[1]], [c[0], c[1] + ay]),
        line([c[0], c[1] + ay], [c[0] - ax, c[1]]),
        pin([c[0] - ax, c[1]]),
        pin([c[0] + ax, c[1]]),
        pin([c[0], c[1] - ay]),
        pin([c[0], c[1] + ay]),
        line([c[0] - ax - 40, c[1]], [c[0] + ax + 40, c[1]], 'mc-axis'),
        rect(c[0] - 80, c[1] + ay + 4, 160, 12),
        ground(c[0] - 100, c[0] + 100, c[1] + ay + 40),
        rect(c[0] - 60, c[1] + ay + 16, 120, 20),
        fl([c[0] + 70, c[1] + ay + 30], 'предмет'),
        arrow([c[0] + 120, c[1] + ay + 60], [c[0] + 120, c[1] + ay + 8]),
        fl([c[0] + 130, c[1] + ay + 50], 'P'),
        turn([c[0] - ax - 40, c[1]], 18, 30, 300),
        fl([c[0] - ax - 90, c[1] - 20], 'M'),
        line([c[0] - 40, c[1] - ay - 18], [c[0] + 40, c[1] - ay - 18], 'mc-ground'),
      ];
      return { steps, rows: [{ key: 'P', label: ['P'], val: P, unit: 'Н' }], fig: svgOf(W, H, g) };
    });
  },
};

/* ---------- 46.3 клиновой пресс ---------- */
const wedge: Machine = {
  id: 'wedge',
  name: 'Клиновой пресс',
  params: [
    par('P', 'сила на рукоятке P', 100, 'Н'),
    par('a', 'длина рукоятки a', 0.4, 'м'),
    par('h', 'ход винта h', 10, 'мм'),
    par('alpha', 'угол клина α', 10, '°'),
  ],
  solve(v) {
    return fin(this, v, ({ P, a, h, alpha }) => {
      const hm = h / 1000,
        al = rad(alpha);
      const Q = (2 * PI * a * P) / (hm * Math.tan(al));
      const steps: Step[] = [
        {
          title: 'Возможное перемещение',
          lines: [['рукоятка поворачивается на δφ; винт сдвигает клин вдоль своей оси на δx = h·δφ/(2π)', 'клин поднимает ползун на δy = δx·tg α']],
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [['P·a·δφ − Q·δy = 0  ⇒  Q = P·a·δφ/(δx·tg α) = 2π·a·P/(h·tg α)'], [`Q = 2π·${s4(a)}·${s4(P)}/(${s4(hm)}·tg ${s4(alpha)}°) = ${s4(Q)} Н`]],
        },
      ];
      const g = [
        poly([
          [300, 200],
          [520, 200],
          [520, 200 - 220 * Math.tan(al)],
        ]),
        rect(250, 190, 50, 10),
        line([200, 195], [250, 195]),
        rect(200, 180, 10, 30),
        line([120, 195], [200, 195], 'mc-axis'),
        line([160, 160], [160, 230]),
        arrow([160, 230], [160, 250]),
        fl([170, 248], 'P'),
        rect(520, 130, 60, 40),
        arrow([550, 120], [550, 80]),
        ground(240, 560, 210),
        fl([560, 76], 'Q'),
        fl([420, 188], 'α'),
        line([420, 120], [420, 200], 'mc-axis'),
      ];
      return { steps, rows: [{ key: 'Q', label: ['Q'], val: Q, unit: 'Н' }], fig: svgOf(W, H, g) };
    });
  },
};

/* ---------- 46.4 машина для испытания на растяжение ---------- */
const testm: Machine = {
  id: 'testm',
  name: 'Машина для испытания на растяжение',
  params: [
    par('P', 'груз P', 50, 'Н'),
    par('x', 'смещение груза x от нуля', 0.1, 'м'),
    par('l1', 'l₁', 0.3, 'м'),
    par('l2', 'l₂', 0.05, 'м'),
    par('e', 'плечо e', 0.02, 'м'),
  ],
  solve(v) {
    return fin(this, v, ({ P, x, l1, l2, e }) => {
      const X = (P * x * l1) / (e * l2);
      const steps: Step[] = [
        {
          title: 'Возможное перемещение',
          lines: [
            [
              'нижний рычаг поворачивается на δφ₁ вокруг опоры O: груз P смещается на x·δφ₁ по вертикали, тяга — на l₂·δφ₁',
              'верхний рычаг: l₁·δφ₂ = l₂·δφ₁, образец K растягивается на e·δφ₂ = e·l₂·δφ₁/l₁',
            ],
          ],
          note: 'Расстояния — по схеме книги: l₂ от опоры нижнего рычага до тяги, l₁ от тяги до опоры верхнего, e от опоры верхнего рычага до образца.',
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [['P·x·δφ₁ − X·e·l₂·δφ₁/l₁ = 0  ⇒  X = P·x·l₁/(e·l₂)'], [`X = ${s4(P)}·${s4(x)}·${s4(l1)}/(${s4(e)}·${s4(l2)}) = ${s4(X)} Н`]],
        },
      ];
      const k = Math.min(500, 360 / Math.max(x, l1, 0.05));
      const O: P = [380, 190];
      const xP = O[0] - x * k,
        xj = O[0] - l2 * k;
      const g = [
        line([Math.min(xP, xj) - 40, 190], [O[0] + 20, 190]),
        poly([
          [O[0], 190],
          [O[0] - 10, 208],
          [O[0] + 10, 208],
        ]),
        fl([O[0] + 4, 226], 'O', 'middle'),
        line([xP, 190], [xP, 230], 'mc-thread'),
        rect(xP - 16, 230, 32, 22),
        fl([xP, 246], 'P', 'middle'),
        pin([xj, 190]),
        line([xj, 190], [xj, 110], 'mc-thread'),
        line([xj - 40, 110], [xj + l1 * k + e * k + 40, 110]),
        pin([xj, 110]),
        poly([
          [xj + l1 * k, 110],
          [xj + l1 * k - 10, 128],
          [xj + l1 * k + 10, 128],
        ]),
        line([xj + l1 * k + e * k, 110], [xj + l1 * k + e * k, 150], 'mc-thread'),
        rect(xj + l1 * k + e * k - 10, 150, 20, 40),
        fl([xj + l1 * k + e * k + 16, 175], 'K'),
        fl([xj + (l1 * k) / 2, 100], 'l₁', 'middle'),
        fl([(xj + O[0]) / 2, 180], 'l₂', 'middle'),
        fl([(xP + O[0]) / 2, 212], 'x', 'middle'),
      ];
      return { steps, rows: [{ key: 'X', label: ['X'], val: X, unit: 'Н' }], fig: svgOf(W, H, g) };
    });
  },
};

/* ---------- 46.5 система рычагов ---------- */
const levers: Machine = {
  id: 'levers',
  name: 'Система рычагов (грузы K и L)',
  params: [
    par('BC', 'BC', 1, 'см'),
    par('AC', 'AC', 10, 'см'),
    par('ON', 'ON', 1, 'см'),
    par('OM', 'OM', 3, 'см'),
    par('DE', 'DE', 1, 'см'),
    par('DF', 'DF', 10, 'см'),
    par('PK', 'вес груза K', 300, 'кГ'),
  ],
  solve(v) {
    return fin(this, v, ({ BC, AC, ON, OM, DE, DF, PK }) => {
      const PL = (BC / AC) * (ON / OM) * (DE / DF) * PK;
      const steps: Step[] = [
        {
          title: 'Возможные перемещения',
          lines: [
            [
              'каждый рычаг передаёт перемещение в отношении плеч: δ_{выход}/δ_{вход} = плечо выхода/плечо входа',
              'перемещение груза K равно δ_K, груза L — δ_L = δ_K·(AC/BC)·(OM/ON)·(DF/DE)',
            ],
          ],
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [
            ['P_K·δ_K − P_L·δ_L = 0  ⇒  P_L = (BC/AC)·(ON/OM)·(DE/DF)·P_K'],
            [`P_L = ${s4(BC / AC)}·${s4(ON / OM)}·${s4(DE / DF)}·${s4(PK)} = ${s4(PL)} кГ`],
          ],
          note: 'Отношения плеч — по схеме книги: BC/AC, ON/OM, DE/DF.',
        },
      ];
      // Условная схема: три рычага, каждый передаёт перемещение в отношении плеч (рычаги второго рода условно горизонтальны).
      const lever = (y: number, xf: number, arm1: number, arm2: number, tag: string): string[] => [
        line([xf - arm1, y], [xf + arm2, y]),
        poly([
          [xf, y],
          [xf - 10, y + 18],
          [xf + 10, y + 18],
        ]),
        fl([xf, y + 34], tag, 'middle'),
      ];
      const g = [
        ...lever(210, 300, 120, 40, 'BC : AC'),
        ...lever(140, 440, 80, 120, 'ON : OM'),
        ...lever(70, 560, 90, 80, 'DE : DF'),
        line([340, 210], [340, 140], 'mc-thread'),
        line([560, 140], [560, 70], 'mc-thread'),
        line([180, 210], [180, 250], 'mc-thread'),
        rect(150, 250, 60, 30),
        fl([180, 270], 'K', 'middle'),
        line([650, 70], [650, 110], 'mc-thread'),
        rect(630, 110, 40, 26),
        fl([650, 128], 'L', 'middle'),
        fl([20, 290], 'условная схема: плечи — по отношениям из условия', 'start'),
      ];
      return { steps, rows: [{ key: 'PL', label: ['P', { t: 'sub', text: 'L' }], val: PL, unit: 'кГ' }], fig: svgOf(W, H, g) };
    });
  },
};

/* ---------- 46.6 рычажный пресс ---------- */
const press: Machine = {
  id: 'press',
  name: 'Рычажный пресс',
  params: [par('F', 'сила F', 100, 'Н'), par('a', 'a', 60, 'см'), par('b', 'b', 10, 'см'), par('c', 'c', 60, 'см'), par('d', 'd', 20, 'см')],
  solve(v) {
    return fin(this, v, ({ F, a, b, c, d }) => {
      const Q = (F * a * c) / (b * d);
      const steps: Step[] = [
        {
          title: 'Возможные перемещения',
          lines: [
            ['перемещение точки приложения F относится к перемещению шарнира первого рычага как a : b, а второго рычага — как c : d', 'δ_Q = δ_F·(b/a)·(d/c)'],
          ],
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [['F·δ_F − Q·δ_Q = 0  ⇒  Q = F·(a/b)·(c/d)'], [`Q = ${s4(F)}·${s4(a / b)}·${s4(c / d)} = ${s4(Q)} Н`]],
        },
      ];
      const k = Math.min(3.2, 330 / Math.max(a, c));
      const p1x = 470;
      const xF = p1x - a * k,
        xL = p1x - b * k;
      const p2x = xL - c * k,
        xS = p2x + d * k;
      const g = [
        line([xF, 110], [p1x, 110]),
        poly([
          [p1x, 110],
          [p1x - 10, 128],
          [p1x + 10, 128],
        ]),
        line([xL, 110], [xL, 190], 'mc-thread'),
        line([p2x, 190], [xL, 190]),
        poly([
          [p2x, 190],
          [p2x - 10, 208],
          [p2x + 10, 208],
        ]),
        rect(xS - 20, 198, 40, 22),
        fl([xS, 214], 'A', 'middle'),
        ground(p2x - 40, p1x + 40, 232),
        arrow([xF, 70], [xF, 108]),
        fl([xF + 10, 76], 'F'),
        arrow([xS, 176], [xS, 196]),
        fl([xS + 24, 190], 'Q'),
      ];
      return { steps, rows: [{ key: 'Q', label: ['Q'], val: Q, unit: 'Н' }], fig: svgOf(W, H, g) };
    });
  },
};

/* ---------- 46.7 десятичные весы ---------- */
const scale: Machine = {
  id: 'scale',
  name: 'Весы (условие независимости от положения груза)',
  params: [
    par('a', 'a', 0.5, 'м'),
    par('b', 'b', 0.1, 'м'),
    par('c', 'c', 0.3, 'м'),
    par('d', 'd', 0.1, 'м'),
    par('l', 'l', 0.4, 'м'),
    par('P', 'вес груза P', 50, 'Н'),
  ],
  solve(v) {
    return fin(this, v, ({ a, b, c, d, l, P }) => {
      const p = (b / a) * P;
      const miss = (b + c) / b - l / d;
      const steps: Step[] = [
        {
          title: 'Возможное перемещение',
          lines: [
            [
              'коромысло с плечами a и b поворачивается на δφ: гиря опускается на a·δφ, платформа (параллелограмм рычагов) поднимается на b·δφ',
              'платформа движется поступательно, поэтому перемещение груза не зависит от места F на ней — если рычаги подобраны так, что (b + c)/b = l/d',
            ],
          ],
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [
            ['p·a·δφ − P·b·δφ = 0  ⇒  p = (b/a)·P'],
            [`p = ${s4(b)}/${s4(a)}·${s4(P)} = ${s4(p)} Н`],
            [`(b + c)/b = ${s4((b + c) / b)},  l/d = ${s4(l / d)}`],
          ],
        },
      ];
      const k = 300 / (a + b + c);
      const xA = 80,
        xB = xA + a * k,
        xC = xB + b * k,
        xD = xC + c * k;
      const g = [
        line([xA, 80], [xD, 80]),
        poly([
          [xB, 80],
          [xB - 10, 98],
          [xB + 10, 98],
        ]),
        pin([xA, 80]),
        pin([xC, 80]),
        pin([xD, 80]),
        fl([xA, 66], 'A', 'middle'),
        fl([xB, 66], 'B', 'middle'),
        fl([xC, 66], 'C', 'middle'),
        fl([xD, 66], 'D', 'middle'),
        line([xA, 80], [xA, 130], 'mc-thread'),
        rect(xA - 16, 130, 32, 24),
        fl([xA, 148], 'p', 'middle'),
        line([xC, 80], [xC, 190], 'mc-thread'),
        line([xD, 80], [xD, 150], 'mc-thread'),
        line([xC - 40, 190], [xD + 160, 190]),
        circle([(xC + xD) / 2 + 60, 172], 18),
        fl([(xC + xD) / 2 + 60, 177], 'P', 'middle'),
        ground(xB - 40, xD + 180, 240),
        fl([(xA + xB) / 2, 108], 'a', 'middle'),
        fl([(xB + xC) / 2, 108], 'b', 'middle'),
        fl([(xC + xD) / 2, 108], 'c', 'middle'),
      ];
      return {
        steps,
        rows: [
          { key: 'p', label: ['p'], val: p, unit: 'Н' },
          { key: 'miss', label: ['(b + c)/b − l/d'], val: miss, unit: '', aux: true },
        ],
        fig: svgOf(W, H, g),
      };
    });
  },
};

/* ---------- 46.8 эллипсограф ---------- */
const ellipse: Machine = {
  id: 'ellipse',
  name: 'Эллипсограф (кривошип и ползуны)',
  params: [par('P', 'сила на ползуне A', 50, 'Н'), par('l', 'длина OC = AC = CB', 0.2, 'м'), par('phi', 'угол φ', 40, '°')],
  solve(v) {
    return fin(this, v, ({ P, l, phi }) => {
      const f = rad(phi);
      const yA = (t: number) => 2 * l * Math.sin(t);
      const dyA = (yA(f + 1e-6) - yA(f - 1e-6)) / 2e-6;
      const M = P * dyA;
      const steps: Step[] = [
        {
          title: 'Возможное перемещение',
          lines: [['ползун A движется по оси y: y_A = 2l·sin φ', 'δy_A = 2l·cos φ·δφ']],
          note: 'Точки O, C, A и C, B — вершины равнобедренных треугольников: OC = AC = CB = l, поэтому y_A = 2l·sin φ.',
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [['M·δφ − P·δy_A = 0  ⇒  M = P·2l·cos φ'], [`M = 2·${s4(P)}·${s4(l)}·cos ${s4(phi)}° = ${s4(M)} Н·м`]],
        },
      ];
      const O: P = [200, 250],
        k = 160;
      const C: P = [O[0] + (k * Math.cos(f)) / 2, O[1] - (k * Math.sin(f)) / 2];
      const A: P = [O[0], O[1] - k * Math.sin(f)];
      const B: P = [O[0] + k * Math.cos(f), O[1]];
      const g = [
        line([O[0], O[1] - 200], [O[0], O[1]], 'mc-ground'),
        line([O[0], O[1]], [O[0] + 300, O[1]], 'mc-ground'),
        line(A, B),
        line(O, C),
        pin(O),
        pin(C),
        pin(A),
        pin(B),
        fl([O[0] - 14, O[1] + 4], 'O', 'end'),
        fl([A[0] - 14, A[1]], 'A', 'end'),
        fl([B[0] + 6, B[1] + 18], 'B'),
        fl([C[0] + 8, C[1] - 6], 'C'),
        arrow([A[0], A[1] - 50], [A[0], A[1] - 4]),
        fl([A[0] + 10, A[1] - 40], 'P'),
        turn(O, 36, 0, f * 57.3 + 0.01),
        fl([O[0] + 46, O[1] - 12], 'φ'),
      ];
      return { steps, rows: [{ key: 'M', label: ['M'], val: M, unit: 'Н·м' }], fig: svgOf(W, H, g) };
    });
  },
};

/* ---------- 46.9 полиспаст ---------- */
const hoist: Machine = {
  id: 'hoist',
  name: 'Полиспаст',
  params: [par('n', 'подвижных блоков n', 3, ''), par('P', 'усилие на канате P', 25, 'кГ')],
  solve(v) {
    const n = v.n;
    return fin(
      this,
      v,
      ({ P }) => {
        const k = 2 ** n;
        const Q = k * P;
        const steps: Step[] = [
          {
            title: 'Возможное перемещение',
            lines: [
              [
                'каждый подвижный блок поднимается вдвое медленнее, чем движется охватывающая его ветвь каната; груз Q поднимается на δs, конец каната на δs·2ⁿ',
              ],
            ],
          },
          {
            title: 'Принцип возможных перемещений',
            lines: [['Q·δs − P·2ⁿ·δs = 0  ⇒  Q/P = 2ⁿ'], [`Q/P = 2^${n} = ${k};  Q = ${s4(k)}·${s4(P)} = ${s4(Q)} кГ`]],
          },
        ];
        const g: string[] = [line([200, 40], [560, 40], 'mc-ground')];
        let y = 40;
        for (let i = 0; i <= n; i++) {
          g.push(circle([300 + (i % 2) * 40, y + 32], 22));
          y += 56;
        }
        g.push(arrow([240, 140], [240, 190]), fl([252, 176], 'P'), rect(310, y + 4, 60, 26), fl([340, y + 22], 'Q', 'middle'));
        return {
          steps,
          rows: [
            { key: 'ratio', label: ['Q/P'], val: k, unit: '' },
            { key: 'Q', label: ['Q'], val: Q, unit: 'кГ', aux: true },
          ],
          fig: svgOf(W, Math.max(H, y + 60), g),
        };
      },
      Number.isInteger(n) && n >= 0 && n <= 8 ? [] : ['Число подвижных блоков — целое от 0 до 8.'],
    );
  },
};

/* ---------- 46.10 кулисный механизм ---------- */
const coulisse: Machine = {
  id: 'coulisse',
  name: 'Кулисный механизм',
  params: [
    par('P', 'сила P на стержне AB', 100, 'Н'),
    par('R', 'длина OC = R', 0.5, 'м'),
    par('l', 'расстояние OK = l', 0.3, 'м'),
    par('phi', 'угол φ рычага к вертикали', 30, '°'),
  ],
  solve(v) {
    return fin(this, v, ({ P, R, l, phi }) => {
      const f = rad(phi);
      const yA = (t: number) => l * Math.tan(t);
      const dy = (yA(f + 1e-6) - yA(f - 1e-6)) / 2e-6;
      const Q = (P * dy) / R;
      const steps: Step[] = [
        {
          title: 'Возможное перемещение',
          lines: [
            [
              'ползун A лежит на рычаге OC, а стержень AB движется в вертикальных направляющих на расстоянии l от оси O: y_A = l·tg φ',
              'δy_A = l·δφ/cos²φ; точка C проходит R·δφ',
            ],
          ],
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [['Q·R·δφ − P·δy_A = 0  ⇒  Q = P·l/(R·cos²φ)'], [`Q = ${s4(P)}·${s4(l)}/(${s4(R)}·cos²${s4(phi)}°) = ${s4(Q)} Н`]],
        },
      ];
      const O: P = [250, 200],
        k = 150;
      const A: P = [O[0] + l * 400 * 1, O[1] - l * 400 * Math.tan(f)];
      const C: P = [O[0] + R * 300 * Math.sin(f) * 1, O[1] - R * 300 * Math.cos(f)];
      const g = [
        pin(O),
        line(O, [O[0] + k * 1.6 * Math.sin(f), O[1] - k * 1.6 * Math.cos(f)]),
        line([A[0], A[1] - 60], [A[0], A[1] + 60], 'mc-ground'),
        pin(A),
        arrow([A[0] + 60, A[1] + 50], [A[0] + 60, A[1] - 30]),
        fl([A[0] + 70, A[1]], 'P'),
        arrow(C, [C[0] + 40 * Math.cos(f), C[1] + 40 * Math.sin(f)]),
        fl([C[0] + 46, C[1] + 14], 'Q'),
        fl([O[0] - 12, O[1] + 18], 'O', 'end'),
        ground(O[0] - 40, O[0] + 40, O[1] + 8),
      ];
      return { steps, rows: [{ key: 'Q', label: ['Q'], val: Q, unit: 'Н' }], fig: svgOf(W, H, g) };
    });
  },
};

/* ---------- 46.11 домкрат с зубчатой передачей ---------- */
const gearjack: Machine = {
  id: 'gearjack',
  name: 'Реечный домкрат (зубчатая передача)',
  params: [
    par('Q', 'давление чашки Q', 480, 'кГ'),
    par('r1', 'r₁', 3, 'см'),
    par('r2', 'r₂', 12, 'см'),
    par('r3', 'r₃', 4, 'см'),
    par('r4', 'r₄', 16, 'см'),
    par('r5', 'r₅', 3, 'см'),
    par('R', 'длина рукоятки R', 18, 'см'),
  ],
  solve(v) {
    return fin(this, v, ({ Q, r1, r2, r3, r4, r5, R }) => {
      const P = (Q * r1 * r3 * r5) / (R * r2 * r4);
      const steps: Step[] = [
        {
          title: 'Возможное перемещение',
          lines: [
            [
              'рукоятка и колесо 1 поворачиваются на δφ; колесо 2 (сцеплено с 1) — на δφ·r₁/r₂; колесо 4 (сцеплено с 3, сидящим на оси колеса 2) — на δφ·(r₁/r₂)·(r₃/r₄)',
              'колесо 5 сидит на оси колеса 4 и сцеплено с рейкой: δs = r₅·δφ·r₁·r₃/(r₂·r₄)',
            ],
          ],
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [
            ['P·R·δφ − Q·δs = 0  ⇒  P = Q·r₁·r₃·r₅/(R·r₂·r₄)'],
            [`P = ${s4(Q)}·${s4(r1)}·${s4(r3)}·${s4(r5)}/(${s4(R)}·${s4(r2)}·${s4(r4)}) = ${s4(P)} кГ`],
          ],
        },
      ];
      const g: string[] = [];
      const radii = [r1, r2, r3, r4, r5];
      const sc = 5;
      const pos: P[] = [
        [150, 200],
        [150 + (r1 + r2) * sc, 200],
        [150 + (r1 + r2) * sc, 200],
        [150 + (r1 + r2) * sc + (r3 + r4) * sc, 200],
        [150 + (r1 + r2) * sc + (r3 + r4) * sc, 200],
      ];
      radii.forEach((r, i) => g.push(circle(pos[i], r * sc), fl([pos[i][0] - 4, pos[i][1] + 4 + (i % 2) * 0], String(i + 1), 'middle')));
      g.push(
        line([pos[4][0] + r5 * sc, 100], [pos[4][0] + r5 * sc, 280]),
        arrow([pos[4][0] + r5 * sc + 20, 120], [pos[4][0] + r5 * sc + 20, 70]),
        fl([pos[4][0] + r5 * sc + 30, 90], 'Q'),
        line([150, 200], [150, 200 + R * 5], 'mc-body'),
        arrow([150, 200 + R * 5], [190, 200 + R * 5]),
        fl([196, 200 + R * 5], 'P'),
      );
      return { steps, rows: [{ key: 'P', label: ['P'], val: P, unit: 'кГ' }], fig: svgOf(W, H, g) };
    });
  },
};

/* ---------- 46.12 дифференциальный ворот ---------- */
const windlass: Machine = {
  id: 'windlass',
  name: 'Дифференциальный ворот',
  params: [
    par('Q', 'вес груза Q', 720, 'кГ'),
    par('r1', 'радиус вала A: r₁', 10, 'см'),
    par('r2', 'радиус вала B: r₂', 12, 'см'),
    par('R', 'длина рукоятки R', 60, 'см'),
  ],
  solve(v) {
    return fin(
      this,
      v,
      ({ Q, r1, r2, R }) => {
        const P = (Q * (r2 - r1)) / (2 * R);
        const steps: Step[] = [
          {
            title: 'Возможное перемещение',
            lines: [
              [
                'при повороте на δφ с вала A сматывается r₁·δφ каната, а на вал B наматывается r₂·δφ: подвижный блок с грузом поднимается на δs = (r₂ − r₁)·δφ/2',
              ],
            ],
          },
          {
            title: 'Принцип возможных перемещений',
            lines: [['P·R·δφ − Q·δs = 0  ⇒  P = Q·(r₂ − r₁)/(2R)'], [`P = ${s4(Q)}·(${s4(r2)} − ${s4(r1)})/(2·${s4(R)}) = ${s4(P)} кГ`]],
          },
        ];
        const g = [
          circle([300, 90], r1 * 3),
          circle([300, 90], r2 * 3),
          line([300, 90], [300 + R * 2, 90]),
          arrow([300 + R * 2, 90], [300 + R * 2, 140]),
          fl([300 + R * 2 + 8, 130], 'P'),
          line([300 - r1 * 3, 90], [300 - r1 * 3, 200]),
          line([300 + r2 * 3, 90], [300 + r2 * 3, 200]),
          circle([300, 215], ((r1 + r2) * 3) / 2 + 2),
          rect(280, 250, 40, 24),
          fl([300, 268], 'Q', 'middle'),
        ];
        return { steps, rows: [{ key: 'P', label: ['P'], val: P, unit: 'кГ' }], fig: svgOf(W, H, g) };
      },
      v.r2 > v.r1 ? [] : ['Радиус r₂ должен быть больше r₁.'],
    );
  },
};

/* ---------- 46.15 тормоз трамвая ---------- */
const brake15: Machine = {
  id: 'brake15',
  name: 'Колодочный тормоз трамвая: давления колодок',
  params: [par('F', 'сила F', 100, 'Н'), par('a', 'a', 0.4, 'м'), par('b', 'b', 0.2, 'м'), par('d', 'd', 0.3, 'м')],
  solve(v) {
    return fin(this, v, ({ F, a, b, d }) => {
      const NK = (F * (a + b)) / b;
      const NL = (F * a * (b + d)) / (b * d);
      const steps: Step[] = [
        {
          title: 'Возможные перемещения',
          lines: [['из кинематики тяг (по схеме книги): δ_F = δ_K·(a + b)/b и δ_F = δ_L·a(b + d)/(b·d)']],
          note: 'Колодки прижимаются к неподвижному колесу, поэтому работа сил трения колеса не совершается; давления N_K и N_L совершают работу на перемещениях колодок.',
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [['F·δ_F − N_K·δ_K = 0  ⇒  N_K = F·(a + b)/b', 'F·δ_F − N_L·δ_L = 0  ⇒  N_L = F·(a/b)·(b + d)/d'], [`N_K = ${s4(NK)} Н,  N_L = ${s4(NL)} Н`]],
        },
      ];
      const g = [
        circle([380, 150], 70),
        line([280, 40], [280, 260]),
        line([480, 40], [480, 260]),
        rect(334, 120, 12, 60),
        rect(414, 120, 12, 60),
        arrow([200, 60], [278, 60]),
        fl([190, 56], 'F', 'end'),
        fl([285, 150], 'K'),
        fl([440, 150], 'L'),
      ];
      return {
        steps,
        rows: [
          { key: 'NK', label: ['N', { t: 'sub', text: 'K' }], val: NK, unit: 'Н' },
          { key: 'NL', label: ['N', { t: 'sub', text: 'L' }], val: NL, unit: 'Н' },
        ],
        fig: svgOf(W, H, g),
      };
    });
  },
};

/* ---------- 46.16 тормоз трамвая: равные давления ---------- */
const brake16: Machine = {
  id: 'brake16',
  name: 'Колодочный тормоз трамвая: равные давления',
  params: [par('F', 'сила F', 100, 'Н'), par('a', 'a', 0.4, 'м'), par('b', 'b', 0.2, 'м'), par('c', 'c', 0.6, 'м')],
  solve(v) {
    return fin(this, v, ({ F, a, b, c }) => {
      const Q = (F * (a + b)) / (2 * b);
      const miss = a / b - (a + b + c) / c;
      const steps: Step[] = [
        {
          title: 'Условие равных давлений',
          lines: [
            ['колодки A и B давят с равными силами, если перемещения колодок одинаковы: a/b = (a + b + c)/c'],
            [`a/b = ${s4(a / b)},  (a + b + c)/c = ${s4((a + b + c) / c)}`],
          ],
          note: miss === 0 ? undefined : 'При данных размерах условие не выполняется — давления колодок различны.',
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [['F·δ_F − 2Q·δ_A = 0, δ_F = δ_A·(a + b)/b  ⇒  Q = F·(a + b)/(2b)'], [`Q = ${s4(F)}·${s4(a + b)}/(2·${s4(b)}) = ${s4(Q)} Н`]],
        },
      ];
      const g = [
        circle([220, 150], 60),
        circle([540, 150], 60),
        rect(300, 120, 14, 60),
        rect(446, 120, 14, 60),
        line([380, 40], [380, 260]),
        arrow([380, 70], [320, 70]),
        fl([310, 66], 'F', 'end'),
        fl([300, 205], 'A'),
        fl([450, 205], 'B'),
      ];
      return {
        steps,
        rows: [
          { key: 'Q', label: ['Q'], val: Q, unit: 'Н' },
          { key: 'miss', label: ['a/b − (a + b + c)/c'], val: miss, unit: '', aux: true },
        ],
        fig: svgOf(W, H, g),
      };
    });
  },
};

/* ---------- 46.17 грузы на наклонных плоскостях ---------- */
const blocks17: Machine = {
  id: 'blocks17',
  name: 'Грузы на двух наклонных плоскостях',
  params: [par('P', 'груз P на подвижном блоке', 100, 'Н'), par('alpha', 'угол α', 30, '°'), par('beta', 'угол β', 45, '°')],
  solve(v) {
    return fin(this, v, ({ P, alpha, beta }) => {
      const a = rad(alpha),
        b = rad(beta);
      const P1 = P / (2 * Math.sin(a)),
        P2 = P / (2 * Math.sin(b));
      const steps: Step[] = [
        {
          title: 'Возможное перемещение',
          lines: [
            [
              'груз P опускается на δy; подвижный блок охвачен тросом с двумя ветвями, поэтому каждый из грузов P₁ и P₂ смещается вдоль плоскости на 2δy',
              'подъём грузов по плоскостям: δh₁ = 2δy·sin α, δh₂ = 2δy·sin β',
            ],
          ],
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [
            ['P·δy − P₁·2δy·sin α = 0  ⇒  P₁ = P/(2 sin α)', 'P·δy − P₂·2δy·sin β = 0  ⇒  P₂ = P/(2 sin β)'],
            [`P₁ = ${s4(P)}/(2 sin ${s4(alpha)}°) = ${s4(P1)} Н,  P₂ = ${s4(P)}/(2 sin ${s4(beta)}°) = ${s4(P2)} Н`],
          ],
          note: 'Работа считается для обоих грузов отдельно: каждый груз связан с блоком своей ветвью, обе ветви натянуты одинаково.',
        },
      ];
      const hL = 160,
        hR = 160;
      const baseL: P = [320 - hL / Math.tan(a), 250],
        baseR: P = [440 + hR / Math.tan(b), 250];
      const O1: P = [320, 250 - hL],
        O2: P = [440, 250 - hR];
      const P1c = onSlope(baseL, a, 1, 0.5 * (hL / Math.sin(a)), 30),
        P2c = onSlope(baseR, b, -1, 0.5 * (hR / Math.sin(b)), 30);
      const mid = (q: P[]): P => [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
      const O: P = [380, 175];
      const g = [
        ground(30, 730, 250),
        poly([baseL, [320, 250], O1]),
        poly([baseR, [440, 250], O2]),
        circle([O1[0] + 2, O1[1] - 10], 10),
        circle([O2[0] - 2, O2[1] - 10], 10),
        poly(P1c),
        poly(P2c),
        line(mid(P1c), [O1[0] + 2, O1[1] - 20], 'mc-thread'),
        line([O1[0] + 12, O1[1] - 10], [O[0] - 18, O[1]], 'mc-thread'),
        line([O2[0] - 12, O2[1] - 10], [O[0] + 18, O[1]], 'mc-thread'),
        line(mid(P2c), [O2[0] - 2, O2[1] - 20], 'mc-thread'),
        circle(O, 18),
        line(O, [380, 215]),
        rect(362, 215, 36, 24),
        fl([380, 233], 'P', 'middle'),
        fl(mid(P1c), 'P₁', 'end'),
        fl([mid(P2c)[0] + 8, mid(P2c)[1]], 'P₂'),
        fl([baseL[0] + 60, 242], 'α'),
        fl([baseR[0] - 60, 242], 'β', 'end'),
      ];
      return {
        steps,
        rows: [
          { key: 'P1', label: ['P', { t: 'sub', text: '1' }], val: P1, unit: 'Н' },
          { key: 'P2', label: ['P', { t: 'sub', text: '2' }], val: P2, unit: 'Н' },
        ],
        fig: svgOf(W, H, g),
      };
    });
  },
};

/* ---------- 46.18 грузы A, B и блок с грузом K ---------- */
const blocks18: Machine = {
  id: 'blocks18',
  name: 'Грузы A, B на нити и подвижный блок с грузом K',
  params: [par('Q', 'вес груза K', 100, 'Н')],
  solve(v) {
    return fin(this, v, ({ Q }) => {
      const P = Q / 2;
      const f = 1;
      const steps: Step[] = [
        {
          title: 'Возможные перемещения',
          lines: [
            [
              'груз K опускается на δy, груз A скользит к блоку C на δ_A, груз B поднимается на δ_B',
              'длина нити постоянна: ветви к блоку D удлиняются на 2δy, поэтому δ_A + δ_B = 2δy',
            ],
          ],
          note: 'δ_A и δ_B независимы: A и B можно сдвигать по отдельности, а δy вычисляется из условия нерастяжимости нити.',
        },
        {
          title: 'Принцип возможных перемещений',
          lines: [
            ['Q·δy − f·P·δ_A − P·δ_B = 0, δy = (δ_A + δ_B)/2', '(Q/2 − f·P)·δ_A + (Q/2 − P)·δ_B = 0 при любых δ_A, δ_B  ⇒  P = Q/2,  f = 1'],
            [`P = ${s4(Q)}/2 = ${s4(P)} Н,  f = ${s4(f)}`],
          ],
        },
      ];
      const C: P = [362, 120],
        D: P = [400, 200],
        E: P = [438, 120];
      const g = [
        ground(80, 330, 104),
        line([330, 104], [330, 104]),
        rect(210, 74, 60, 30),
        fl([240, 96], 'A', 'middle'),
        line([270, 104], [362, 104], 'mc-thread'),
        circle(C, 16),
        circle(E, 16),
        circle(D, 22),
        line([378, 120], [378, 200], 'mc-thread'),
        line([422, 200], [422, 120], 'mc-thread'),
        line([454, 120], [454, 200], 'mc-thread'),
        rect(434, 200, 40, 30),
        fl([454, 222], 'B', 'middle'),
        line(D, [400, 250]),
        rect(378, 250, 44, 26),
        fl([400, 268], 'K', 'middle'),
        fl([362, 90], 'C', 'middle'),
        fl([438, 90], 'E', 'middle'),
        fl([372, 195], 'D', 'end'),
      ];
      return {
        steps,
        rows: [
          { key: 'P', label: ['P'], val: P, unit: 'Н' },
          { key: 'f', label: ['f'], val: f, unit: '' },
        ],
        fig: svgOf(W, H, g),
      };
    });
  },
};

export const VIRTUAL_MACHINES: Machine[] = [
  screw,
  rhombus,
  wedge,
  testm,
  levers,
  press,
  scale,
  ellipse,
  hoist,
  coulisse,
  gearjack,
  windlass,
  brake15,
  brake16,
  blocks17,
  blocks18,
  ...VIRTUAL_MACHINES_29,
];

const tg = (a: number) => Math.tan(rad(a));
const pr = (
  title: string,
  machine: string,
  vals: Vals | undefined,
  book: Record<string, number> | undefined,
  o: Partial<MachinePreset> = {},
): MachinePreset => ({ title, machine, vals, book, ...o });

export const VIRTUAL_MACHINE_PRESETS: Record<string, MachinePreset> = {
  m461: pr(
    'Мещерский 46.1: винтовой домкрат',
    'screw',
    undefined,
    { Q: 5020 },
    { relTol: 0.002, note: 'Рукоятка 0,6 м, сила 16 кГ, шаг 12 мм; по формуле 5027 кГ, в книге округлено до 5020.' },
  ),
  m462: pr(
    'Мещерский 46.2: коленчатый пресс',
    'rhombus',
    { M: 100, h: 4, alpha: 30, a: 0.2 },
    { P: (PI * 100) / (0.004 * tg(30)) },
    { note: 'Числа заданы приложением (в книге ответ в буквах): P = πM·ctg α/h.' },
  ),
  m463: pr(
    'Мещерский 46.3: клиновой пресс',
    'wedge',
    { P: 100, a: 0.4, h: 10, alpha: 10 },
    { Q: (2 * PI * 0.4 * 100) / (0.01 * tg(10)) },
    { note: 'Числа заданы приложением: Q = 2πaP/(h·tg α).' },
  ),
  m464: pr(
    'Мещерский 46.4: машина для испытания образцов на растяжение',
    'testm',
    { P: 50, x: 0.1, l1: 0.3, l2: 0.05, e: 0.02 },
    { X: (50 * 0.1 * 0.3) / (0.02 * 0.05) },
    { note: 'Числа заданы приложением: X = P·x·l₁/(e·l₂).' },
  ),
  m465: pr(
    'Мещерский 46.5: система рычагов с грузами K и L',
    'levers',
    undefined,
    { PL: 1 },
    { note: 'BC/AC = 1/10, ON/OM = 1/3, DE/DF = 1/10; P_L = P_K/300 — для P_K = 300 кГ получается 1 кГ.' },
  ),
  m466: pr('Мещерский 46.6: рычажный пресс', 'press', undefined, { Q: 1800 }),
  m467: pr(
    'Мещерский 46.7: весы, гиря не зависит от положения груза',
    'scale',
    { a: 0.5, b: 0.1, c: 0.3, d: 0.1, l: 0.4, P: 50 },
    { p: 10 },
    { note: 'Размеры подобраны так, что (b + c)/b = l/d; p = (b/a)P.' },
  ),
  m468: pr('Мещерский 46.8: эллипсограф', 'ellipse', undefined, { M: 2 * 50 * 0.2 * Math.cos(rad(40)) }, { note: 'Числа заданы приложением: M = 2Pl·cos φ.' }),
  m469: pr('Мещерский 46.9: полиспаст', 'hoist', undefined, { ratio: 8 }),
  m4610: pr(
    'Мещерский 46.10: кулисный механизм',
    'coulisse',
    undefined,
    { Q: (100 * 0.3) / (0.5 * Math.cos(rad(30)) ** 2) },
    { note: 'Числа заданы приложением: Q = Pl/(R·cos²φ).' },
  ),
  m4611: pr('Мещерский 46.11: реечный домкрат', 'gearjack', undefined, { P: 5 }),
  m4612: pr('Мещерский 46.12: дифференциальный ворот', 'windlass', undefined, { P: 12 }),
  m4615: pr(
    'Мещерский 46.15: колодочно-бандажный тормоз трамвая',
    'brake15',
    undefined,
    { NK: (100 * 0.6) / 0.2, NL: (100 * 0.4 * 0.5) / (0.2 * 0.3) },
    { note: 'Размеры a, b, d в книге — буквами; взяты 0,4; 0,2; 0,3 м. N_K = F(a + b)/b, N_L = F·(a/b)·(b + d)/d.' },
  ),
  m4616: pr(
    'Мещерский 46.16: тормоз трамвая, равные давления колодок',
    'brake16',
    undefined,
    { Q: (100 * 0.6) / 0.4 },
    { note: 'Размеры подобраны по условию a/b = (a + b + c)/c; Q = F(a + b)/(2b).' },
  ),
  m4617: pr('Мещерский 46.17: грузы на наклонных плоскостях и подвижный блок', 'blocks17', undefined, { P1: 100, P2: 100 / (2 * Math.sin(rad(45))) }),
  m4618: pr('Мещерский 46.18: грузы A, B и блок с грузом K', 'blocks18', undefined, { P: 50, f: 1 }),
  ...VIRTUAL_MACHINE_PRESETS_29,
};

export const VIRTUAL_CATALOG: Catalog = {
  moduleId: 'virtual',
  modeName: 'Машины',
  title: 'Возможные перемещения: машины',
  lede: 'Равновесие машин с одной степенью свободы (Мещерский, §46): домкраты и прессы, рычаги, полиспасты, тормоза, кривошипные механизмы — по перемещению точки приложения искомой силы на возможное перемещение входного звена.',
  machines: VIRTUAL_MACHINES,
  presets: VIRTUAL_MACHINE_PRESETS,
  start: 'm461',
};
