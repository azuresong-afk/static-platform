/** Числовые помощники — точные копии функций прототипа (форматирование влияет на текст решения). */

export const r3 = (v: number): number => Math.round(v * 1000) / 1000;
export const r1 = (v: number): number => Math.round(v * 10) / 10;
export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

/** Разбор числа из поля ввода: запятая или точка, «−» как минус. NaN, если не число. */
export function parseNum(s: unknown): number {
  const v = parseFloat(String(s).trim().replace(',', '.').replace('−', '-'));
  return isFinite(v) ? v : NaN;
}

/** Число для текста решения: d знаков после запятой, запятая, типографский минус. */
export function fmt(v: number, d = 3): string {
  if (!isFinite(v)) return '—';
  let r = +(+v).toFixed(d);
  if (Math.abs(r) < Math.pow(10, -d) / 2) r = 0;
  return String(r).replace('.', ',').replace('-', '−');
}

/** Число для поля ввода. */
export const fmtIn = (v: unknown): string => String(v).replace('.', ',');

/** Единичный вектор по углу в градусах (от оси x против часовой). */
export function dirOf(a: number): { dx: number; dy: number } {
  const t = (a * Math.PI) / 180;
  let dx = Math.cos(t),
    dy = Math.sin(t);
  if (Math.abs(dx) < 1e-12) dx = 0;
  if (Math.abs(dy) < 1e-12) dy = 0;
  return { dx, dy };
}

/** Острый угол линии действия с горизонталью, 0…90°. */
export function acute(a: number): number {
  let t = ((a % 360) + 360) % 360;
  t = t % 180;
  if (t > 90) t = 180 - t;
  return t;
}

export type Axis = 'x' | 'y';
/** Ось, от которой пользователь отсчитывал угол: h — горизонталь, v — вертикаль. */
export type RefAxis = 'h' | 'v';

/** Тригонометрический множитель проекции: fn deg°; null — множитель равен 1. */
export interface TrigFactor {
  fn: 'sin' | 'cos';
  deg: number;
  /** Острый угол, записанный через букву, которую выбрал пользователь: «α», «180° − α»… */
  name?: string;
}

/**
 * Острый угол с осью отсчёта, выраженный через заданный пользователем угол v (град.) с обозначением name:
 * 0…90° → «α»; 90…180° → «180° − α»; 180…270° → «α − 180°»; 270…360° → «360° − α».
 */
export function acuteExpr(v: number, name: string): string {
  const a = ((v % 360) + 360) % 360;
  if (a <= 90) return name;
  if (a <= 180) return `180° − ${name}`;
  if (a <= 270) return `${name} − 180°`;
  return `360° − ${name}`;
}

/** «sin 60°», «sin α», «cos(180° − α)». */
export function trigText(t: TrigFactor): string {
  if (!t.name) return `${t.fn} ${fmt(t.deg, 2)}°`;
  return t.name.includes(' ') ? `${t.fn}(${t.name})` : `${t.fn} ${t.name}`;
}

/**
 * Множитель проекции силы с углом a на ось axis. Если угол задан от вертикали (ref = 'v'),
 * множитель пишется через угол от вертикали: sin и cos меняются местами.
 * Возвращает null там, где прототип не пишет множитель (он равен 1 или проекция нулевая).
 */
export function trigFactor(a: number, axis: Axis, ref: RefAxis | undefined): TrigFactor | null {
  const b = acute(a);
  if (ref === 'v') {
    const g = 90 - b;
    if (axis === 'x') return Math.abs(g) < 1e-9 || Math.abs(g - 90) < 1e-9 ? null : { fn: 'sin', deg: g };
    return g < 1e-9 ? null : { fn: 'cos', deg: g };
  }
  if (axis === 'x') return b < 1e-9 ? null : { fn: 'cos', deg: b };
  return Math.abs(b - 90) < 1e-9 ? null : { fn: 'sin', deg: b };
}

/** Строковая форма множителя, как в прототипе: «·sin 30°» или пусто. */
export function trig(a: number, axis: Axis, ref: RefAxis | undefined): string {
  const t = trigFactor(a, axis, ref);
  return t ? `·${t.fn} ${fmt(t.deg, 2)}°` : '';
}
