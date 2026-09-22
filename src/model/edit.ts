/**
 * Операции редактирования конструкции. Чистые функции: принимают конструкцию и возвращают новую,
 * исходную не меняют. Правила и сообщения — как в прототипе.
 */
import { OPP } from './constants';
import { r3 } from './format';
import { geom, geomOK, resolve, type Geom } from './geometry';
import type { IdGen } from './ids';
import type { Dir, Item, ItemType, Side, Structure } from './types';

export type EditResult =
  | { ok: true; s: Structure }
  | { ok: false; reason: 'invalid' | 'overlap' | 'occupied' | 'noop'; msg?: string };

const clone = (s: Structure): Structure => structuredClone(s);

export const MAX_LEN = 1000;
const lenValid = (v: number) => !(isNaN(v) || v <= 0 || v > MAX_LEN);

/** Поставить новую точку на участке на расстоянии t от его начала. */
export function splitSeg(src: Structure, segId: string, t: number, ids: IdGen): EditResult {
  const s = clone(src);
  const q = s.segs.find((x) => x.id === segId);
  t = r3(t);
  if (!q || t <= 0.0005 || t >= q.len - 0.0005) return { ok: false, reason: 'invalid' };
  const n = { id: ids.node() },
    ns = { id: ids.seg(), a: n.id, b: q.b, dir: q.dir, len: r3(q.len - t) };
  q.b = n.id;
  q.len = t;
  s.nodes.push(n);
  s.segs.splice(s.segs.indexOf(q) + 1, 0, ns);
  return { ok: true, s };
}

/** Убрать участок: его конечный узел сливается с начальным, элементы переезжают туда же. */
export function removeSeg(src: Structure, segId: string): EditResult {
  const s = clone(src);
  const q = s.segs.find((x) => x.id === segId);
  if (!q || s.segs.length < 2) return { ok: false, reason: 'invalid' };
  const a = q.a,
    b = q.b;
  const aDirs = new Set<Dir>();
  s.segs.forEach((p) => {
    if (p === q) return;
    if (p.a === a) aDirs.add(p.dir);
    if (p.b === a) aDirs.add(OPP[p.dir]);
  });
  const bDirs: Dir[] = [];
  s.segs.forEach((p) => {
    if (p === q) return;
    if (p.a === b) bDirs.push(p.dir);
    if (p.b === b) bDirs.push(OPP[p.dir]);
  });
  if (bDirs.some((d) => aDirs.has(d)))
    return { ok: false, reason: 'overlap', msg: 'Этот участок нельзя убрать: соседние участки наложатся друг на друга.' };
  s.segs.forEach((p) => {
    if (p.a === b) p.a = a;
    if (p.b === b) p.b = a;
  });
  s.segs.splice(s.segs.indexOf(q), 1);
  // ПРОТОТИП (баг №7): geomOK проверяется, пока узел b ещё в списке узлов. Он уже недостижим,
  // число узлов не сходится, и проверка всегда проваливается — участок убрать нельзя.
  // Перенесено как есть; исправление (сначала убрать узел, потом проверять) — после согласования.
  if (!geomOK(s)) return { ok: false, reason: 'overlap', msg: 'Этот участок нельзя убрать: участки пересекутся.' };
  s.nodes = s.nodes.filter((n) => n.id !== b);
  s.items.forEach((it) => {
    if (it.type === 'dist') {
      if (it.from === b) it.from = a;
      if (it.to === b) it.to = a;
    } else if (it.at === b) it.at = a;
  });
  s.items = s.items.filter((it) => !(it.type === 'dist' && it.from === it.to));
  return { ok: true, s };
}

/** Новый участок из точки from в направлении dir. */
export function addSeg(src: Structure, from: string, dir: Dir, len: number, ids: IdGen): EditResult {
  if (!lenValid(len)) return { ok: false, reason: 'invalid', msg: 'Длина должна быть больше нуля.' };
  const g = geom(src);
  if (g.adj[from] && g.adj[from].has(dir))
    return { ok: false, reason: 'occupied', msg: 'Из этой точки в этом направлении уже идёт участок.' };
  const s = clone(src);
  const n = { id: ids.node() };
  s.nodes.push(n);
  s.segs.push({ id: ids.seg(), a: from, b: n.id, dir, len: r3(len) });
  if (!geomOK(s)) return { ok: false, reason: 'overlap', msg: 'Новый участок пересёк бы существующие.' };
  return { ok: true, s };
}

/** Изменить длину участка. */
export function setSegLen(src: Structure, segId: string, v: number): EditResult {
  const q0 = src.segs.find((x) => x.id === segId);
  if (!q0 || !lenValid(v)) return { ok: false, reason: 'invalid' };
  if (Math.abs(v - q0.len) < 1e-9) return { ok: false, reason: 'noop' };
  const s = clone(src);
  s.segs.find((x) => x.id === segId)!.len = r3(v);
  if (!geomOK(s)) return { ok: false, reason: 'overlap', msg: 'При такой длине участки пересекаются.' };
  return { ok: true, s };
}

/** Изменить направление участка. */
export function setSegDir(src: Structure, segId: string, dir: Dir): EditResult {
  const s = clone(src);
  const q = s.segs.find((x) => x.id === segId);
  if (!q) return { ok: false, reason: 'invalid' };
  q.dir = dir;
  if (!geomOK(s)) return { ok: false, reason: 'overlap', msg: 'В этом направлении участок наложится на другой.' };
  return { ok: true, s };
}

/* ---------- значения по умолчанию для новых элементов ---------- */

/** Сторона опорной поверхности, свободная от участков. */
export function pinSide(g: Geom, id: string): Side {
  const a = g.adj[id];
  return !a.has('d') ? 'below' : !a.has('l') ? 'left' : !a.has('r') ? 'right' : 'above';
}

/** Для заделки на конце участка — стена с противоположной стороны. */
export function fixedSide(g: Geom, id: string): Side {
  const a = g.adj[id];
  if (a.size === 1) return ({ r: 'left', l: 'right', u: 'below', d: 'above' } as const)[[...a][0]];
  return pinSide(g, id);
}

type NewItem<T extends ItemType> = Omit<Extract<Item, { type: T }>, 'id' | 'type'>;

/** Параметры нового элемента по умолчанию (как defaults() в прототипе). */
export function defaults<T extends ItemType>(s: Structure, type: T): NewItem<T> {
  const { g } = resolve(s);
  const o = g.order,
    first = o[0],
    last = o[o.length - 1],
    mid = o[Math.floor((o.length - 1) / 2)];
  const r = ((): object => {
    switch (type) {
      case 'fixed':
        return { at: first, side: fixedSide(g, first) };
      case 'pin':
        return { at: first, side: pinSide(g, first) };
      case 'roller':
        return { at: last, side: pinSide(g, last), angle: 90 };
      case 'rod':
        return { at: last, angle: 90 };
      case 'force':
        return { at: mid, F: 10, ref: 'down', rot: 'cw', alpha: 0, unknown: false };
      case 'weight':
        return { at: mid, G: 5 };
      case 'moment':
        return { at: mid, M: 8, dir: 'ccw', unknown: false };
      case 'dist': {
        let best = s.segs[0];
        s.segs.forEach((q) => {
          const h = q.dir === 'r' || q.dir === 'l',
            bh = best.dir === 'r' || best.dir === 'l';
          if ((h && !bh) || (h === bh && q.len > best.len)) best = q;
        });
        const h = best.dir === 'r' || best.dir === 'l';
        return { from: best.a, to: best.b, q1: 2, q2: 2, dir: h ? 'down' : 'right' };
      }
    }
    throw new Error('Неизвестный тип элемента: ' + type);
  })();
  return r as NewItem<T>;
}

/**
 * Добавить элемент с параметрами по умолчанию. Если на балке только две точки,
 * а добавляется сосредоточенная нагрузка, сначала ставится точка посередине — как в прототипе.
 */
export function addItem(src: Structure, type: ItemType, ids: IdGen): { s: Structure; id: string } {
  let s = src;
  if ((type === 'force' || type === 'weight' || type === 'moment') && s.nodes.length === 2) {
    const r = splitSeg(s, s.segs[0].id, s.segs[0].len / 2, ids);
    if (r.ok) s = r.s;
  }
  const id = ids.item();
  const it = { id, type, ...defaults(s, type) } as Item;
  return { s: { ...s, items: [...s.items, it] }, id };
}
