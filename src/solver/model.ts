/**
 * Расчётная модель: неизвестные реакции, известные нагрузки, равнодействующие распределённых
 * нагрузок и уравнения-кандидаты. Аналог buildModel() прототипа без HTML.
 */
import { LOADDIR, REFS } from '../model/constants';
import { dirOf, type RefAxis } from '../model/format';
import { distGeom, pathNodes, partsOf, resolve, roman, type Geom, type Parts, type PointItem, type Pt } from '../model/geometry';
import type { DistItem, ForceItem, LoadDir, MomentItem, Structure, SupportItem, SupportType } from '../model/types';
import { makeEq, type Eq } from './equations';

/** Обозначение: буква и индекс (X с индексом A, F с индексом 2…). */
export interface Sym {
  L: string;
  S: string;
}

/** Силовой фактор: сила (kind f) или пара (kind m). Неизвестный — с key, известный — с val. */
export interface Action extends Sym {
  kind: 'f' | 'm';
  key?: string;
  val?: number;
  x: number;
  y: number;
  /** Единичный вектор положительного направления силы. */
  dx: number;
  dy: number;
  /** Угол положительного направления к оси x, град. */
  angle: number;
  /** Пара: +1 — против часовой, −1 — по часовой. */
  s: number;
  /** От какой оси пользователь отсчитывал угол (для записи sin/cos). */
  refAxis?: RefAxis;
  itemId: string;
  /** Для реакций — тип опоры. */
  support?: SupportType;
  /** Для неизвестных нагрузок — исходный элемент. */
  item?: ForceItem | MomentItem;
  /** Номер жёсткой части, на которую действует фактор (для конструкции без шарниров — 0). */
  part?: number;
  /** Обозначение угла и его значение, как их ввёл пользователь (для записи sin α вместо sin 60°). */
  angleName?: string;
  userAngle?: number;
  /** Взаимная реакция во внутреннем шарнире: действует на часть on, на часть from — в обратную сторону. */
  hinge?: { node: string; name: string; on: number; from: number };
}
export type Unknown = Action & { key: string };
export type Known = Action & { val: number };

export interface SupportInfo {
  it: PointItem & SupportItem;
  /** Имя точки опоры. */
  P: string;
  list: Unknown[];
}

export interface DistInfo {
  it: DistItem;
  /** Начало и конец куска нагрузки (обычно совпадают с it.from, it.to; шарнир делит нагрузку на куски). */
  from: string;
  to: string;
  /** Часть конструкции, на которую действует кусок. */
  part: number;
  /** Кусок нагрузки, разделённой шарнирами: номер и общее число кусков. */
  piece: { index: number; of: number } | null;
  q1: number;
  q2: number;
  /** Длина участка под нагрузкой. */
  l: number;
  /** Равнодействующая. */
  Q: number;
  /** Доля длины от начала до точки приложения Q. */
  f: number;
  /** Расстояние от начала до точки приложения Q. */
  d: number;
  S: string;
  o: Known;
  /**
   * Нагрузка меняет знак на участке: эпюра делится в нуле (на расстоянии l1 от начала) на два треугольника.
   * Тогда Q, f, d, o относятся к первому треугольнику, а обе равнодействующие — в parts.
   */
  split: { l1: number; parts: [DistPart, DistPart] } | null;
}

/** Треугольник эпюры знакопеременной нагрузки. */
export interface DistPart {
  /** Интенсивность на краю, где треугольник максимален (со знаком). */
  q: number;
  /** Длина треугольника. */
  l: number;
  /** Модуль равнодействующей. */
  Q: number;
  /** Расстояние от начала участка до точки приложения. */
  d: number;
  /** Направление равнодействующей. */
  dir: LoadDir;
  o: Known;
}

const OPPLOAD: Record<LoadDir, LoadDir> = { down: 'up', up: 'down', left: 'right', right: 'left' };

export interface BadDist {
  it: DistItem;
  S: string;
  why: 'zero' | 'line';
}

/** Что показать в заголовке карточки элемента. */
export interface ItemLabel {
  type: SupportItem['type'] | 'force' | 'weight' | 'moment' | 'dist';
  /** Индекс нагрузки (пусто, если нагрузка этого типа одна). */
  S: string;
  /** Точка приложения / опоры. */
  P?: string;
}

export interface Point {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface Model {
  g: Geom;
  pts: Point[];
  unknowns: Unknown[];
  knowns: Known[];
  supports: SupportInfo[];
  dists: DistInfo[];
  badDists: BadDist[];
  unkLoads: Unknown[];
  labels: Record<string, ItemLabel>;
  byKey: Record<string, Unknown>;
  /**
   * Уравнения-кандидаты в порядке предпочтения. Без шарниров: моменты относительно опорных точек, ΣFx, ΣFy,
   * моменты относительно остальных точек. С шарнирами: сначала те же уравнения для каждой части
   * (моменты относительно опор и шарниров части), затем — для всей конструкции.
   */
  cands: Eq[];
  /** Разбиение на жёсткие части по внутренним шарнирам. */
  parts: Parts;
  /** Имена точек каждой части. */
  partNames: string[][];
  /** Габарит, м. */
  w: number;
  h: number;
}

export function buildModel(s: Structure): Model {
  const { g, items } = resolve(s);
  const parts = partsOf(s, g);
  const carrier = (id: string) => parts.nodeParts[id]?.[0] ?? 0;
  const segPartBetween = (u: string, v: string) => {
    const q = s.segs.find((x) => (x.a === u && x.b === v) || (x.a === v && x.b === u));
    return q ? parts.segPart[q.id] : 0;
  };
  const carrierOfPath = (path: string[]) => (path.length > 1 ? segPartBetween(path[0], path[1]) : carrier(path[0]));
  const pts = g.order.map((id) => ({ id, name: g.name[id], x: g.pos[id][0], y: g.pos[id][1] }));
  const cnt = { force: 0, weight: 0, moment: 0, dist: 0 };
  items.forEach((it) => {
    if (it.type in cnt) cnt[it.type as keyof typeof cnt]++;
  });
  const idx = { force: 0, weight: 0, moment: 0, dist: 0 };
  const unknowns: Unknown[] = [],
    knowns: Known[] = [],
    supports: SupportInfo[] = [],
    dists: DistInfo[] = [],
    badDists: BadDist[] = [],
    unkLoads: Unknown[] = [],
    labels: Record<string, ItemLabel> = {},
    used = new Set<string>();
  const mkKey = (k: string) => {
    let kk = k;
    while (used.has(kk)) kk += "'";
    used.add(kk);
    return kk;
  };
  for (const it of items) {
    if (it.type === 'fixed' || it.type === 'pin' || it.type === 'roller' || it.type === 'rod') {
      const P = g.name[it.at],
        list: Unknown[] = [];
      const add = (letter: string, props: Pick<Action, 'kind'> & Partial<Action>) => {
        const base = letter + '_' + P;
        const key = mkKey(base);
        const u: Unknown = {
          dx: 0,
          dy: 0,
          angle: 0,
          s: 0,
          ...props,
          key,
          L: letter,
          S: P + key.slice(base.length),
          itemId: it.id,
          support: it.type,
          x: it.x,
          y: it.y,
          part: carrier(it.at),
        };
        unknowns.push(u);
        list.push(u);
      };
      if (it.type === 'fixed' || it.type === 'pin') {
        add('X', { kind: 'f', dx: 1, dy: 0, angle: 0 });
        add('Y', { kind: 'f', dx: 0, dy: 1, angle: 90 });
      }
      if (it.type === 'fixed') add('M', { kind: 'm', s: 1 });
      if (it.type === 'roller' || it.type === 'rod') {
        const angle = it.angle as number;
        const named = it.angleName && (it.type === 'rod' || it.side === 'tilt') ? { angleName: it.angleName, userAngle: angle } : {};
        add(it.type === 'roller' ? 'R' : 'S', { kind: 'f', ...dirOf(angle), angle, ...named });
      }
      supports.push({ it, P, list });
      labels[it.id] = { type: it.type, S: '', P };
      continue;
    }
    const t = it.type;
    const i = ++idx[t];
    const S = cnt[t] > 1 ? String(i) : '';
    if (it.type === 'force') {
      const angle = it.angle as number;
      const o: Action = {
        L: 'F',
        S,
        kind: 'f',
        x: it.x,
        y: it.y,
        ...dirOf(angle),
        angle,
        s: 0,
        refAxis: (REFS[it.ref] || REFS.down).axis,
        itemId: it.id,
        item: it,
        part: carrier(it.at),
        ...(it.angleName ? { angleName: it.angleName, userAngle: +it.alpha || 0 } : {}),
      };
      if (it.unknown) {
        const u = { ...o, key: mkKey('F' + S) };
        unknowns.push(u);
        unkLoads.push(u);
      } else knowns.push({ ...o, val: +it.F });
      labels[it.id] = { type: t, S, P: g.name[it.at] };
    } else if (it.type === 'weight') {
      knowns.push({ L: 'G', S, kind: 'f', x: it.x, y: it.y, dx: 0, dy: -1, angle: 270, s: 0, refAxis: 'h', val: +it.G, itemId: it.id, part: carrier(it.at) });
      labels[it.id] = { type: t, S, P: g.name[it.at] };
    } else if (it.type === 'moment') {
      const o: Action = { L: 'M', S, kind: 'm', x: it.x, y: it.y, dx: 0, dy: 0, angle: 0, s: it.dir === 'ccw' ? 1 : -1, itemId: it.id, item: it, part: carrier(it.at) };
      if (it.unknown) {
        const u = { ...o, key: mkKey('M' + (S || '*')) };
        unknowns.push(u);
        unkLoads.push(u);
      } else knowns.push({ ...o, val: +it.M });
      labels[it.id] = { type: t, S, P: g.name[it.at] };
    } else {
      labels[it.id] = { type: t, S };
      const dg = distGeom(g, it);
      if (!dg.ok) {
        badDists.push({ it, S, why: dg.why });
        continue;
      }
      const addPiece = (from: string, to: string, P0: Pt, P1: Pt, l: number, q1: number, q2: number, S: string, part: number, piece: DistInfo['piece']) => {
        const ang = LOADDIR[it.dir].ang;
        const force = (L: string, val: number, dist: number, a: number): Known => {
          const t = l > 0 ? dist / l : 0;
          return {
            L,
            S,
            kind: 'f',
            x: P0[0] + (P1[0] - P0[0]) * t,
            y: P0[1] + (P1[1] - P0[1]) * t,
            ...dirOf(a),
            angle: a,
            s: 0,
            refAxis: 'h',
            val,
            itemId: it.id,
            part,
          };
        };
        if (q1 * q2 < 0 && Math.abs(q1) > 1e-12 && Math.abs(q2) > 1e-12) {
          // Нагрузка меняет знак: делим эпюру в нуле на два треугольника, у каждого своя равнодействующая.
          // (В прототипе здесь была одна сила; при q1 = −q2 она равна нулю и пара сил терялась — баг №2.)
          const l1 = (l * q1) / (q1 - q2),
            l2 = l - l1;
          const tri = (L: string, q: number, len: number, d: number): DistPart => {
            const dir = q > 0 ? it.dir : OPPLOAD[it.dir];
            const Q = (Math.abs(q) * len) / 2;
            return { q, l: len, Q, d, dir, o: force(L, Q, d, LOADDIR[dir].ang) };
          };
          const halves: [DistPart, DistPart] = [tri('Q′', q1, l1, l1 / 3), tri('Q″', q2, l2, l1 + (2 * l2) / 3)];
          halves.forEach((p) => knowns.push(p.o));
          dists.push({ it, from, to, part, piece, q1, q2, l, Q: halves[0].Q, f: halves[0].d / l, d: halves[0].d, S, o: halves[0].o, split: { l1, parts: halves } });
          return;
        }
        const Q = ((q1 + q2) / 2) * l,
          f = Math.abs(q1 + q2) < 1e-12 ? 0.5 : (q1 + 2 * q2) / (3 * (q1 + q2));
        const o = force('Q', Q, f * l, ang);
        knowns.push(o);
        dists.push({ it, from, to, part, piece, q1, q2, l, Q, f, d: f * l, S, o, split: null });
      };
      // Шарниры внутри нагруженного участка делят нагрузку на куски — по одному на каждую часть.
      const path = pathNodes(g, it.from, it.to);
      const cuts = path.map((_, i) => i).filter((i) => i > 0 && i < path.length - 1 && parts.hinges.includes(path[i]));
      if (!cuts.length) addPiece(it.from, it.to, dg.P, dg.Q, dg.len, +it.q1, +it.q2, S, carrierOfPath(path), null);
      else {
        const bounds = [0, ...cuts, path.length - 1];
        const along = (id: string) => Math.hypot(g.pos[id][0] - dg.P[0], g.pos[id][1] - dg.P[1]);
        const qAt = (id: string) => +it.q1 + ((+it.q2 - +it.q1) * along(id)) / dg.len;
        for (let k = 0; k + 1 < bounds.length; k++) {
          const a = path[bounds[k]],
            b = path[bounds[k + 1]];
          const part = segPartBetween(path[bounds[k]], path[bounds[k] + 1]);
          addPiece(a, b, g.pos[a], g.pos[b], Math.abs(along(b) - along(a)), qAt(a), qAt(b), [S, roman(part)].filter(Boolean).join(','), part, {
            index: k,
            of: bounds.length - 1,
          });
        }
      }
    }
  }
  // Взаимные реакции во внутренних шарнирах: на часть j действуют X, Y; на первую часть шарнира — −X, −Y.
  const hingeActs: Action[] = [];
  for (const h of parts.hinges) {
    const P = g.name[h],
      ps = parts.nodeParts[h],
      [x, y] = g.pos[h];
    for (let j = 1; j < ps.length; j++) {
      const S = ps.length === 2 ? P : P + j;
      const hinge = { node: h, name: P, on: ps[j], from: ps[0] };
      for (const [L, dx, dy, angle] of [
        ['X', 1, 0, 0],
        ['Y', 0, 1, 90],
      ] as const) {
        const u: Unknown = { key: mkKey(L + '_' + S), L, S, kind: 'f', x, y, dx, dy, angle, s: 0, itemId: 'hinge:' + h, part: ps[j], hinge };
        unknowns.push(u);
        hingeActs.push(u, { ...u, dx: -dx, dy: -dy, angle: angle + 180, part: ps[0] });
      }
    }
  }
  const byKey: Record<string, Unknown> = {};
  unknowns.forEach((u) => (byKey[u.key] = u));
  const external: Action[] = [...unknowns.filter((u) => !u.hinge), ...knowns];
  const supIds = [...new Set(supports.map((q) => q.it.at))];
  const wholeEqs = (actions: Action[]) => {
    const mEq = (id: string) => makeEq('m', g.name[id], g.pos[id], actions);
    return [
      ...supIds.map(mEq),
      makeEq('x', null, null, actions),
      makeEq('y', null, null, actions),
      ...g.order.filter((id) => !supIds.includes(id)).map(mEq),
    ];
  };
  let cands: Eq[];
  if (parts.count === 1) cands = wholeEqs(external);
  else {
    cands = [];
    for (let p = 0; p < parts.count; p++) {
      const acts = [...external.filter((a) => a.part === p), ...hingeActs.filter((a) => a.part === p)];
      const nodes = g.order.filter((id) => parts.nodeParts[id].includes(p));
      const key = nodes.filter((id) => supIds.includes(id) || parts.hinges.includes(id));
      const mEq = (id: string) => makeEq('m', g.name[id], g.pos[id], acts, p);
      cands.push(...key.map(mEq), makeEq('x', null, null, acts, p), makeEq('y', null, null, acts, p), ...nodes.filter((id) => !key.includes(id)).map(mEq));
    }
    cands.push(...wholeEqs(external));
  }
  const partNames = Array.from({ length: parts.count }, (_, p) => g.order.filter((id) => parts.nodeParts[id].includes(p)).map((id) => g.name[id]));
  const w = Math.max(...pts.map((p) => p.x)),
    h = Math.max(...pts.map((p) => p.y));
  return { g, pts, unknowns, knowns, supports, dists, badDists, unkLoads, labels, byKey, cands, parts, partNames, w, h };
}
