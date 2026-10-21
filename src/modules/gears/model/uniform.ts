/**
 * Равнопеременное вращение (Мещерский §13: 13.4–13.8): из пяти величин ω₀, ω, ε, t, φ известны любые три.
 *   ω = ω₀ + εt,   φ = ω₀t + εt²/2,   ω² − ω₀² = 2εφ,   φ = (ω₀ + ω)t/2.
 * φ — угол поворота за время t (при равнозамедленном вращении до остановки — полный угол).
 * Если в квадратном уравнении два корня, берём момент, когда значение достигается впервые.
 */
export type UniKey = 'w0' | 'w' | 'eps' | 't' | 'phi';
export const UNI_KEYS: UniKey[] = ['w0', 'w', 'eps', 't', 'phi'];

export interface UniProblem {
  w0: number;
  w: number;
  eps: number;
  t: number;
  phi: number;
  known: UniKey[];
  /** Единицы угловых скоростей и угла. */
  wUnit: 'rad' | 'rpm';
  phiUnit: 'rad' | 'turn';
}

export interface UniResult {
  ok: boolean;
  errors: string[];
  /** Все пять величин в рад/с, рад/с², с, рад. */
  w0: number;
  w: number;
  eps: number;
  t: number;
  phi: number;
  /** Какой парой формул найдены неизвестные. */
  how: string;
}

const W = (u: UniProblem['wUnit']) => (u === 'rpm' ? Math.PI / 30 : 1);
const P = (u: UniProblem['phiUnit']) => (u === 'turn' ? 2 * Math.PI : 1);

export function solveUniform(pr: UniProblem): UniResult {
  const errors: string[] = [];
  const kn = new Set(pr.known.filter((k) => UNI_KEYS.includes(k)));
  if (kn.size !== 3) errors.push(`Отметьте ровно три известные величины (сейчас ${kn.size}).`);
  for (const k of kn) if (!Number.isFinite(pr[k])) errors.push('Значения — числа.');
  if (kn.has('t') && !(pr.t > 0)) errors.push('Время t — положительное число.');
  const out: UniResult = { ok: false, errors, w0: 0, w: 0, eps: 0, t: 0, phi: 0, how: '' };
  if (errors.length) return out;
  let w0 = pr.w0 * W(pr.wUnit),
    w = pr.w * W(pr.wUnit),
    eps = pr.eps,
    t = pr.t,
    phi = pr.phi * P(pr.phiUnit);
  const miss = UNI_KEYS.filter((k) => !kn.has(k)).join(',');
  const fail = (m: string) => ({ ...out, errors: [m] });
  /** Наименьший положительный корень εt²/2 + ω₀t − φ = 0. */
  const tFrom = (a0: number, e: number, f: number): number | null => {
    if (Math.abs(e) < 1e-15) return Math.abs(a0) > 1e-15 && f / a0 > 0 ? f / a0 : null;
    const D = a0 * a0 + 2 * e * f;
    if (D < 0) return null;
    const rs = [(-a0 + Math.sqrt(D)) / e, (-a0 - Math.sqrt(D)) / e].filter((x) => x > 1e-12);
    return rs.length ? Math.min(...rs) : null;
  };
  let how = '';
  switch (miss) {
    case 'w0,w':
      w0 = phi / t - (eps * t) / 2;
      w = w0 + eps * t;
      how = 'ω₀ = φ/t − εt/2, ω = ω₀ + εt';
      break;
    case 'w0,eps':
      eps = (2 * (w * t - phi)) / (t * t);
      w0 = w - eps * t;
      how = 'φ = ωt − εt²/2 ⇒ ε = 2(ωt − φ)/t², ω₀ = ω − εt';
      break;
    case 'w0,t': {
      const D = w * w - 2 * eps * phi;
      if (D < 0) return fail('Нет решения: ω² − 2εφ < 0.');
      w0 = Math.sign(w || 1) * Math.sqrt(D);
      if (Math.abs(eps) < 1e-15) return fail('При ε = 0 время по этим данным не определить.');
      t = (w - w0) / eps;
      if (!(t > 0)) return fail('Нет решения: получается t ≤ 0.');
      how = 'ω₀² = ω² − 2εφ, t = (ω − ω₀)/ε';
      break;
    }
    case 'w0,phi':
      w0 = w - eps * t;
      phi = ((w0 + w) * t) / 2;
      how = 'ω₀ = ω − εt, φ = (ω₀ + ω)t/2';
      break;
    case 'w,eps':
      eps = (2 * (phi - w0 * t)) / (t * t);
      w = w0 + eps * t;
      how = 'φ = ω₀t + εt²/2 ⇒ ε = 2(φ − ω₀t)/t², ω = ω₀ + εt';
      break;
    case 'w,t': {
      const r = tFrom(w0, eps, phi);
      if (r == null) return fail('Нет решения: тело не повернётся на заданный угол.');
      t = r;
      w = w0 + eps * t;
      how = 'φ = ω₀t + εt²/2 — наименьший положительный корень, ω = ω₀ + εt';
      break;
    }
    case 'w,phi':
      w = w0 + eps * t;
      phi = w0 * t + (eps * t * t) / 2;
      how = 'ω = ω₀ + εt, φ = ω₀t + εt²/2';
      break;
    case 'eps,t':
      if (Math.abs(w0 + w) < 1e-15) return fail('Нет решения: ω₀ + ω = 0.');
      t = (2 * phi) / (w0 + w);
      if (!(t > 0)) return fail('Нет решения: получается t ≤ 0 (проверьте знаки φ, ω₀, ω).');
      eps = (w - w0) / t;
      how = 'φ = (ω₀ + ω)t/2 ⇒ t = 2φ/(ω₀ + ω), ε = (ω − ω₀)/t';
      break;
    case 'eps,phi':
      eps = (w - w0) / t;
      phi = ((w0 + w) * t) / 2;
      how = 'ε = (ω − ω₀)/t, φ = (ω₀ + ω)t/2';
      break;
    case 't,phi':
      if (Math.abs(eps) < 1e-15) return fail('При ε = 0 угловая скорость не меняется — время не определить.');
      t = (w - w0) / eps;
      if (!(t > 0)) return fail('Нет решения: при таком ε угловая скорость ω не достигается.');
      phi = ((w0 + w) * t) / 2;
      how = 't = (ω − ω₀)/ε, φ = (ω₀ + ω)t/2';
      break;
  }
  if (![w0, w, eps, t, phi].every(Number.isFinite)) return fail('Нет решения при этих данных.');
  return { ok: true, errors: [], w0, w, eps, t, phi, how };
}
