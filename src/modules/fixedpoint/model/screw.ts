/**
 * Сложение мгновенных вращений и поступательных движений твёрдого тела (Мещерский 19.10, 19.12, 25.27–25.29):
 * главный вектор Ω = Σωᵢ, скорость начала координат v_O = Σ ωᵢ × (O − Aᵢ) + Σ vⱼ. Итог — кинематический винт:
 * наименьшая скорость v* = (v_O·Ω)/|Ω| — у точек мгновенной винтовой оси, проходящей через r* = Ω × v_O / Ω²
 * параллельно Ω; шаг p = v* / |Ω|. Ω = 0 — поступательное движение со скоростью v_O; v* = 0 — чистое вращение.
 */
import type { LenUnit } from './scheme';
import { clean, cross, dot, norm, vadd, vmul, vsub, type V3 } from './vec';

export interface ScrewItem {
  /** rot — вращение с вектором (x, y, z) вокруг оси через точку (px, py, pz); tr — поступательное со скоростью (x, y, z). */
  kind: 'rot' | 'tr';
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
}
export interface ScrewPoint {
  name: string;
  x: number;
  y: number;
  z: number;
}
export interface ScrewProblem {
  unit: LenUnit;
  items: ScrewItem[];
  points: ScrewPoint[];
}
export type ScrewKind = 'rest' | 'trans' | 'rot' | 'screw';
export interface ScrewResult {
  ok: boolean;
  errors: string[];
  Om: V3;
  vO: V3;
  /** Вклады движений в скорость начала координат. */
  parts: V3[];
  kind: ScrewKind;
  /** Наименьшая скорость (со знаком: проекция на Ω), шаг, точка оси, ближайшая к началу. */
  vmin: number;
  pitch: number;
  axisP: V3 | null;
  points: { name: string; r: V3; v: V3; d: number | null }[];
}

export const SCREW_LIMITS = { items: 10, points: 8 };

export function solveScrew(pr: ScrewProblem): ScrewResult {
  const errors: string[] = [];
  const nums = [...pr.items.flatMap((i) => [i.x, i.y, i.z, i.px, i.py, i.pz]), ...pr.points.flatMap((p) => [p.x, p.y, p.z])];
  if (!pr.items.length) errors.push('Добавьте вращение или поступательное движение.');
  if (pr.items.length > SCREW_LIMITS.items || pr.points.length > SCREW_LIMITS.points) errors.push('Слишком много движений или точек.');
  if (!nums.every(Number.isFinite)) errors.push('Есть незаполненные числа.');
  const zero: V3 = [0, 0, 0];
  if (errors.length) return { ok: false, errors, Om: zero, vO: zero, parts: [], kind: 'rest', vmin: 0, pitch: 0, axisP: null, points: [] };
  let Om: V3 = zero;
  const parts: V3[] = [];
  for (const it of pr.items) {
    const w: V3 = [it.x, it.y, it.z];
    if (it.kind === 'rot') {
      Om = vadd(Om, w);
      parts.push(cross(w, vsub(zero, [it.px, it.py, it.pz])));
    } else parts.push(w);
  }
  const scale = Math.max(1, ...pr.items.map((i) => Math.hypot(i.x, i.y, i.z)));
  Om = clean(Om, scale);
  const vO = clean(
    parts.reduce((s, p) => vadd(s, p), zero),
    scale,
  );
  const W = norm(Om),
    V = norm(vO);
  let kind: ScrewKind, vmin: number, pitch: number, axisP: V3 | null;
  if (W < 1e-12) {
    kind = V < 1e-12 ? 'rest' : 'trans';
    vmin = V;
    pitch = Infinity;
    axisP = null;
  } else {
    vmin = dot(vO, Om) / W;
    if (Math.abs(vmin) < 1e-12 * Math.max(1, V)) vmin = 0;
    pitch = vmin / W;
    axisP = clean(vmul(cross(Om, vO), 1 / (W * W)), scale);
    kind = vmin === 0 ? 'rot' : 'screw';
  }
  const points = pr.points.map((p) => {
    const r: V3 = [p.x, p.y, p.z];
    const v = clean(vadd(vO, cross(Om, r)), scale);
    const d = axisP ? norm(cross(vsub(r, axisP), vmul(Om, 1 / W))) : null;
    return { name: p.name, r, v, d };
  });
  return { ok: true, errors: [], Om, vO, parts, kind, vmin, pitch, axisP, points };
}
