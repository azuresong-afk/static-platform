/**
 * Сложение мгновенных движений твёрдого тела — кинематический винт (Мещерский 19.10, 19.12, 25.27–25.29).
 *
 * Вращение с угловой скоростью ω вокруг оси, проходящей через точку A, даёт точке O скорость (A − O) × ω — так же, как
 * сила, приложенная в A, даёт момент относительно O; поступательное движение со скоростью v — как пара с моментом v.
 * Поэтому система вращений и поступательных движений приводится к центру O так же, как система сил («Сходящиеся
 * силы», reduceSystem): главный вектор — угловая скорость тела ω = Σωᵢ, главный момент — скорость точки O.
 * Итог: покой; поступательное движение (ω = 0); вращение вокруг мгновенной оси (ω·v_O = 0); винтовое движение —
 * вращение вокруг мгновенной винтовой оси и поступательное движение вдоль неё со скоростью v_min = ω·v_O/|ω|.
 */
import { cross, reduceSystem, type ReduceResult, type V3 } from '../../converging/model/forces';
import { add3, type SPoint } from './compose';

export interface Rot {
  name: string;
  /** Точка оси. */
  p: V3;
  /** Направление оси (не обязательно единичное). */
  d: V3;
  /** Угловая скорость вдоль направления d. */
  w: number;
}
export interface Trans {
  name: string;
  v: V3;
}
export interface ScrewProblem {
  rots: Rot[];
  trans: Trans[];
  O: V3;
  points: SPoint[];
}
export interface ScrewResult {
  ok: true;
  /** Векторы угловых скоростей. */
  ws: V3[];
  red: ReduceResult;
  points: { name: string; r: V3; v: V3 }[];
}
export type ScrewOut = ScrewResult | { ok: false; error: string };

export function solveScrew(pr: ScrewProblem): ScrewOut {
  if (!pr.rots.length && !pr.trans.length) return { ok: false, error: 'Добавьте хотя бы одно вращение или поступательное движение.' };
  const ws: V3[] = [];
  for (const r of pr.rots) {
    const n = Math.hypot(...r.d);
    if (!(n > 0)) return { ok: false, error: `Вращение ${r.name}: направление оси не задано.` };
    ws.push([(r.d[0] / n) * r.w, (r.d[1] / n) * r.w, (r.d[2] / n) * r.w]);
  }
  const red = reduceSystem({
    forces: pr.rots.map((r, i) => ({ name: r.name, r: r.p, F: ws[i] })),
    pairs: pr.trans.map((t) => ({ name: t.name, M: t.v })),
    O: pr.O,
  });
  const points = pr.points.map((p) => {
    const r: V3 = [p.x, p.y, p.z];
    const rel: V3 = [r[0] - pr.O[0], r[1] - pr.O[1], r[2] - pr.O[2]];
    return { name: p.name, r, v: add3(red.M, cross(red.R, rel)) };
  });
  return { ok: true, ws, red, points };
}
