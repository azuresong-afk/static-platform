/**
 * Задачи-«расширения» разделов (пункт 24): набор вопросов (ask) со своими числами и выбором, один общий вид экрана.
 * Каждый вопрос — AskDef: поля данных, функция solve → ExtraOut (числа для сверки с книгой, шаги решения, график).
 * Состояние — ExtraProblem {ask, n, s}: числа и строки (выбор, формулы); файл проекта хранит его как есть.
 */
import { b, type AnswerRow, type Block, type Inline, type Step } from './doc';
import { fmt } from './format';
import { isNum, isObj } from './projectFile';

export interface ExtraProblem {
  ask: string;
  n: Record<string, number>;
  s: Record<string, string>;
}
export interface PlotSeries {
  name: string;
  pts: [number, number][];
  cls?: string;
}
export interface ExtraPlot {
  xl: string;
  yl: string;
  series: PlotSeries[];
  marks?: { x: number; y: number; label: string }[];
  /** Одинаковый масштаб по осям (траектории). */
  equal?: boolean;
}
export interface ExtraOut {
  ok: boolean;
  errors: string[];
  /** Числа для сверки с книгой (имена — как в `book` готовой задачи). */
  vals: Record<string, number>;
  steps: Step[];
  plot?: ExtraPlot;
}
export interface FieldDef {
  k: string;
  label: string;
  /** Допускаются отрицательные числа. */
  neg?: boolean;
  /** Допускается нуль. */
  zero?: boolean;
  /** Поле хранит строку в s: формула (vars — допустимые переменные кроме t) или таблица. */
  text?: boolean;
  vars?: string[];
  show?: (p: ExtraProblem) => boolean;
}
export interface SelectDef {
  k: string;
  label: string;
  options: [string, string][];
  show?: (p: ExtraProblem) => boolean;
}
export interface AskDef {
  id: string;
  title: string;
  hint: string;
  n: Record<string, number>;
  s?: Record<string, string>;
  selects?: SelectDef[];
  fields: FieldDef[];
  solve: (p: ExtraProblem, explain: boolean) => ExtraOut;
}

export const extraProblem = (a: AskDef, n: Record<string, number> = {}, s: Record<string, string> = {}): ExtraProblem => ({ ask: a.id, n: { ...a.n, ...n }, s: { ...(a.s ?? {}), ...s } });
export const findAsk = (asks: AskDef[], id: string): AskDef => asks.find((a) => a.id === id) ?? asks[0];

/** Файл проекта: неполные поля добираются значениями по умолчанию, лишние отбрасываются. */
export function parseExtra(raw: unknown, asks: AskDef[]): ExtraProblem | null {
  if (!isObj(raw)) return null;
  const a = asks.find((x) => x.id === raw.ask);
  if (!a || !isObj(raw.n) || !isObj(raw.s)) return null;
  const d = extraProblem(a);
  for (const k of Object.keys(d.n)) if (isNum(raw.n[k])) d.n[k] = raw.n[k];
  for (const k of Object.keys(d.s)) if (typeof raw.s[k] === 'string') d.s[k] = (raw.s[k] as string).slice(0, 300);
  return d;
}

export function solveExtra(asks: AskDef[], p: ExtraProblem, explain: boolean): ExtraOut {
  const a = findAsk(asks, p.ask);
  try {
    return a.solve(p, explain);
  } catch (e) {
    return fail([`Расчёт не удался: ${(e as Error).message}`]);
  }
}

/* ---------- построители текста решения ---------- */
export type Ln = string | Inline | Inline[];
const inl = (x: Ln): Inline[] => (Array.isArray(x) ? x : [x]);
export const eqB = (...ls: Ln[]): Block => ({ k: 'eq', lines: ls.map((l) => ({ c: inl(l) })) });
export const parB = (t: Ln, cls?: string): Block => ({ k: 'p', cls, c: inl(t) });
export const stepB = (title: string, ...blocks: Block[]): Step => ({ title, blocks });
export const ansB = (...rows: [Ln, string, ('main' | 'aux' | 'total')?][]): Block => ({ k: 'answer', rows: rows.map(([v, note, kind]): AnswerRow => ({ kind: kind ?? 'main', val: inl(v), note })) });
export const bold = (s: string): Inline => b(s);
/** Шаг с поясняющим абзацем, если включены подробные пояснения. */
export function stepEx(explain: boolean, title: string, why: string | null, ...blocks: Block[]): Step {
  return stepB(title, ...(why && explain ? [parB(why, 'explain')] : []), ...blocks);
}
export const fail = (errors: string[]): ExtraOut => ({
  ok: false,
  errors,
  vals: {},
  steps: [stepB('Данные', { k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: errors.map((e) => [e]) })],
});

/** Число с n значащими цифрами для текста решения. */
export function sg(x: number, n = 4): string {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -3 && e < 6) return fmt(x, Math.max(0, n - 1 - e));
  const m = x / Math.pow(10, e);
  const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return `${fmt(m, n - 1)}·10${String(e).replace(/./g, (c) => SUP[c] ?? c)}`;
}

/* ---------- численные методы ---------- */
/** Классический Рунге — Кутта 4-го порядка с постоянным шагом; f(t, y) → dy/dt. Возвращает все узлы (t, y). */
export function rk4(f: (t: number, y: number[]) => number[], y0: number[], t0: number, t1: number, n: number): { t: number; y: number[] }[] {
  const h = (t1 - t0) / n;
  const out = [{ t: t0, y: y0.slice() }];
  let y = y0.slice();
  const add = (a: number[], c: number[], k: number) => a.map((v, i) => v + c[i] * k);
  for (let i = 0; i < n; i++) {
    const t = t0 + i * h;
    const k1 = f(t, y),
      k2 = f(t + h / 2, add(y, k1, h / 2)),
      k3 = f(t + h / 2, add(y, k2, h / 2)),
      k4 = f(t + h, add(y, k3, h));
    y = y.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    out.push({ t: t0 + (i + 1) * h, y });
  }
  return out;
}
/** Интеграл ∫f dx составным правилом Симпсона (n чётное). */
export function simpson(f: (x: number) => number, a: number, b2: number, n = 2000): number {
  const m = n % 2 ? n + 1 : n;
  const h = (b2 - a) / m;
  let s = f(a) + f(b2);
  for (let i = 1; i < m; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}
/** Корень на отрезке методом деления пополам (f(a), f(b) разных знаков), иначе NaN. */
export function bisect(f: (x: number) => number, a: number, b2: number, it = 200): number {
  let fa = f(a),
    fb = f(b2);
  if (!(fa * fb <= 0)) return NaN;
  for (let i = 0; i < it; i++) {
    const m = (a + b2) / 2,
      fm = f(m);
    if (fa * fm <= 0) {
      b2 = m;
      fb = fm;
    } else {
      a = m;
      fa = fm;
    }
  }
  return (a + b2) / 2;
}
/** Выборка n+1 точек функции на [a, b]. */
export const sample = (f: (x: number) => number, a: number, b2: number, n = 120): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const x = a + ((b2 - a) * i) / n;
    return [x, f(x)] as [number, number];
  });

/* ---------- чертёж: график ---------- */
const r1 = (v: number) => Math.round(v * 10) / 10;
function niceStep(span: number, target = 6): number {
  const raw = span / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}
const SERIES_CLS = ['en-v', 'rl-c', 'rl-e', 'cv-r'];
export function plotSvg(pl: ExtraPlot | undefined, ok: boolean): { svg: string; viewBox: string } {
  const W = 1000,
    H = 520;
  const out = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  const pts = pl ? pl.series.flatMap((s) => s.pts).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])) : [];
  if (!ok || !pl || !pts.length) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">${ok ? 'Нечего показать.' : 'Проверьте данные.'}</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  let x0 = Math.min(...pts.map((p) => p[0])),
    x1 = Math.max(...pts.map((p) => p[0])),
    y0 = Math.min(...pts.map((p) => p[1])),
    y1 = Math.max(...pts.map((p) => p[1]));
  if (x1 - x0 < 1e-12) (x0 -= 1), (x1 += 1);
  if (y1 - y0 < 1e-12) (y0 -= 1), (y1 += 1);
  const L = 90,
    R = 30,
    T = 30,
    B = 70;
  let kx = (W - L - R) / (x1 - x0),
    ky = (H - T - B) / (y1 - y0);
  if (pl.equal) {
    const k = Math.min(kx, ky);
    kx = ky = k;
  }
  const ox = L + (W - L - R - (x1 - x0) * kx) / 2,
    oy = T + (H - T - B - (y1 - y0) * ky) / 2 + (y1 - y0) * ky;
  const X = (x: number) => ox + (x - x0) * kx,
    Y = (y: number) => oy - (y - y0) * ky;
  const sx = niceStep(x1 - x0),
    sy = niceStep(y1 - y0);
  for (let x = Math.ceil(x0 / sx) * sx; x <= x1 + 1e-9; x += sx) out.push(`<line class="sb-axis" x1="${r1(X(x))}" y1="${T}" x2="${r1(X(x))}" y2="${H - B}"/><text class="tb-note" x="${r1(X(x))}" y="${H - B + 18}" text-anchor="middle">${fmt(x, 3)}</text>`);
  for (let y = Math.ceil(y0 / sy) * sy; y <= y1 + 1e-9; y += sy) out.push(`<line class="sb-axis" x1="${L}" y1="${r1(Y(y))}" x2="${W - R}" y2="${r1(Y(y))}"/><text class="tb-note" x="${L - 8}" y="${r1(Y(y)) + 4}" text-anchor="end">${fmt(y, 3)}</text>`);
  out.push(`<text class="tb-note" x="${W - R}" y="${H - 12}" text-anchor="end">${pl.xl}</text><text class="tb-note" x="${L}" y="${T - 10}">${pl.yl}</text>`);
  pl.series.forEach((s, i) => {
    const q = s.pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (q.length > 1) out.push(`<path class="${s.cls ?? SERIES_CLS[i % SERIES_CLS.length]}" fill="none" d="M${q.map((p) => `${r1(X(p[0]))} ${r1(Y(p[1]))}`).join('L')}"/>`);
    out.push(`<text class="tb-note" x="${W - R}" y="${T + 6 + i * 16}" text-anchor="end">— ${s.name}</text>`);
  });
  for (const m of pl.marks ?? []) if (Number.isFinite(m.x) && Number.isFinite(m.y)) out.push(`<circle class="cg-c" cx="${r1(X(m.x))}" cy="${r1(Y(m.y))}" r="5"/><text class="t rl-t" x="${r1(X(m.x)) + 8}" y="${r1(Y(m.y)) - 8}">${m.label}</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
