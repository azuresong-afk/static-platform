/**
 * Расчётная модель: неизвестные реакции, известные нагрузки, равнодействующие распределённых
 * нагрузок и уравнения-кандидаты. Аналог buildModel() прототипа без HTML.
 */
import { LOADDIR, REFS } from '../model/constants';
import { dirOf, type RefAxis } from '../model/format';
import { distGeom, resolve, type Geom, type PointItem } from '../model/geometry';
import type { DistItem, ForceItem, MomentItem, Structure, SupportItem, SupportType } from '../model/types';
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
}

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
  /** Уравнения-кандидаты в порядке предпочтения: моменты относительно опорных точек, ΣFx, ΣFy, моменты относительно остальных точек. */
  cands: Eq[];
  /** Габарит, м. */
  w: number;
  h: number;
}

export function buildModel(s: Structure): Model {
  const { g, items } = resolve(s);
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
        add(it.type === 'roller' ? 'R' : 'S', { kind: 'f', ...dirOf(angle), angle });
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
      };
      if (it.unknown) {
        const u = { ...o, key: mkKey('F' + S) };
        unknowns.push(u);
        unkLoads.push(u);
      } else knowns.push({ ...o, val: +it.F });
      labels[it.id] = { type: t, S, P: g.name[it.at] };
    } else if (it.type === 'weight') {
      knowns.push({ L: 'G', S, kind: 'f', x: it.x, y: it.y, dx: 0, dy: -1, angle: 270, s: 0, refAxis: 'h', val: +it.G, itemId: it.id });
      labels[it.id] = { type: t, S, P: g.name[it.at] };
    } else if (it.type === 'moment') {
      const o: Action = { L: 'M', S, kind: 'm', x: it.x, y: it.y, dx: 0, dy: 0, angle: 0, s: it.dir === 'ccw' ? 1 : -1, itemId: it.id, item: it };
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
      const q1 = +it.q1,
        q2 = +it.q2,
        l = dg.len,
        Q = ((q1 + q2) / 2) * l,
        f = Math.abs(q1 + q2) < 1e-12 ? 0.5 : (q1 + 2 * q2) / (3 * (q1 + q2));
      const xc = dg.P[0] + (dg.Q[0] - dg.P[0]) * f,
        yc = dg.P[1] + (dg.Q[1] - dg.P[1]) * f,
        ang = LOADDIR[it.dir].ang;
      const o: Known = { L: 'Q', S, kind: 'f', x: xc, y: yc, ...dirOf(ang), angle: ang, s: 0, refAxis: 'h', val: Q, itemId: it.id };
      knowns.push(o);
      dists.push({ it, q1, q2, l, Q, f, d: f * l, S, o });
    }
  }
  const byKey: Record<string, Unknown> = {};
  unknowns.forEach((u) => (byKey[u.key] = u));
  const actions: Action[] = [...unknowns, ...knowns];
  const supIds = [...new Set(supports.map((q) => q.it.at))];
  const mEq = (id: string) => makeEq('m', g.name[id], g.pos[id], actions);
  const cands = [
    ...supIds.map(mEq),
    makeEq('x', null, null, actions),
    makeEq('y', null, null, actions),
    ...g.order.filter((id) => !supIds.includes(id)).map(mEq),
  ];
  const w = Math.max(...pts.map((p) => p.x)),
    h = Math.max(...pts.map((p) => p.y));
  return { g, pts, unknowns, knowns, supports, dists, badDists, unkLoads, labels, byKey, cands, w, h };
}
