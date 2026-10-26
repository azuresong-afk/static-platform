/**
 * Пункт 29, «Возможные перемещения», режим «Машины»: системы с замкнутыми контурами, которые не собираются деревом
 * «Балок и рам», — леса резервуара с подкосом (Мещерский 46.24) и две фермы на стержнях (46.28). Решаются общей
 * моделью model/linkvw.ts: отбрасываем искомую связь, находим возможное перемещение (мгновенные центры тел) и пишем
 * сумму работ.
 */
import { sig } from '../relative/text/earth';
import type { Fig, Machine, MachinePreset, Param, Row, Solved, Step, Vals } from '../../shared/machines/types';
import { arrow, ground, line, pin, svgOf, text, type P } from '../../shared/machines/sketch';
import { solveVW, type P2, type VwLink, type VwLoad, type VwMotion } from './model/linkvw';

const s4 = (x: number) => sig(x, 4);
const par = (k: string, label: string, def: number, unit?: string, o: Partial<Param> = {}): Param => ({ k, label, def, unit, ...o });
const fl = (p: P, s: string, a: 'start' | 'middle' | 'end' = 'start') => text(p, s, a, 'mc-t');
const pt = (p: P2) => `(${s4(p[0])}; ${s4(p[1])})`;
const W = 760,
  H = 320;

/** Перевод координат схемы (м, y вверх) в координаты чертежа. */
function view(pts: P2[], pad = 60) {
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const k = Math.min((W - 2 * pad) / Math.max(x1 - x0, 1e-9), (H - 2 * pad) / Math.max(y1 - y0, 1e-9));
  const ox = (W - k * (x1 - x0)) / 2 - k * x0,
    oy = (H + k * (y1 - y0)) / 2 + k * y0;
  return (p: P2): P => [ox + k * p[0], oy - k * p[1]];
}

function motionText(names: string[], ms: VwMotion[]): string[] {
  return ms.map((m, i) =>
    m.kind === 'still'
      ? `${names[i]} — неподвижно`
      : m.kind === 'trans'
        ? `${names[i]} — поступательно, δr = ${pt([m.dx, m.dy])}`
        : `${names[i]} — поворот δφ = ${s4(m.dphi)} вокруг мгновенного центра ${pt(m.center!)}`,
  );
}

/* ---------- 46.24: леса резервуара ---------- */
export function scaffold(v: Vals) {
  const { a, P1, P2, H: Ht } = v;
  const A: P2 = [0, 0],
    K: P2 = [2 * a, 0],
    E: P2 = [4 * a, 0],
    B: P2 = [5 * a, 0],
    T0: P2 = [0, Ht],
    C: P2 = [4 * a, Ht],
    S1: P2 = [3 * a, Ht],
    S2: P2 = [4 * a, Ht - a],
    top: P2 = [0, Ht + 0.6 * a];
  // Тела: 0 — левая стойка, 1 — верхний брус, 2 — правая стойка, 3 — нижний брус AK, 4 — нижний брус KB.
  const links: VwLink[] = [
    { k: 'pin', a: 0, b: null, at: A, name: 'опора A (стойка)' },
    { k: 'pin', a: 3, b: null, at: A, name: 'опора A (брус)' },
    { k: 'pin', a: 0, b: 1, at: T0, name: 'шарнир стойки и верхнего бруса' },
    { k: 'pin', a: 1, b: 2, at: C, name: 'шарнир C' },
    { k: 'roller', a: 1, at: C, n: [1, 0], name: 'стержень CD' },
    { k: 'pin', a: 2, b: 4, at: E, name: 'шарнир правой стойки' },
    { k: 'pin', a: 3, b: 4, at: K, name: 'шарнир нижнего бруса' },
    { k: 'roller', a: 4, at: B, n: [0, 1], name: 'опора B' },
    { k: 'bar', a: 1, pa: S1, b: 2, pb: S2, name: 'подкос' },
  ];
  const loads: VwLoad[] = [
    { body: 3, at: K, F: [0, -P1], name: 'P₁' },
    { body: 0, at: top, F: [P2, 0], name: 'P₂' },
  ];
  const r = solveVW(5, links, loads, 8, Math.max(5 * a, Ht));
  return { r, pts: { A, K, E, B, T0, C, S1, S2, top } };
}
const scaffoldM: Machine = {
  id: 'scaffold',
  name: 'Леса резервуара: замкнутая рама с подкосом',
  params: [
    par('a', 'размер a', 1, 'м'),
    par('H', 'высота верхнего бруса', 3, 'м'),
    par('P1', 'сила P₁ (вниз, на шарнире нижнего бруса)', 1),
    par('P2', 'сила P₂ (вправо, на верху левой стойки)', 1, '', { zero: true }),
  ],
  solve(v): Solved {
    if (!(v.a > 0) || !(v.H > v.a) || !(v.P1 >= 0) || !(v.P2 >= 0)) return { ok: false, errors: ['a > 0, высота больше a, силы неотрицательные.'] };
    const { r, pts } = scaffold(v);
    if (!r.ok) return { ok: false, errors: [r.error] };
    // Знак перемещения выбираем так, чтобы подкос удлинялся на 1 (в решении — растяжение S > 0).
    const sg = -1;
    const dl = (pp: P2, body: number) => r.disp(body, pp).map((x) => sg * x) as P2;
    const dK = dl(pts.K, 3),
      dTop = dl(pts.top, 0),
      d1 = dl(pts.S1, 1),
      d2 = dl(pts.S2, 2);
    const names = ['левая стойка', 'верхний брус', 'правая стойка', 'нижний брус AK', 'нижний брус KB'];
    const ms = r.motions.map((m) => ({ ...m, dx: sg * m.dx, dy: sg * m.dy, dphi: sg * m.dphi }));
    const steps: Step[] = [
      {
        title: 'Отбрасываем подкос',
        lines: [
          [
            'подкос заменяем силами S (растяжение «+»), приложенными к верхнему брусу и правой стойке',
            'рама из пяти брусьев на шарнирах с опорами A, B и стержнем CD становится механизмом с одной степенью свободы',
          ],
        ],
        note: 'Опоры и шарниры — идеальные связи: их реакции на возможном перемещении работы не совершают; работают только P₁, P₂ и усилие S.',
      },
      {
        title: 'Возможное перемещение (мгновенные центры)',
        lines: [motionText(names, ms)],
        note: 'Брус KB поворачивается вокруг катка B (у шарнира K перемещение вертикально, у B — горизонтально); правая стойка движется поступательно (обе её точки — по вертикали), верхний брус поворачивается вокруг шарнира на левой стойке; стойка неподвижна — поэтому сила P₂ работы не совершает.',
      },
      {
        title: 'Перемещения точек приложения сил',
        lines: [
          [`шарнир K (сила P₁): δr = ${pt(dK)}`, `верх левой стойки (сила P₂): δr = ${pt(dTop)}`, `концы подкоса: ${pt(d1)} и ${pt(d2)}, удлинение δl = 1`],
        ],
      },
      {
        title: 'Принцип возможных перемещений',
        lines: [
          [`P₁·(−δy_K) + P₂·δx₂ − S·δl = 0`, `S = ${s4(v.P1)}·${s4(-dK[1])} + ${s4(v.P2)}·${s4(dTop[0])} = ${s4(r.value)}`],
          [`S/P₁ = ${s4(r.value / v.P1)};  12√2 = ${s4(12 * Math.SQRT2)}`],
        ],
        note: r.value >= 0 ? 'S > 0 — подкос растянут.' : 'S < 0 — подкос сжат.',
      },
    ];
    const f = view([pts.A, pts.B, pts.top, [5.6 * v.a, pts.C[1]]]);
    const g = [
      line(f(pts.A), f(pts.top)),
      line(f(pts.T0), f(pts.C)),
      line(f(pts.C), f(pts.E)),
      line(f(pts.A), f(pts.B)),
      line(f(pts.S1), f(pts.S2)),
      line(f(pts.C), f([pts.C[0] + 1.2 * v.a, pts.C[1]])),
      pin(f([pts.C[0] + 1.2 * v.a, pts.C[1]])),
      ...[pts.A, pts.K, pts.E, pts.B, pts.T0, pts.C, pts.S1, pts.S2].map((p) => pin(f(p))),
      ground(f(pts.A)[0] - 20, f(pts.A)[0] + 20, f(pts.A)[1] + 10),
      ground(f(pts.B)[0] - 20, f(pts.B)[0] + 20, f(pts.B)[1] + 10),
      arrow([f(pts.K)[0], f(pts.K)[1] - 60], f(pts.K)),
      fl([f(pts.K)[0] + 8, f(pts.K)[1] - 44], 'P₁'),
      arrow([f(pts.top)[0] - 60, f(pts.top)[1]], f(pts.top)),
      fl([f(pts.top)[0] - 60, f(pts.top)[1] - 10], 'P₂'),
      fl([f(pts.A)[0] - 14, f(pts.A)[1] + 4], 'A', 'end'),
      fl([f(pts.B)[0] + 10, f(pts.B)[1] + 4], 'B'),
      fl([f(pts.C)[0] + 6, f(pts.C)[1] - 8], 'C'),
      fl([f([pts.C[0] + 1.2 * v.a, pts.C[1]])[0] + 8, f(pts.C)[1] - 8], 'D'),
      fl([(f(pts.S1)[0] + f(pts.S2)[0]) / 2 - 12, (f(pts.S1)[1] + f(pts.S2)[1]) / 2 + 12], 'S', 'end'),
    ];
    const rows: Row[] = [{ key: 'S', label: ['S'], val: r.value, unit: '', digits: 4 }];
    return { ok: true, steps, rows, fig: svgOf(W, H, g) as Fig };
  },
};

/* ---------- 46.28: две фермы на стержнях ---------- */
export function trusses(v: Vals) {
  const { L, a, P, e, hE, hC, beta } = v;
  const be = (beta * Math.PI) / 180;
  const A: P2 = [0, 0],
    D: P2 = [L, 0],
    B: P2 = [2 * L, 0],
    E: P2 = [L - e, -hE],
    F: P2 = [L + e, -hE],
    C: P2 = [L, -hC],
    Pp: P2 = [a, 0];
  const n: P2 = [Math.cos(be), -Math.sin(be)];
  const links: VwLink[] = [
    { k: 'roller', a: 0, at: A, n: [0, 1], name: 'каток A' },
    { k: 'pin', a: 0, b: 1, at: D, name: 'шарнир D' },
    { k: 'pin', a: 0, b: 2, at: E, name: 'шарнир фермы I и стержня III' },
    { k: 'pin', a: 1, b: 3, at: F, name: 'шарнир фермы II и стержня IV' },
    { k: 'pin', a: 2, b: null, at: C, name: 'шарнир C (стержень III)' },
    { k: 'pin', a: 3, b: null, at: C, name: 'шарнир C (стержень IV)' },
    { k: 'roller', a: 1, at: B, n, name: 'каток B' },
  ];
  const loads: VwLoad[] = [{ body: 0, at: Pp, F: [0, -P], name: 'P' }];
  const r = solveVW(4, links, loads, 6, 2 * L);
  return { r, pts: { A, D, B, E, F, C, Pp }, n };
}
/** Ответ книги R_B = P·(a/b)·(DC₂/DC₁) по мгновенным центрам, построенным пересечением прямых. */
export function trussesBook(v: Vals): number {
  const { L, a, P, e, hE, hC, beta } = v;
  const be = (beta * Math.PI) / 180;
  const cross = (p: P2, d: P2, q: P2, f: P2): P2 => {
    const t = ((q[0] - p[0]) * f[1] - (q[1] - p[1]) * f[0]) / (d[0] * f[1] - d[1] * f[0]);
    return [p[0] + t * d[0], p[1] + t * d[1]];
  };
  const C: P2 = [L, -hC],
    E: P2 = [L - e, -hE],
    F: P2 = [L + e, -hE],
    D: P2 = [L, 0],
    B: P2 = [2 * L, 0];
  // C₁ — на вертикали через каток A и на прямой CE; C₂ — на прямой CF и на прямой C₁D.
  const C1 = cross([0, 0], [0, 1], C, [E[0] - C[0], E[1] - C[1]]);
  const C2 = cross(C, [F[0] - C[0], F[1] - C[1]], C1, [D[0] - C1[0], D[1] - C1[1]]);
  const n: P2 = [Math.cos(be), -Math.sin(be)];
  const b = Math.abs((C2[0] - B[0]) * n[1] - (C2[1] - B[1]) * n[0]);
  return ((P * a) / b) * (Math.hypot(C2[0] - D[0], C2[1] - D[1]) / Math.hypot(C1[0] - D[0], C1[1] - D[1]));
}
const trussesM: Machine = {
  id: 'trusses',
  name: 'Две фермы на стержнях к общему шарниру',
  params: [
    par('L', 'пролёт фермы AD = DB', 6, 'м'),
    par('a', 'расстояние силы P от опоры A', 4, 'м'),
    par('P', 'сила P (вниз)', 1),
    par('e', 'узлы стержней III, IV: смещение от вертикали D', 1.5, 'м'),
    par('hE', 'узлы стержней III, IV: глубина под AB', 3, 'м'),
    par('hC', 'глубина шарнира C под AB', 5, 'м'),
    par('beta', 'угол реакции катка B с горизонталью', 60, '°'),
  ],
  solve(v): Solved {
    if (!['L', 'a', 'P', 'e', 'hE', 'hC', 'beta'].every((k) => v[k] > 0) || !(v.a < v.L) || !(v.hC > v.hE) || !(v.beta < 90))
      return { ok: false, errors: ['Все размеры положительные, сила P — на ферме I (a < AD), шарнир C ниже узлов стержней, угол меньше 90°.'] };
    const { r, pts, n } = trusses(v);
    if (!r.ok) return { ok: false, errors: [r.error] };
    const m1 = r.motions[0],
      m2 = r.motions[1];
    if (m1.kind !== 'rot' || m2.kind !== 'rot') return { ok: false, errors: ['Фермы на возможном перемещении не поворачиваются — схема особая.'] };
    const C1 = m1.center!,
      C2 = m2.center!;
    const dist = (p: P2, q: P2) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const b = Math.abs((C2[0] - pts.B[0]) * n[1] - (C2[1] - pts.B[1]) * n[0]);
    const book = trussesBook(v);
    const steps: Step[] = [
      {
        title: 'Отбрасываем каток B',
        lines: [
          [
            'каток B заменяем реакцией R_B, перпендикулярной плоскости скольжения (слева направо вниз)',
            'система двух ферм и стержней III, IV получает одну степень свободы',
          ],
        ],
      },
      {
        title: 'Мгновенные центры ферм',
        lines: [
          [
            `ферма I: точка A — по горизонтали, узел стержня III — перпендикулярно CE  ⇒  C₁ = ${pt(C1)}`,
            `ферма II: узел стержня IV — перпендикулярно CF, шарнир D — перпендикулярно DC₁  ⇒  C₂ = ${pt(C2)} (на прямых CF и C₁D)`,
          ],
          motionText(['ферма I', 'ферма II', 'стержень III', 'стержень IV'], r.motions),
        ],
        note: 'Шарнир D принадлежит обеим фермам, поэтому мгновенные центры C₁, C₂ и точка D лежат на одной прямой.',
      },
      {
        title: 'Принцип возможных перемещений',
        lines: [
          ['δφ₁·DC₁ = δφ₂·DC₂ (перемещение шарнира D);  P·a·δφ₁ = R_B·b·δφ₂', 'R_B = P·(a/b)·(DC₂/DC₁)'],
          [
            `DC₁ = ${s4(dist(pts.D, C1))},  DC₂ = ${s4(dist(pts.D, C2))},  b = ${s4(b)} — плечо R_B относительно C₂`,
            `R_B = ${s4(v.P)}·(${s4(v.a)}/${s4(b)})·(${s4(dist(pts.D, C2))}/${s4(dist(pts.D, C1))}) = ${s4(book)}`,
          ],
          [`по сумме работ: R_B = −P·δy_P/δs_B = ${s4(r.value)}`],
        ],
        note:
          r.value >= 0
            ? 'R_B > 0 — реакция направлена, как на чертеже книги (слева направо вниз).'
            : 'R_B < 0 — реакция направлена противоположно стрелке (справа налево вверх).',
      },
    ];
    const f = view([pts.A, pts.B, pts.C, [2 * v.L, 0.25 * v.L]]);
    const nb: P = [f(pts.B)[0] - 60 * n[0], f(pts.B)[1] + 60 * n[1]];
    const g = [
      line(f(pts.A), f(pts.D)),
      line(f(pts.D), f(pts.B)),
      line(f(pts.A), f(pts.E)),
      line(f(pts.E), f(pts.D)),
      line(f(pts.D), f(pts.F)),
      line(f(pts.F), f(pts.B)),
      line(f(pts.E), f(pts.C)),
      line(f(pts.F), f(pts.C)),
      ...[pts.A, pts.D, pts.B, pts.E, pts.F, pts.C].map((p) => pin(f(p))),
      ground(f(pts.A)[0] - 20, f(pts.A)[0] + 20, f(pts.A)[1] + 12),
      ground(f(pts.C)[0] - 20, f(pts.C)[0] + 20, f(pts.C)[1] + 10),
      arrow([f(pts.Pp)[0], f(pts.Pp)[1] - 60], f(pts.Pp)),
      fl([f(pts.Pp)[0] + 8, f(pts.Pp)[1] - 44], 'P'),
      arrow(nb, f(pts.B)),
      fl([nb[0] - 6, nb[1] - 6], 'R_B', 'end'),
      fl([f(pts.A)[0] - 10, f(pts.A)[1] - 8], 'A', 'end'),
      fl([f(pts.B)[0] + 10, f(pts.B)[1] + 4], 'B'),
      fl([f(pts.D)[0], f(pts.D)[1] - 10], 'D', 'middle'),
      fl([f(pts.C)[0] + 10, f(pts.C)[1]], 'C'),
      fl([(f(pts.E)[0] + f(pts.C)[0]) / 2 - 12, (f(pts.E)[1] + f(pts.C)[1]) / 2], 'III', 'end'),
      fl([(f(pts.F)[0] + f(pts.C)[0]) / 2 + 12, (f(pts.F)[1] + f(pts.C)[1]) / 2], 'IV'),
    ];
    const rows: Row[] = [{ key: 'R', label: ['R_B'], val: r.value, unit: '', digits: 4 }];
    return { ok: true, steps, rows, fig: svgOf(W, H, g) as Fig };
  },
};

export const VIRTUAL_MACHINES_29: Machine[] = [scaffoldM, trussesM];

const T28 = { L: 6, a: 4, P: 1, e: 1.5, hE: 3, hC: 5, beta: 60 };
export const VIRTUAL_MACHINE_PRESETS_29: Record<string, MachinePreset> = {
  m4624: {
    title: 'Мещерский 46.24: леса резервуара — усилие в подкосе',
    machine: 'scaffold',
    vals: { a: 1, H: 3, P1: 1, P2: 1 },
    book: { S: 12 * Math.SQRT2 },
    note: 'Ответ книги: S = 12√2·P₁ — от P₂, a и высоты рамы не зависит (левая стойка на возможном перемещении неподвижна).',
  },
  m4628: {
    title: 'Мещерский 46.28: две фермы на стержнях — реакция катка B',
    machine: 'trusses',
    vals: T28,
    book: { R: trussesBook(T28) },
    note: 'Ответ книги в буквах: R_B = P·(a/b)·(DC₂/DC₁), b — плечо R_B относительно мгновенного центра C₂ фермы II. Размеры сняты с чертежа приблизительно, угол катка B — 60°.',
  },
};
