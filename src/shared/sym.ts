/**
 * Символьные выражения от нескольких переменных — для уравнений Лагранжа: разбор, сложение и умножение
 * с приведением подобных, частные производные, полная производная по времени, запись и вычисление.
 *
 * Выражение — сумма членов; член — коэффициент × произведение «атомов» в степенях. Атомы:
 *   var  — обобщённая координата q (ord 0), её скорость q̇ (ord 1) и ускорение q̈ (ord 2) или параметр (m, l, g…);
 *   t    — время;
 *   fn   — функция от выражения (sin φ, cos(φ − ψ), ln x…);
 *   grp  — сумма в степени: (l + rφ)², 1/(m₁ + m₂), √(a² − x²).
 * Суммы без скоростей и ускорений (l + rφ, m₁ + m₂) в произведениях и степенях остаются скобками —
 * так сохраняются общие множители, и уравнение можно на них сократить. Суммы со скоростями раскрываются:
 * кинетическая энергия должна быть многочленом от скоростей, иначе подобные не приводятся.
 */

export type Fn = 'sin' | 'cos' | 'tg' | 'ctg' | 'arctg' | 'arcsin' | 'arccos' | 'exp' | 'ln' | 'sh' | 'ch' | 'th' | 'abs';

export type Atom = { k: 'var'; name: string; ord: number } | { k: 't' } | { k: 'fn'; f: Fn; a: Sym } | { k: 'grp'; a: Sym };
export interface Term {
  c: number;
  /** Атомы и степени, упорядочены по ключу. */
  f: [Atom, number][];
}
/** Сумма членов в каноническом виде (подобные приведены, нулевые выброшены, порядок — по ключу). */
export type Sym = Term[];

const EPS = 1e-12;

export function atomKey(a: Atom): string {
  switch (a.k) {
    case 'var':
      return a.name + "'".repeat(a.ord);
    case 't':
      return 't';
    case 'fn':
      return a.f + '(' + symKey(a.a) + ')';
    case 'grp':
      return '(' + symKey(a.a) + ')';
  }
}
const termKey = (t: Term) => t.f.map(([a, p]) => atomKey(a) + '^' + p).join('*');
export const symKey = (s: Sym) => s.map((t) => (+t.c.toPrecision(12)).toString() + '·' + termKey(t)).join('+');

export const num = (c: number): Sym => (Math.abs(c) < EPS ? [] : [{ c, f: [] }]);
export const atom = (a: Atom, p = 1): Sym => [{ c: 1, f: [[a, p]] }];
export const variable = (name: string, ord = 0): Sym => atom({ k: 'var', name, ord });
export const time = (): Sym => atom({ k: 't' });

/** Приведение подобных и упорядочивание. */
function canon(terms: Term[]): Sym {
  const m = new Map<string, Term>();
  for (const t of terms) {
    if (!Number.isFinite(t.c) || t.c === 0) {
      if (!Number.isFinite(t.c)) m.set('NaN' + m.size, t);
      continue;
    }
    const f = t.f.filter(([, p]) => p !== 0);
    const k = termKey({ c: 1, f });
    const o = m.get(k);
    if (o) o.c += t.c;
    else m.set(k, { c: t.c, f });
  }
  const scale = Math.max(1, ...[...m.values()].map((t) => Math.abs(t.c)));
  return [...m.entries()]
    .filter(([, t]) => Math.abs(t.c) > EPS * scale || !Number.isFinite(t.c))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, t]) => t);
}

export const add = (...xs: Sym[]): Sym => canon(xs.flat().map((t) => ({ c: t.c, f: t.f })));
export const scale = (s: Sym, k: number): Sym => canon(s.map((t) => ({ c: t.c * k, f: t.f })));
export const neg = (s: Sym): Sym => scale(s, -1);
export const sub = (a: Sym, b: Sym): Sym => add(a, neg(b));

/** Есть ли скорости или ускорения (в том числе внутри функций и скобок). */
export function hasVel(s: Sym): boolean {
  return s.some((t) => t.f.some(([a]) => (a.k === 'var' && a.ord > 0) || ((a.k === 'fn' || a.k === 'grp') && hasVel(a.a))));
}

function mulTerm(x: Term, y: Term): Term {
  const m = new Map<string, [Atom, number]>();
  for (const [a, p] of [...x.f, ...y.f]) {
    const k = atomKey(a);
    const o = m.get(k);
    if (o) o[1] += p;
    else m.set(k, [a, p]);
  }
  const f = [...m.entries()]
    .filter(([, [, p]]) => Math.abs(p) > 1e-12)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, v]) => v);
  return { c: x.c * y.c, f };
}

/** Член — степень суммы (скобка): общий одночленный множитель выносится, первый член в скобке — с коэффициентом 1. */
function groupTerm(s: Sym, p: number): Term {
  // Общие атомы с наименьшей степенью.
  let common: [Atom, number][] = s[0].f.map(([a, q]) => [a, q]);
  for (const t of s.slice(1)) {
    common = common
      .map(([a, q]) => {
        const hit = t.f.find(([b]) => atomKey(b) === atomKey(a));
        return hit ? ([a, Math.min(q, hit[1])] as [Atom, number]) : null;
      })
      .filter((x): x is [Atom, number] => !!x && x[1] > 0);
  }
  let inner = s;
  if (common.length) {
    const inv: Term = { c: 1, f: common.map(([a, q]) => [a, -q]) };
    inner = canon(s.map((t) => mulTerm(t, inv)));
  }
  const lead = inner[0].c;
  const c0 = Number.isInteger(p) ? lead : Math.abs(lead);
  inner = canon(inner.map((t) => ({ c: t.c / c0, f: t.f })));
  const outside: Term = { c: Math.pow(c0, p), f: common.map(([a, q]) => [a, q * p]) };
  if (inner.length === 1) return mulTerm(outside, powTerm(inner[0], p));
  return mulTerm(outside, { c: 1, f: [[{ k: 'grp', a: inner }, p]] });
}

function powTerm(t: Term, p: number): Term {
  return { c: Math.pow(t.c, p), f: t.f.map(([a, q]) => [a, q * p]) };
}

/** Сумма как множитель: без скоростей и из нескольких членов — скобка. */
const asFactor = (s: Sym): Sym => (s.length > 1 && !hasVel(s) ? [groupTerm(s, 1)] : s);

export function mul(...xs: Sym[]): Sym {
  let acc: Sym = num(1);
  for (const x0 of xs) {
    const x = asFactor(x0);
    const out: Term[] = [];
    for (const a of acc) for (const b of x) out.push(mulTerm(a, b));
    acc = canon(out);
  }
  return acc;
}

export function pow(s: Sym, p: number): Sym {
  if (p === 0) return num(1);
  if (p === 1) return s;
  if (!s.length) return p > 0 ? [] : num(NaN);
  if (s.length === 1) {
    const t = s[0];
    if (t.c < 0 && !Number.isInteger(p)) return canon([{ c: 1, f: [[{ k: 'grp', a: s }, p]] }]);
    return canon([powTerm(t, p)]);
  }
  if (hasVel(s) && Number.isInteger(p) && p > 0 && p <= 6) {
    let acc = s;
    for (let i = 1; i < p; i++) acc = mul(acc, s);
    return acc;
  }
  return canon([groupTerm(s, p)]);
}

export const div = (a: Sym, b: Sym): Sym => mul(a, pow(b, -1));

/** Число, если выражение — константа. */
export function constOf(s: Sym): number | null {
  if (!s.length) return 0;
  if (s.length === 1 && !s[0].f.length) return s[0].c;
  return null;
}

const ODD: Fn[] = ['sin', 'tg', 'ctg', 'arctg', 'arcsin', 'sh', 'th'];
const EVEN: Fn[] = ['cos', 'ch', 'abs'];
const NUM: Record<Fn, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tg: Math.tan,
  ctg: (x) => 1 / Math.tan(x),
  arctg: Math.atan,
  arcsin: Math.asin,
  arccos: Math.acos,
  exp: Math.exp,
  ln: Math.log,
  sh: Math.sinh,
  ch: Math.cosh,
  th: Math.tanh,
  abs: Math.abs,
};

export function fn(f: Fn, a: Sym): Sym {
  const c = constOf(a);
  if (c !== null) return num(NUM[f](c));
  // Чётность: sin(−u) = −sin u, cos(−u) = cos u — аргумент с положительным первым членом.
  if (a[0].c < 0 && (ODD.includes(f) || EVEN.includes(f))) {
    const r = atom({ k: 'fn', f, a: neg(a) });
    return ODD.includes(f) ? neg(r) : r;
  }
  if (f === 'ln' && a.length === 1 && a[0].f.length === 0) return num(Math.log(a[0].c));
  return atom({ k: 'fn', f, a });
}
export const sqrt = (a: Sym): Sym => pow(a, 0.5);

/** Как дифференцировать: по времени (полная производная) или частная — по атому-переменной (по имени и порядку). */
export type Wrt = { k: 'time'; isCoord: (name: string) => boolean } | { k: 'var'; name: string; ord: number };

function dAtom(a: Atom, w: Wrt): Sym {
  switch (a.k) {
    case 'var':
      if (w.k === 'var') return w.name === a.name && w.ord === a.ord ? num(1) : [];
      if (!w.isCoord(a.name)) return [];
      if (a.ord >= 2) throw new Error('нужна третья производная координаты — в выражение вошло ускорение');
      return variable(a.name, a.ord + 1);
    case 't':
      return w.k === 'time' ? num(1) : [];
    case 'grp':
      return d(a.a, w);
    case 'fn': {
      const u = a.a,
        du = d(u, w);
      if (!du.length) return [];
      const one = num(1);
      const outer: Record<Fn, () => Sym> = {
        sin: () => fn('cos', u),
        cos: () => neg(fn('sin', u)),
        tg: () => pow(fn('cos', u), -2),
        ctg: () => neg(pow(fn('sin', u), -2)),
        arctg: () => pow(add(one, pow(u, 2)), -1),
        arcsin: () => pow(sub(one, pow(u, 2)), -0.5),
        arccos: () => neg(pow(sub(one, pow(u, 2)), -0.5)),
        exp: () => fn('exp', u),
        ln: () => pow(u, -1),
        sh: () => fn('ch', u),
        ch: () => fn('sh', u),
        th: () => pow(fn('ch', u), -2),
        abs: () => mul(u, pow(fn('abs', u), -1)),
      };
      return mul(outer[a.f](), du);
    }
  }
}

/** Производная: частная по переменной или полная по времени (по правилу дифференцирования сложной функции). */
export function d(s: Sym, w: Wrt): Sym {
  const out: Sym[] = [];
  for (const t of s)
    t.f.forEach(([a, p], i) => {
      const da = dAtom(a, w);
      if (!da.length) return;
      const rest: Term = { c: t.c * p, f: t.f.map(([b, q], j) => [b, j === i ? q - 1 : q] as [Atom, number]) };
      out.push(mul([rest], da));
    });
  return add(...out);
}

/** Подстановка: атомы-переменные, для которых sub возвращает выражение, заменяются им. */
export function subst(s: Sym, f: (a: Atom & { k: 'var' }) => Sym | null): Sym {
  const out: Sym[] = [];
  for (const t of s) {
    let acc: Sym = num(t.c);
    for (const [a, p] of t.f) {
      let x: Sym;
      if (a.k === 'var') x = f(a) ?? atom(a);
      else if (a.k === 'fn') x = fn(a.f, subst(a.a, f));
      else if (a.k === 'grp') x = subst(a.a, f);
      else x = atom(a);
      acc = mul(acc, pow(x, p));
    }
    out.push(acc);
  }
  return add(...out);
}

/** Раскрыть все скобки в целых положительных степенях (для проверки, что выражение — нуль). */
export function expand(s: Sym): Sym {
  const out: Sym[] = [];
  for (const t of s) {
    let acc: Sym = num(t.c);
    for (const [a, p] of t.f) {
      if (a.k === 'grp' && Number.isInteger(p) && p > 0) {
        const inner = expand(a.a);
        for (let i = 0; i < p; i++) acc = mulExpand(acc, inner);
      } else acc = mulExpand(acc, [{ c: 1, f: [[a, p]] }]);
    }
    out.push(acc);
  }
  return add(...out);
}
function mulExpand(a: Sym, b: Sym): Sym {
  const out: Term[] = [];
  for (const x of a) for (const y of b) out.push(mulTerm(x, y));
  return canon(out);
}

/** sin²u + cos²u = 1 при одинаковых остальных множителях. */
export function trigSimplify(s: Sym): Sym {
  let cur = s;
  for (let guard = 0; guard < 20; guard++) {
    let changed = false;
    outer: for (const t of cur) {
      for (const [a, p] of t.f) {
        if (a.k !== 'fn' || a.f !== 'sin' || p < 2 || !Number.isInteger(p)) continue;
        const cosA: Atom = { k: 'fn', f: 'cos', a: a.a };
        const want: Term = mulTerm(mulTerm({ c: 1, f: t.f }, { c: 1, f: [[a, -2]] }), { c: 1, f: [[cosA, 2]] });
        const k = termKey(want);
        const twin = cur.find((u) => termKey(u) === k && Math.abs(u.c - t.c) <= 1e-12 * Math.max(1, Math.abs(t.c)));
        if (!twin) continue;
        const base: Term = mulTerm({ c: t.c, f: t.f }, { c: 1, f: [[a, -2]] });
        cur = add(
          cur.filter((u) => u !== t && u !== twin),
          [base],
        );
        changed = true;
        break outer;
      }
    }
    if (!changed) break;
  }
  return cur;
}

/** Общий множитель всех членов (атомы в наименьших степенях и общий числовой множитель) и частное. */
export function commonFactor(s: Sym): { factor: Term; rest: Sym } {
  if (!s.length) return { factor: { c: 1, f: [] }, rest: s };
  let common: [Atom, number][] = s[0].f.map(([a, q]) => [a, q]);
  for (const t of s.slice(1))
    common = common
      .map(([a, q]) => {
        const hit = t.f.find(([b]) => atomKey(b) === atomKey(a));
        if (!hit) return null;
        // Только степени одного знака: (l + rφ)² и (l + rφ) → (l + rφ); x и 1/x — общего нет.
        if (Math.sign(hit[1]) !== Math.sign(q)) return null;
        return [a, Math.sign(q) * Math.min(Math.abs(q), Math.abs(hit[1]))] as [Atom, number];
      })
      .filter((x): x is [Atom, number] => !!x);
  // Скорости и ускорения не выносим: на них уравнение не сокращают.
  common = common.filter(([a]) => !(a.k === 'var' && a.ord > 0));
  const cs = s.map((t) => Math.abs(t.c));
  const allSame = cs.every((c) => Math.abs(c - cs[0]) <= 1e-12 * cs[0]);
  // Знак — как у члена с ускорением (чтобы он вышел положительным), иначе как у первого.
  const lead = s.find((t) => t.f.some(([a]) => a.k === 'var' && a.ord === 2)) ?? s[0];
  const c = (allSame ? cs[0] : 1) * Math.sign(lead.c);
  const factor: Term = { c, f: common };
  const inv: Term = { c: 1 / c, f: common.map(([a, q]) => [a, -q]) };
  return { factor, rest: canon(s.map((t) => mulTerm(t, inv))) };
}

/** Значение при заданных значениях переменных (val(name, ord)) и времени. */
export function evalSym(s: Sym, val: (name: string, ord: number) => number, t = 0): number {
  let sum = 0;
  for (const term of s) {
    let x = term.c;
    for (const [a, p] of term.f) {
      let v: number;
      if (a.k === 'var') v = val(a.name, a.ord);
      else if (a.k === 't') v = t;
      else if (a.k === 'grp') v = evalSym(a.a, val, t);
      else v = NUM[a.f](evalSym(a.a, val, t));
      x *= p === 1 ? v : p === 0.5 ? Math.sqrt(v) : Math.pow(v, p);
    }
    sum += x;
  }
  return sum;
}

/** Переменные, входящие в выражение (имя и порядок). */
export function varsOf(s: Sym, out = new Map<string, { name: string; ord: number }>()): Map<string, { name: string; ord: number }> {
  for (const t of s)
    for (const [a] of t.f) {
      if (a.k === 'var') out.set(atomKey(a), { name: a.name, ord: a.ord });
      else if (a.k === 'fn' || a.k === 'grp') varsOf(a.a, out);
    }
  return out;
}
export const usesTime = (s: Sym): boolean => s.some((t) => t.f.some(([a]) => a.k === 't' || ((a.k === 'fn' || a.k === 'grp') && usesTime(a.a))));

/* ───────────── Запись ───────────── */

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
const supNum = (n: number) => String(n).replace(/./g, (ch) => SUP[ch] ?? ch);

/** Дробь для «красивых» коэффициентов: 0,5 → «1/2», 0,333… → «1/3»; иначе десятичная запись. */
export function fracText(x: number): string {
  const sgn = x < 0 ? '−' : '';
  const a = Math.abs(x);
  if (Math.abs(a - Math.round(a)) < 1e-9 * Math.max(1, a)) return sgn + String(Math.round(a));
  for (let q = 2; q <= 12; q++) {
    const p = Math.round(a * q);
    if (Math.abs(a * q - p) < 1e-9 * Math.max(1, a * q)) return `${sgn}${p}/${q}`;
  }
  return sgn + (+a.toPrecision(6)).toString().replace('.', ',');
}

/** Имя переменной с точками: φ̇, ẍ. */
export function varName(name: string, ord: number): string {
  if (!ord) return name;
  const mark = ord === 1 ? '\u0307' : '\u0308';
  // Точка ставится над буквой: m₁ → ṁ₁ (над первой буквой, если дальше цифры/индекс).
  const m = /^(\p{L})(.*)$/u.exec(name);
  return (m ? m[1] + mark + m[2] : name + "'".repeat(ord)).normalize('NFC');
}

const SUBDIG: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
/** m1 → m₁ для показа. */
export const prettyName = (n: string) => n.replace(/(\p{L})(\d+)$/u, (_, l: string, d: string) => l + d.replace(/\d/g, (x) => SUBDIG[x]));

function atomText(a: Atom): string {
  switch (a.k) {
    case 'var':
      return varName(prettyName(a.name), a.ord);
    case 't':
      return 't';
    case 'grp':
      return '(' + symText(a.a) + ')';
    case 'fn': {
      const single = a.a.length === 1 && a.a[0].c === 1 && a.a[0].f.length === 1 && a.a[0].f[0][1] === 1 && a.a[0].f[0][0].k !== 'grp';
      return a.f + (single ? ' ' + symText(a.a) : '(' + symText(a.a) + ')');
    }
  }
}
function powText(a: Atom, p: number): string {
  if (p === 1) return atomText(a);
  if (p === 0.5) return a.k === 'grp' ? '√' + atomText(a) : '√' + atomText(a);
  if (a.k === 'fn' && Number.isInteger(p)) {
    // sin²φ
    const t = atomText(a);
    return a.f + supNum(p) + t.slice(a.f.length);
  }
  return atomText(a) + (Number.isInteger(p) ? supNum(p) : '^' + fracText(p));
}

/** Порядок множителей в члене: числа, параметры, скобки, функции, координаты, скорости, ускорения. */
function rank(a: Atom, isCoord: (n: string) => boolean): number {
  if (a.k === 'var') return a.ord === 2 ? 6 : a.ord === 1 ? 5 : isCoord(a.name) ? 3 : 0;
  if (a.k === 'grp') return 1;
  if (a.k === 't') return 2;
  // sin φ·cos φ — сначала синус.
  return a.f === 'sin' ? 4 : a.f === 'cos' ? 4.1 : 4.2;
}

let coordTest: (n: string) => boolean = () => false;
/** Какие имена — координаты (для порядка множителей при записи). */
export function setCoordNames(names: string[]) {
  const s = new Set(names);
  coordTest = (n) => s.has(n);
}

export function termText(t: Term, first: boolean): string {
  const f = [...t.f].sort((x, y) => rank(x[0], coordTest) - rank(y[0], coordTest));
  const numr = f.filter(([, p]) => p > 0).map(([a, p]) => powText(a, p));
  const den = f.filter(([, p]) => p < 0).map(([a, p]) => powText(a, -p));
  const c = Math.abs(t.c);
  const sign = t.c < 0 ? (first ? '−' : ' − ') : first ? '' : ' + ';
  let cs = fracText(c);
  let body: string;
  if (cs.includes('/') && numr.length) {
    // 1/2·m·v² → m·v²/2
    const [p, q] = cs.split('/');
    body = (p === '1' ? '' : p + '·') + numr.join('·');
    den.unshift(q);
    cs = '';
  } else body = (c === 1 && numr.length ? '' : cs + (numr.length ? '·' : '')) + numr.join('·');
  if (!body) body = '1';
  const bare = den.length === 1 && (!/[·+−\s/]/.test(den[0]) || /^\([^()]*\)[²³⁴]?$/.test(den[0]));
  if (den.length) body += '/' + (bare ? den[0] : '(' + den.join('·') + ')');
  return sign + body;
}

/** Порядок членов: сначала с ускорениями, потом со скоростями, потом остальные. */
function termRank(t: Term): number {
  const ords = t.f.map(([a]) => (a.k === 'var' ? a.ord : 0));
  const mx = Math.max(0, ...ords);
  return mx === 2 ? 0 : mx === 1 ? 1 : 2;
}

export function symText(s: Sym): string {
  if (!s.length) return '0';
  const sorted = [...s].sort((a, b) => termRank(a) - termRank(b));
  return sorted.map((t, i) => termText(t, i === 0)).join('');
}

/* ───────────── Разбор ───────────── */

const FN_ALIAS: Record<string, Fn> = {
  sin: 'sin',
  cos: 'cos',
  tg: 'tg',
  tan: 'tg',
  ctg: 'ctg',
  cot: 'ctg',
  arctg: 'arctg',
  atan: 'arctg',
  arcsin: 'arcsin',
  asin: 'arcsin',
  arccos: 'arccos',
  acos: 'arccos',
  exp: 'exp',
  ln: 'ln',
  sh: 'sh',
  sinh: 'sh',
  ch: 'ch',
  cosh: 'ch',
  th: 'th',
  tanh: 'th',
  abs: 'abs',
};
/** Греческие буквы латиницей: phi → φ. */
export const GREEK: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  phi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
};

export interface SymContext {
  /** Обобщённые координаты (могут быть со штрихами: x', φ''). */
  coords: string[];
  /** Параметры (постоянные). */
  params: string[];
}

export type SymParse = { ok: true; s: Sym } | { ok: false; error: string };

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string; ord: number } | { t: 'fn'; v: Fn | 'sqrt' } | { t: 'op'; v: string };

/** Нормализация имени: латинские названия греческих букв → буквы. */
export function normName(n: string): string {
  return GREEK[n.toLowerCase()] ?? n;
}

function tokenize(src: string, ctx: SymContext): Tok[] | string {
  const names = [...ctx.coords, ...ctx.params].map(normName);
  const s = src
    .normalize('NFD')
    .replace(/[−–]/g, '-')
    .replace(/[·×]/g, '*')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\u0307/g, "'")
    .replace(/\u0308/g, "''")
    .replace(/√/g, 'sqrt');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || ((c === '.' || c === ',') && /[0-9]/.test(s[i + 1] ?? ''))) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      if ((s.slice(i, j).match(/[.,]/g) ?? []).length > 1) return `неверное число «${s.slice(i, j)}»`;
      out.push({ t: 'num', v: Number(s.slice(i, j).replace(',', '.')) });
      i = j;
      continue;
    }
    if (/[\p{L}_]/u.test(c)) {
      let j = i;
      while (j < s.length && /[\p{L}\p{N}_]/u.test(s[j])) j++;
      let word = s.slice(i, j);
      i = j;
      // Разбиваем слитное «mgl» или «2πt» на известные слова — длинные сначала.
      const pieces: Tok[] = [];
      while (word.length) {
        const lower = word.toLowerCase();
        const cands: [string, Tok][] = [];
        for (const n of names) if (word.startsWith(n)) cands.push([n, { t: 'id', v: n, ord: 0 }]);
        for (const [g, ch] of Object.entries(GREEK)) if (lower.startsWith(g) && names.includes(ch)) cands.push([g, { t: 'id', v: ch, ord: 0 }]);
        for (const [a, f] of Object.entries(FN_ALIAS)) if (lower.startsWith(a)) cands.push([a, { t: 'fn', v: f }]);
        if (lower.startsWith('sqrt')) cands.push(['sqrt', { t: 'fn', v: 'sqrt' }]);
        if (lower.startsWith('pi')) cands.push(['pi', { t: 'num', v: Math.PI }]);
        if (word.startsWith('π')) cands.push(['π', { t: 'num', v: Math.PI }]);
        if (word.startsWith('t')) cands.push(['t', { t: 'id', v: 't', ord: 0 }]);
        if (!cands.length) {
          const m = /^[\p{L}][\p{N}_]*/u.exec(word)![0];
          return `неизвестное обозначение «${m}» — добавьте его в параметры или координаты`;
        }
        cands.sort((a, b) => b[0].length - a[0].length);
        pieces.push(cands[0][1]);
        word = word.slice(cands[0][0].length);
      }
      // Штрихи после слова — производные последней переменной.
      let ord = 0;
      while (s[i] === "'") {
        ord++;
        i++;
      }
      if (ord) {
        const last = pieces[pieces.length - 1];
        if (last.t !== 'id' || last.v === 't' || !ctx.coords.map(normName).includes(last.v)) return 'штрих (производная) ставится только у обобщённой координаты';
        if (ord > 2) return 'выше второй производной координаты не бывает';
        last.ord = ord;
      }
      out.push(...pieces);
      continue;
    }
    if ('+-*/^()'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    return `неожиданный символ «${c}»`;
  }
  return out;
}

export function parseSym(src: string, ctx: SymContext): SymParse {
  if (!src.trim()) return { ok: true, s: [] };
  const raw = tokenize(src, ctx);
  if (typeof raw === 'string') return { ok: false, error: raw };
  const toks = raw;
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v;
  const startsPrimary = () => {
    const x = peek();
    return !!x && (x.t === 'num' || x.t === 'id' || x.t === 'fn' || (x.t === 'op' && x.v === '('));
  };
  function expr(): Sym {
    let a = term();
    while (isOp('+') || isOp('-')) {
      const op = (toks[p++] as { v: string }).v;
      const b = term();
      a = op === '+' ? add(a, b) : sub(a, b);
    }
    return a;
  }
  function term(): Sym {
    let a = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = (toks[p++] as { v: string }).v;
        const b = unary();
        if (op === '/' && !b.length) throw new Error('деление на нуль');
        a = op === '*' ? mul(a, b) : div(a, b);
      } else if (startsPrimary()) a = mul(a, power());
      else return a;
    }
  }
  function unary(): Sym {
    if (isOp('-')) {
      p++;
      return neg(unary());
    }
    if (isOp('+')) {
      p++;
      return unary();
    }
    return power();
  }
  function exponent(): number {
    const e = unary();
    const c = constOf(e);
    if (c === null) throw new Error('показатель степени — только число');
    return c;
  }
  function power(): Sym {
    const a = primary();
    if (isOp('^')) {
      p++;
      return pow(a, exponent());
    }
    return a;
  }
  function primary(): Sym {
    const x = toks[p++];
    if (!x) throw new Error('формула оборвана');
    if (x.t === 'num') return num(x.v);
    if (x.t === 'op' && x.v === '(') {
      const e = expr();
      if (!isOp(')')) throw new Error('не хватает закрывающей скобки');
      p++;
      return e;
    }
    if (x.t === 'id') return x.v === 't' ? time() : variable(x.v, x.ord);
    if (x.t === 'fn') {
      // sin^2 φ, sin² φ
      let k = 1;
      if (isOp('^')) {
        p++;
        const e = primary();
        const c = constOf(e);
        if (c === null) throw new Error('показатель степени — только число');
        k = c;
      }
      let arg: Sym;
      if (isOp('(')) arg = primary();
      else {
        arg = power();
        while (startsPrimary() && peek()?.t !== 'fn') arg = mul(arg, power());
      }
      let r = x.v === 'sqrt' ? sqrt(arg) : fn(x.v, arg);
      if (isOp('^')) {
        p++;
        r = pow(r, exponent());
      }
      return k === 1 ? r : pow(r, k);
    }
    throw new Error(`неожиданный «${(x as { v: string }).v}»`);
  }
  try {
    const e = expr();
    if (p < toks.length) return { ok: false, error: `лишнее «${(toks[p] as { v: string | number }).v}»` };
    if (e.some((t) => !Number.isFinite(t.c))) return { ok: false, error: 'выражение не определено (деление на нуль?)' };
    return { ok: true, s: e };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
