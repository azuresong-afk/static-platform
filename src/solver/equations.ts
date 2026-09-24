/**
 * Уравнения равновесия. Правило знаков прототипа: X — вправо, Y — вверх, моменты — против часовой.
 * Момент силы относительно точки P: M = Δx·Fy − Δy·Fx; в записи раскладывается на два слагаемых
 * (вертикальная составляющая на горизонтальное плечо и горизонтальная на вертикальное).
 */
import { acuteExpr, trigFactor, type TrigFactor } from '../model/format';
import type { Pt } from '../model/geometry';
import type { Action, Sym } from './model';

export type EqType = 'x' | 'y' | 'm';

/** Слагаемое уравнения: c·(значение), для записи — символ, тригонометрический множитель и плечо. */
export interface Term {
  c: number;
  key?: string;
  val?: number;
  sym: Sym;
  trig: TrigFactor | null;
  /** Плечо (модуль), м; null — слагаемое без плеча (проекция или пара). */
  arm: number | null;
  /** Какая составляющая силы входит в слагаемое. */
  comp: 'x' | 'y' | 'm';
  /** Точка приложения силы (для пояснения плеча). */
  at: [number, number];
}

export interface Eq {
  /** 'x', 'y' или 'm' + имя точки. */
  id: string;
  type: EqType;
  /** Точка, относительно которой берутся моменты. */
  P: string | null;
  /** Уравнение для одной части составной конструкции (номер части); нет — для всей конструкции. */
  part?: number;
  terms: Term[];
  /** Коэффициенты при неизвестных. */
  coeffs: Record<string, number>;
  /** Сумма известных слагаемых. */
  cst: number;
}

export function makeEq(type: EqType, P: string | null, pp: Pt | null, actions: Action[], part?: number): Eq {
  const e: Eq = { id: (part != null ? `p${part}:` : '') + type + (P || ''), type, P, terms: [], coeffs: {}, cst: 0 };
  if (part != null) e.part = part;
  const push = (a: Action, c: number, comp: Term['comp'], trig: TrigFactor | null, arm: number | null) => {
    if (Math.abs(c) < 1e-12) return;
    if (trig && a.angleName) trig = { ...trig, name: acuteExpr(a.userAngle ?? 0, a.angleName) };
    const t: Term = { c, sym: { L: a.L, S: a.S }, trig, arm, comp, at: [a.x, a.y] };
    if (a.key) {
      t.key = a.key;
      e.coeffs[a.key] = (e.coeffs[a.key] || 0) + c;
    } else {
      t.val = a.val;
      e.cst += c * (a.val as number);
    }
    e.terms.push(t);
  };
  for (const a of actions) {
    if (a.kind === 'f') {
      if (type === 'x') push(a, a.dx, 'x', trigFactor(a.angle, 'x', a.refAxis), null);
      else if (type === 'y') push(a, a.dy, 'y', trigFactor(a.angle, 'y', a.refAxis), null);
      else {
        const ax = a.x - pp![0],
          ay = a.y - pp![1];
        if (Math.abs(ax) > 1e-9) push(a, ax * a.dy, 'y', trigFactor(a.angle, 'y', a.refAxis), Math.abs(ax));
        if (Math.abs(ay) > 1e-9) push(a, -ay * a.dx, 'x', trigFactor(a.angle, 'x', a.refAxis), Math.abs(ay));
      }
    } else if (type === 'm') push(a, a.s, 'm', null, null);
  }
  for (const k in e.coeffs)
    if (Math.abs(e.coeffs[k]) < 1e-9) {
      delete e.coeffs[k];
      e.terms = e.terms.filter((t) => t.key !== k);
    }
  return e;
}

/** Сумма известных слагаемых при уже найденных неизвестных vals. */
export function known(e: Eq, vals: Record<string, number>): number {
  let K = e.cst;
  for (const k in e.coeffs) if (k in vals) K += e.coeffs[k] * vals[k];
  return K;
}
