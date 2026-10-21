/**
 * Пункт 28, «Удар»: обратные задачи о соударении шаров (Мещерский §44).
 *
 *  - stop    44.8 — отношение масс, при котором второй шар после прямого центрального удара остановится:
 *              m₂/m₁ = −[(1 + k)(v₁ − v₂) + v₂]/v₂;
 *  - chain   44.9 — три шара в желобе: масса среднего, при которой третий получает наибольшую скорость, m₂ = √(m₁m₃);
 *  - oblique 44.13 — косой удар о неподвижную плоскость: углы падения и отражения по отношению скоростей и k;
 *  - aim     44.15 — три одинаковых упругих шара: на какой прямой должен двигаться третий, чтобы после удара о второй
 *              нанести центральный удар первому;
 *  - climb   Яблонский, Д.13 — катящееся тело ударяется о ребро ступеньки и о наклонную плоскость (удары без
 *              проскальзывания и отрыва), между ударами — подъём и качение; скорость до остановки платформы или путь.
 */
import { parseNum } from '../../../shared/format';
import { ansB, bisect, bold, eqB, fail, parB, sample, sg, stepB, stepEx, type AskDef, type ExtraOut, type Ln } from '../../../shared/extra';

const G = 9.81;

const D2R = Math.PI / 180;
const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });

/* ---------- 44.8 ---------- */
const A_STOP: AskDef = {
  id: 'stop',
  title: '44.8: отношение масс шаров, при котором второй шар после удара остановится',
  hint: 'Прямой центральный удар; скорости до удара v₁, v₂ — проекции на линию центров (со знаками), коэффициент восстановления k. Найти m₂/m₁, при котором скорость второго шара после удара равна нулю.',
  n: { v1: 0, v2: -1, k: 0.5 },
  fields: [
    { k: 'v1', label: 'скорость первого шара v₁ (со знаком)', neg: true },
    { k: 'v2', label: 'скорость второго шара v₂ (со знаком, ≠ 0)', neg: true },
    { k: 'k', label: 'коэффициент восстановления k', zero: true },
  ],
  solve: (q, ex) => {
    const { v1, v2, k } = q.n;
    if (!(k >= 0 && k <= 1)) return fail(['0 ≤ k ≤ 1.']);
    if (v2 === 0) return fail(['Второй шар до удара должен двигаться (v₂ ≠ 0), иначе он «останавливается» лишь при отсутствии удара.']);
    if (!(v1 > v2)) return fail(['Удара нет: шары не сближаются (нужно v₁ > v₂ — первый догоняет второй или идёт навстречу).']);
    const r = -((1 + k) * (v1 - v2) + v2) / v2;
    if (!(r > 0)) return fail([`Остановить второй шар при этих скоростях нельзя: получается m₂/m₁ = ${sg(r)} ≤ 0.`]);
    const steps = [
      stepEx(ex, 'Скорость второго шара после удара', 'Теорема об изменении количества движения системы и гипотеза Ньютона (u₂ − u₁ = k(v₁ − v₂)).', eqB('u₂ = v₂ + m₁(1 + k)(v₁ − v₂)/(m₁ + m₂)')),
      stepB('Условие u₂ = 0', eqB('m₁(1 + k)(v₁ − v₂) = −v₂(m₁ + m₂)', 'm₂/m₁ = −[(1 + k)(v₁ − v₂) + v₂]/v₂', `m₂/m₁ = ${sg(r)}`)),
      stepEx(ex, 'Частные случаи', 'Первый шар покоится (v₁ = 0): m₂/m₁ = k. Шары встречаются с равными скоростями (v₁ = −v₂): m₂/m₁ = 1 + 2k.', parB(`Скорость первого шара после удара: u₁ = ${sg(v1 - ((r / (1 + r)) * (1 + k) * (v1 - v2)))}`)),
      stepB('Ответ', ansB([[bold(`m₂/m₁ = ${sg(r)}`)], 'отношение масс'])),
    ];
    return done({ vals: { ratio: r }, steps });
  },
};

/* ---------- 44.9 ---------- */
const A_CHAIN: AskDef = {
  id: 'chain',
  title: '44.9: три шара в желобе — масса среднего, при которой третий получит наибольшую скорость',
  hint: 'Первый шар с начальной скоростью v ударяет покоящийся второй, второй — покоящийся третий. Удары прямые центральные с коэффициентом восстановления k (абсолютно упругие — k = 1).',
  n: { m1: 1, m3: 4, v: 1, k: 1 },
  fields: [
    { k: 'm1', label: 'масса m₁' },
    { k: 'm3', label: 'масса m₃' },
    { k: 'v', label: 'начальная скорость первого шара v' },
    { k: 'k', label: 'коэффициент восстановления k' },
  ],
  solve: (q, ex) => {
    const { m1, m3, v, k } = q.n;
    if (!pos(m1, m3, v) || !(k > 0 && k <= 1)) return fail(['m₁, m₃, v > 0; 0 < k ≤ 1.']);
    const m2 = Math.sqrt(m1 * m3);
    const v3 = (m: number) => ((1 + k) ** 2 * m1 * m * v) / ((m1 + m) * (m + m3));
    const steps = [
      stepEx(ex, 'Скорости после ударов', 'Покоящийся шар массой m_b после удара шаром m_a со скоростью u получает (1 + k)m_a u/(m_a + m_b).', eqB('u₂ = (1 + k)m₁v/(m₁ + m₂),  u₃ = (1 + k)m₂u₂/(m₂ + m₃) = (1 + k)²m₁m₂v/((m₁ + m₂)(m₂ + m₃))')),
      stepEx(ex, 'Наибольшее u₃', 'u₃ ∝ m₂/((m₁ + m₂)(m₂ + m₃)); производная по m₂ обращается в нуль при m₂² = m₁m₃.', eqB(`m₂ = √(m₁m₃) = ${sg(m2)}`, `u₃max = ${sg(v3(m2))}`)),
      stepB('Ответ', ansB([[bold(`m₂ = √(m₁m₃) = ${sg(m2)}`)], 'масса среднего шара'], [`u₃ = ${sg(v3(m2))}`, 'наибольшая скорость третьего шара', 'aux'])),
    ];
    return done({ vals: { m2, v3: v3(m2) }, steps, plot: { xl: 'm₂', yl: 'u₃', series: [{ name: 'u₃(m₂)', pts: sample(v3, m2 / 10, m2 * 5, 120) }], marks: [{ x: m2, y: v3(m2), label: 'max' }] } });
  },
};

/* ---------- 44.13 ---------- */
const A_OBLIQUE: AskDef = {
  id: 'oblique',
  title: '44.13: косой удар шарика о неподвижную плоскость — углы падения и отражения',
  hint: 'Касательная составляющая скорости при ударе о гладкую плоскость сохраняется, нормальная умножается на k. Углы — от нормали к плоскости.',
  n: { ratio: Math.SQRT1_2, k: 1 / Math.sqrt(3), alpha: 30 },
  s: { given: 'ratio' },
  selects: [
    {
      k: 'given',
      label: 'Что задано',
      options: [
        ['ratio', 'отношение скоростей v₁/v и k — найти углы'],
        ['alpha', 'угол падения α и k — найти угол отражения и v₁/v'],
      ],
    },
  ],
  fields: [
    { k: 'ratio', label: 'отношение v₁/v', show: (p) => p.s.given === 'ratio' },
    { k: 'alpha', label: 'угол падения α (от нормали), °', show: (p) => p.s.given === 'alpha' },
    { k: 'k', label: 'коэффициент восстановления k' },
  ],
  solve: (q, ex) => {
    const k = q.n.k;
    if (!(k > 0 && k <= 1)) return fail(['0 < k ≤ 1.']);
    let a: number;
    if (q.s.given === 'alpha') {
      a = q.n.alpha * D2R;
      if (!(a >= 0 && a < Math.PI / 2)) return fail(['0 ≤ α < 90°.']);
    } else {
      const r = q.n.ratio;
      if (k === 1) return fail(['При k = 1 отношение скоростей всегда 1 — угол не определяется.']);
      const c2 = (1 - r * r) / (1 - k * k);
      if (!(r >= k && r <= 1) || !(c2 >= 0 && c2 <= 1)) return fail([`Отношение v₁/v должно лежать между k = ${sg(k)} и 1.`]);
      a = Math.acos(Math.sqrt(c2));
    }
    const b = Math.atan2(Math.sin(a), k * Math.cos(a));
    const r = Math.sqrt(Math.sin(a) ** 2 + k * k * Math.cos(a) ** 2);
    const steps = [
      stepEx(ex, 'Составляющие скорости', 'Плоскость гладкая: касательная составляющая не меняется; нормальная после удара — k·v cos α.', eqB('v₁ sin β = v sin α,  v₁ cos β = k v cos α', 'tg β = tg α / k,  v₁²/v² = sin²α + k² cos²α')),
      stepB(q.s.given === 'ratio' ? 'Угол падения' : 'Угол отражения', eqB(q.s.given === 'ratio' ? `cos²α = (1 − (v₁/v)²)/(1 − k²):  α = ${sg(a / D2R)}°` : `α = ${sg(a / D2R)}°`, `β = ${sg(b / D2R)}°,  v₁/v = ${sg(r)}`)),
      stepB('Ответ', ansB([[bold(`α = ${sg(a / D2R)}°`)], 'угол падения'], [[bold(`β = ${sg(b / D2R)}°`)], 'угол отражения'])),
    ];
    return done({ vals: { alpha: a / D2R, beta: b / D2R, ratio: r }, steps });
  },
};

/* ---------- 44.15 ---------- */
const A_AIM: AskDef = {
  id: 'aim',
  title: '44.15: три одинаковых упругих шара — куда направить третий, чтобы он после удара о второй попал в первый',
  hint: 'Шары M₁, M₂, M₃ радиуса R, расстояние центров C₁C₂ = a. Третий движется по прямой AB, перпендикулярной C₁C₂, ударяет второй (покоящийся) и после удара должен нанести центральный удар первому.',
  n: { R: 1, a: 6 },
  fields: [
    { k: 'R', label: 'радиус шаров R' },
    { k: 'a', label: 'расстояние C₁C₂ = a' },
  ],
  solve: (q, ex) => {
    const { R, a } = q.n;
    if (!pos(R, a) || !(a > 2 * R)) return fail(['R > 0, a > 2R.']);
    const d = (4 * R * R) / a;
    const y = Math.sqrt(4 * R * R - d * d);
    const steps = [
      stepEx(ex, 'Скорость третьего шара после удара', 'Шары одинаковые и абсолютно упругие, второй покоится: нормальная (по линии центров C₃C₂) составляющая скорости третьего целиком передаётся второму, касательная остаётся. Третий уходит перпендикулярно линии центров в момент удара.', eqB('u₃ ⟂ C₂C₃')),
      stepEx(ex, 'Условие попадания в первый шар', 'Центральный удар по первому: третий движется по прямой через C₁, т. е. C₁C₃ ⟂ C₂C₃. Начало — C₂, ось — от C₂ к C₁ обратно; C₃ = (d, y), d² + y² = 4R², C₁ = (−a, 0).', eqB('(C₁ − C₃)·(C₃ − C₂) = 0  ⇒  −a d − 4R² = 0', 'прямая AB — по сторону шара M₁ от C₂ на расстоянии d = 4R²/a')),
      stepB('Ответ', ansB([[bold(`BC₂ = 4R²/a = ${sg(d)}`)], 'расстояние прямой AB от центра C₂'], [`|y| = ${sg(y)}`, 'смещение C₃ вдоль AB в момент удара', 'aux'])),
    ];
    return done({ vals: { d }, steps });
  },
};


/* ---------- Д.13 ---------- */
type Stage = { k: 'S'; h: number } | { k: 'I'; a: number };
export function parseStages(src: string): Stage[] | string {
  const out: Stage[] = [];
  for (const part of src.split(/[;\n]/).map((x) => x.trim()).filter(Boolean)) {
    const [k, v] = part.split(':').map((x) => x.trim());
    const x = parseNum(v ?? '');
    if (!Number.isFinite(x)) return `препятствие «${part}»: нужно «S:h» или «I:α»`;
    if (k.toUpperCase() === 'S') out.push({ k: 'S', h: x });
    else if (k.toUpperCase() === 'I') out.push({ k: 'I', a: x });
    else return `препятствие «${part}»: S — ступенька, I — наклонная плоскость`;
  }
  if (!out.length) return 'нет препятствий';
  if (out.slice(0, -1).some((s) => s.k === 'I')) return 'наклонная плоскость может быть только последней';
  return out;
}
const SHAPE_K: Record<string, number> = { disk: 0.5, ring: 1, sphere: 0.4 };
const A_CLIMB: AskDef = {
  id: 'climb',
  title: 'Яблонский, Д.13: тело ударяется о ребро ступеньки и о наклонную плоскость — подъём, качение, скорость платформы',
  hint: 'Цилиндр (шар, обруч) радиуса r на горизонтальной поверхности. До первого удара он движется поступательно со скоростью v (платформа внезапно остановилась) или катится. Препятствия через «;»: S:h — ступенька высотой h (удар о ребро, подъём на неё), I:α — наклонная плоскость под углом α (удар о плоскость, качение вверх по ней на путь s). Удары без проскальзывания и отрыва, качение без скольжения, сопротивлением качению пренебречь.',
  n: { m: 500, r: 0.5, rho: 0.35, v: 3.68, s: 0.1, g: G },
  s: { shape: 'disk', start: 'stop', path: 'S:0,1; I:60', find: 'v' },
  selects: [
    {
      k: 'shape',
      label: 'Тело',
      options: [
        ['disk', 'сплошной цилиндр (J_C = mr²/2)'],
        ['ring', 'тонкий обруч (J_C = mr²)'],
        ['sphere', 'шар (J_C = 2mr²/5)'],
        ['rho', 'радиус инерции ρ задан'],
      ],
    },
    {
      k: 'start',
      label: 'До первого удара',
      options: [
        ['stop', 'движется поступательно со скоростью v (внезапная остановка платформы)'],
        ['roll', 'катится без скольжения со скоростью центра v'],
      ],
    },
    {
      k: 'find',
      label: 'Что найти',
      options: [
        ['v', 'скорость v (по пути s на наклонной плоскости или наименьшую — чтобы подняться на все ступеньки)'],
        ['s', 'по скорости v — движение после ударов (путь s)'],
      ],
    },
  ],
  fields: [
    { k: 'path', label: 'препятствия: S:h, I:α через «;»', text: true },
    { k: 'm', label: 'масса m, кг' },
    { k: 'r', label: 'радиус r, м' },
    { k: 'rho', label: 'радиус инерции ρ, м', show: (p) => p.s.shape === 'rho' },
    { k: 'v', label: 'скорость до первого удара v, м/с', show: (p) => p.s.find === 's' },
    { k: 's', label: 'путь по наклонной плоскости s, м', show: (p) => p.s.find === 'v' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { m, r, g } = q.n;
    if (!pos(m, r, g)) return fail(['m, r, g > 0.']);
    const k = q.s.shape === 'rho' ? (q.n.rho / r) ** 2 : SHAPE_K[q.s.shape] ?? 0.5;
    if (!(k > 0)) return fail(['ρ > 0.']);
    const st = parseStages(q.s.path);
    if (typeof st === 'string') return fail([st]);
    for (const s of st) {
      if (s.k === 'S' && !(s.h > 0 && s.h < r)) return fail(['Высота ступеньки 0 < h < r.']);
      if (s.k === 'I' && !(s.a > 0 && s.a < 90)) return fail(['Угол наклонной плоскости 0 < α < 90°.']);
    }
    const roll0 = q.s.start === 'roll';
    type Rec = { S: [number, number]; w: number; v: number; ok: boolean; s?: number; Sn?: number; St?: number; wUp?: number };
    const run = (v0: number) => {
      let v = v0,
        w = roll0 ? v0 / r : 0;
      const recs: Rec[] = [];
      for (const s of st) {
        if (s.k === 'S') {
          const L = m * v * (r - s.h) + k * m * r * r * w;
          const w1 = L / (m * r * r * (k + 1));
          const xD = Math.sqrt(r * r - (r - s.h) ** 2);
          const vx = w1 * (r - s.h),
            vy = w1 * xD;
          const S: [number, number] = [m * (vx - v), m * vy];
          const w2sq = w1 * w1 - (2 * g * s.h) / (r * r * (k + 1));
          const ok = w2sq >= 0;
          recs.push({ S, w: w1, v: w1 * r, ok, wUp: ok ? Math.sqrt(w2sq) : NaN });
          if (!ok) return recs;
          w = Math.sqrt(w2sq);
          v = w * r;
        } else {
          const a = s.a * D2R;
          const w1 = (k * w * r * r + v * r * Math.cos(a)) / (r * r * (k + 1));
          const v1 = w1 * r;
          const S: [number, number] = [m * (v1 * Math.cos(a) - v), m * v1 * Math.sin(a)];
          const Sn = -S[0] * Math.sin(a) + S[1] * Math.cos(a),
            St = S[0] * Math.cos(a) + S[1] * Math.sin(a);
          const sUp = ((k + 1) * v1 * v1) / (2 * g * Math.sin(a));
          recs.push({ S, w: w1, v: v1, ok: true, s: sUp, Sn, St });
        }
      }
      return recs;
    };
    const lastI = st[st.length - 1].k === 'I';
    let v0: number;
    if (q.s.find === 'v') {
      const target = q.n.s;
      if (lastI && !pos(target)) return fail(['s > 0.']);
      const good = (v: number) => {
        const R = run(v);
        if (R.length < st.length || !R.every((x) => x.ok)) return -1;
        return lastI ? (R[R.length - 1].s as number) - target : 1;
      };
      let hi = 1;
      while (good(hi) < 0 && hi < 1e6) hi *= 2;
      if (hi >= 1e6) return fail(['Скорость не найдена.']);
      v0 = bisect((v) => (good(v) < 0 ? -1 : lastI ? good(v) : 1), 0, hi);
    } else {
      v0 = q.n.v;
      if (!pos(v0)) return fail(['v > 0.']);
    }
    const R = run(v0);
    const steps = [
      stepEx(ex, 'Момент инерции', null, eqB(`J_C = k m r²,  k = ${sg(k)};  относительно точки касания J = (1 + k) m r²`)),
    ];
    const vals: Record<string, number> = { v: v0 };
    const rows: [Ln, string][] = [[bold(`v = ${sg(v0)} м/с`), q.s.find === 'v' ? (lastI ? 'скорость до первого удара' : 'наименьшая скорость, при которой тело поднимается на все ступеньки') : 'скорость до первого удара']];
    R.forEach((x, i) => {
      const s = st[i];
      const n = i + 1;
      const Sm = Math.hypot(...x.S);
      vals[`S${n}`] = Sm;
      vals[`w${n}`] = x.w;
      if (s.k === 'S') {
        vals[`S${n}x`] = x.S[0];
        vals[`S${n}y`] = x.S[1];
        steps.push(
          stepEx(ex, `Удар ${n} — о ребро ступеньки h = ${sg(s.h)} м`, 'Ударный импульс проходит через ребро D — кинетический момент относительно D сохраняется. После удара тело вращается вокруг ребра.', eqB(`L_D = m v_C (r − h) + J_C ω = (1 + k) m r² ω'`, `ω' = ${sg(x.w)} рад/с,  v_C' = ${sg(x.v)} м/с`, `ударный импульс S = m(v_C' − v_C) = (${sg(x.S[0])}; ${sg(x.S[1])}),  |S| = ${sg(Sm)} Н·с`)),
          stepEx(ex, 'Подъём на ступеньку', 'Теорема об изменении кинетической энергии при повороте вокруг ребра: центр поднимается на h.', eqB(`(1 + k) m r² (ω'² − ω''²)/2 = m g h`, x.ok ? `ω'' = ${sg(x.wUp as number)} рад/с — тело поднимается и катится со скоростью ${sg((x.wUp as number) * r)} м/с` : '(ω″)² < 0 — тело не поднимается на ступеньку')),
        );
        if (!x.ok) rows.push(['не поднимается', `на ступеньку ${n}`]);
      } else {
        vals.s = x.s as number;
        vals[`S${n}n`] = x.Sn as number;
        vals[`S${n}t`] = x.St as number;
        steps.push(
          stepEx(ex, `Удар ${n} — о наклонную плоскость α = ${s.a}°`, 'Импульс приложен в точке касания F с плоскостью — кинетический момент относительно F сохраняется; после удара тело катится по плоскости.', eqB(`J_C ω + m v_C r cos α = (1 + k) m r² ω'`, `ω' = ${sg(x.w)} рад/с,  v_C' = ${sg(x.v)} м/с`, `ударный импульс: по нормали ${sg(x.Sn as number)},  вдоль плоскости ${sg(x.St as number)},  |S| = ${sg(Sm)} Н·с`)),
          stepEx(ex, 'Качение вверх по плоскости', 'Теорема об изменении кинетической энергии.', eqB(`(1 + k) m v_C'²/2 = m g s sin α`, `s = ${sg(x.s as number)} м`)),
        );
        rows.push([bold(`s = ${sg(x.s as number)} м`), 'путь по наклонной плоскости']);
      }
      rows.push([`|S${n}| = ${sg(Sm)} Н·с`, `ударный импульс ${n}`]);
    });
    steps.push(stepB('Ответ', ansB(...rows)));
    return done({ vals, steps });
  },
};

export const IMPACT_ASKS: AskDef[] = [A_STOP, A_CHAIN, A_OBLIQUE, A_AIM, A_CLIMB];
