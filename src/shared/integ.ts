/**
 * Неопределённый интеграл формулы от t (константа интегрирования — 0) для класса, который встречается в кинематике:
 * суммы слагаемых c·tⁿ·F(kt + p), F — 1, sin, cos, exp (аргумент линейный по t). Произведения тригонометрических
 * функций и степени тригонометрических функций сводятся к суммам (формулы произведения); произведение exp с sin/cos
 * и всё остальное (дроби по t, корни, tg, ln) — не поддерживается: integrate возвращает null.
 */
import { evalExpr, simplify, type Expr } from './expr';

type F = '1' | 'sin' | 'cos' | 'exp';
interface Term {
  c: number;
  n: number;
  f: F;
  k: number;
  p: number;
  /** Аргумент в том виде, как его написал пользователь (для записи); иначе строится из k и p. */
  arg?: Expr;
}
const EPS = 1e-12;
const N = (v: number): Expr => ({ k: 'num', v });
const isInt = (x: number) => Math.abs(x - Math.round(x)) < 1e-12;

/** Линейная функция αt + β (null — не линейная). */
export function lin(e: Expr): { a: number; b: number } | null {
  switch (e.k) {
    case 'num':
      return { a: 0, b: e.v };
    case 't':
      return { a: 1, b: 0 };
    case 'neg': {
      const x = lin(e.a);
      return x && { a: -x.a, b: -x.b };
    }
    case 'add':
    case 'sub': {
      const x = lin(e.a),
        y = lin(e.b);
      if (!x || !y) return null;
      const s = e.k === 'add' ? 1 : -1;
      return { a: x.a + s * y.a, b: x.b + s * y.b };
    }
    case 'mul': {
      const x = lin(e.a),
        y = lin(e.b);
      if (!x || !y) return null;
      if (x.a === 0) return { a: x.b * y.a, b: x.b * y.b };
      if (y.a === 0) return { a: y.b * x.a, b: y.b * x.b };
      return null;
    }
    case 'div': {
      const x = lin(e.a),
        y = lin(e.b);
      return x && y && y.a === 0 && y.b !== 0 ? { a: x.a / y.b, b: x.b / y.b } : null;
    }
    default:
      return null;
  }
}

/** Приводит слагаемое с k = 0 к степенному. */
function norm(t: Term): Term {
  // cos чётный, sin нечётный: аргумент — с положительным множителем при t.
  if ((t.f === 'sin' || t.f === 'cos') && t.k < -EPS) return { ...t, c: t.f === 'sin' ? -t.c : t.c, k: -t.k, p: -t.p, arg: undefined };
  if (t.f === '1' || Math.abs(t.k) > EPS) return t;
  const v = t.f === 'sin' ? Math.sin(t.p) : t.f === 'cos' ? Math.cos(t.p) : Math.exp(t.p);
  return { c: t.c * v, n: t.n, f: '1', k: 0, p: 0 };
}

function mulT(x: Term, y: Term): Term[] | null {
  const n = x.n + y.n;
  if (x.f === '1') return [{ ...y, c: x.c * y.c, n }];
  if (y.f === '1') return [{ ...x, c: x.c * y.c, n }];
  const c = x.c * y.c;
  if (x.f === 'exp' && y.f === 'exp') return [norm({ c, n, f: 'exp', k: x.k + y.k, p: x.p + y.p })];
  if (x.f === 'exp' || y.f === 'exp') return null;
  const d = { k: x.k - y.k, p: x.p - y.p },
    s = { k: x.k + y.k, p: x.p + y.p };
  const T = (c2: number, f: 'sin' | 'cos', a: { k: number; p: number }) => norm({ c: c2, n, f, k: a.k, p: a.p });
  if (x.f === 'sin' && y.f === 'sin') return [T(c / 2, 'cos', d), T(-c / 2, 'cos', s)];
  if (x.f === 'cos' && y.f === 'cos') return [T(c / 2, 'cos', d), T(c / 2, 'cos', s)];
  // sin x · cos y = [sin(x + y) + sin(x − y)]/2; cos x · sin y — наоборот
  const [a, b] = x.f === 'sin' ? [x, y] : [y, x];
  return [T(c / 2, 'sin', { k: a.k + b.k, p: a.p + b.p }), T(c / 2, 'sin', { k: a.k - b.k, p: a.p - b.p })];
}

function terms(e: Expr): Term[] | null {
  switch (e.k) {
    case 'num':
      return [{ c: e.v, n: 0, f: '1', k: 0, p: 0 }];
    case 't':
      return [{ c: 1, n: 1, f: '1', k: 0, p: 0 }];
    case 'var':
      return null;
    case 'neg': {
      const x = terms(e.a);
      return x && x.map((q) => ({ ...q, c: -q.c }));
    }
    case 'add':
    case 'sub': {
      const x = terms(e.a),
        y = terms(e.b);
      if (!x || !y) return null;
      return [...x, ...y.map((q) => (e.k === 'sub' ? { ...q, c: -q.c } : q))];
    }
    case 'mul': {
      const x = terms(e.a),
        y = terms(e.b);
      if (!x || !y) return null;
      const out: Term[] = [];
      for (const p of x)
        for (const q of y) {
          const r = mulT(p, q);
          if (!r) return null;
          out.push(...r);
        }
      return out;
    }
    case 'div': {
      const x = terms(e.a),
        y = lin(e.b);
      return x && y && y.a === 0 && Math.abs(y.b) > EPS ? x.map((q) => ({ ...q, c: q.c / y.b })) : null;
    }
    case 'pow': {
      if (e.b.k !== 'num' || !isInt(e.b.v) || e.b.v < 0 || e.b.v > 6) return null;
      let acc: Term[] | null = [{ c: 1, n: 0, f: '1', k: 0, p: 0 }];
      const base = terms(e.a);
      if (!base) return null;
      for (let i = 0; i < Math.round(e.b.v) && acc; i++) {
        const next: Term[] = [];
        for (const p of acc)
          for (const q of base) {
            const r = mulT(p, q);
            if (!r) return null;
            next.push(...r);
          }
        acc = next;
      }
      return acc;
    }
    case 'fn': {
      if (e.f !== 'sin' && e.f !== 'cos' && e.f !== 'exp') return null;
      const a = lin(e.a);
      if (!a) return null;
      return [norm({ c: 1, n: 0, f: e.f, k: a.a, p: a.b, arg: e.a })];
    }
  }
}

const key = (t: Term) => `${t.f}|${t.n}|${t.f === '1' ? 0 : +t.k.toPrecision(10)}|${t.f === '1' ? 0 : +t.p.toPrecision(10)}`;
function merge(ts: Term[]): Term[] {
  const m = new Map<string, Term>();
  for (const t of ts) {
    const k = key(t),
      o = m.get(k);
    if (o) o.c += t.c;
    else m.set(k, { ...t });
  }
  return [...m.values()].filter((t) => Math.abs(t.c) > EPS).sort((a, b) => b.n - a.n || (a.f < b.f ? -1 : a.f > b.f ? 1 : 0));
}

/** ∫ tⁿ·F(kt + p) dt (k ≠ 0 для sin, cos, exp). */
function antider(t: Term): Term[] {
  const { n, f, k, p, arg } = t;
  const mk = (c: number, nn: number, ff: F): Term => ({ c, n: nn, f: ff, k, p, arg });
  if (f === '1') return [{ c: t.c / (n + 1), n: n + 1, f: '1', k: 0, p: 0 }];
  if (f === 'exp') {
    const out: Term[] = [];
    let coef = t.c / k,
      j = 0;
    for (let m = n; m >= 0; m--, j++) {
      out.push(mk(coef, m, 'exp'));
      coef *= -m / k;
    }
    return out.filter((q) => Math.abs(q.c) > EPS);
  }
  // sin: ∫ tⁿ sin = −tⁿ cos/k + (n/k) ∫ tⁿ⁻¹ cos;  cos: ∫ tⁿ cos = tⁿ sin/k − (n/k) ∫ tⁿ⁻¹ sin
  const out: Term[] = [];
  const first = f === 'sin' ? -1 / k : 1 / k;
  out.push(mk(t.c * first, n, f === 'sin' ? 'cos' : 'sin'));
  if (n > 0) {
    const sgn = f === 'sin' ? n / k : -n / k;
    out.push(...antider({ ...mk(t.c * sgn, n - 1, f === 'sin' ? 'cos' : 'sin') }));
  }
  return out;
}

/** Число с узнаваемым π: 2π, (π/2), π², (4/π); иначе — обычная запись (4 знака). */
export function fmtPi(v: number): string {
  const plain = () => {
    const r = Math.round(v * 1e4) / 1e4;
    return (Math.abs(r - Math.round(r)) < 1e-12 ? String(Math.round(r)) : String(r)).replace('.', ',').replace('-', '−');
  };
  if (v === 0 || isInt(v)) return plain();
  const sgn = v < 0 ? '−' : '';
  const x = Math.abs(v);
  for (const pw of [1, 2, -1]) {
    const base = x / Math.PI ** pw;
    for (let q = 1; q <= 8; q++) {
      const m = Math.round(base * q);
      if (m < 1 || m > 99 || Math.abs(base * q - m) > 1e-9) continue;
      const sym = pw === 1 ? 'π' : pw === 2 ? 'π²' : 'π';
      let s: string;
      if (pw === -1) s = q === 1 ? `(${m}/π)` : `(${m}/(${q}π))`;
      else s = q === 1 ? `${m === 1 ? '' : m}${sym}` : `(${m === 1 ? '' : m}${sym}/${q})`;
      return sgn + s;
    }
  }
  return plain();
}

function build(t: Term): Expr {
  let e: Expr | null = null;
  const mul = (a: Expr | null, b: Expr): Expr => (a ? { k: 'mul', a, b } : b);
  if (t.n > 0) e = t.n === 1 ? { k: 't' } : { k: 'pow', a: { k: 't' }, b: N(t.n) };
  if (t.f !== '1') {
    const arg: Expr =
      t.arg ??
      (Math.abs(t.p) < EPS
        ? Math.abs(t.k - 1) < EPS
          ? { k: 't' }
          : { k: 'mul', a: N(t.k), b: { k: 't' } }
        : { k: 'add', a: Math.abs(t.k - 1) < EPS ? { k: 't' } : { k: 'mul', a: N(t.k), b: { k: 't' } }, b: N(t.p) });
    e = mul(e, { k: 'fn', f: t.f, a: arg });
  }
  const c = Math.abs(t.c - 1) < EPS && e ? null : N(t.c);
  if (!e) return N(t.c);
  return c ? { k: 'mul', a: c, b: e } : e;
}

function toExpr(ts: Term[]): Expr {
  const m = merge(ts);
  if (!m.length) return N(0);
  return simplify(m.map(build).reduce((a, b) => ({ k: 'add', a, b })));
}

/** Первообразная (константа 0) или null, если формула вне поддерживаемого класса. */
export function integrate(e: Expr): Expr | null {
  const ts = terms(e);
  if (!ts) return null;
  return toExpr(merge(ts).flatMap(antider));
}

/** Первообразная, равная c в момент t₀: F(t) − F(t₀) + c. */
export function integrateFrom(e: Expr, t0: number, c: number): Expr | null {
  const F = integrate(e);
  if (!F) return null;
  const k = c - evalExpr(F, t0);
  return simplify(Math.abs(k) < EPS ? F : { k: 'add', a: F, b: N(k) });
}
