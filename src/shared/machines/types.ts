/**
 * Каталог «машин» — задач с одной степенью свободы, у которых решение — одна-две формулы по размерам и нагрузкам
 * (Мещерский §41 и §46): принцип возможных перемещений для домкратов, прессов, полиспастов и рычагов; силы инерции и
 * давления в ускоренных системах. Машина описывает параметры и решение; решение возвращает шаги для текста,
 * строки ответа и чертёж. Состояние, файл проекта и экран — общие (store.ts, MachineView.tsx).
 */
import type { Inline } from '../doc';

export interface Param {
  k: string;
  label: string;
  unit?: string;
  def: number;
  /** Допускаются нулевые и отрицательные значения. */
  zero?: boolean;
  neg?: boolean;
}

export type Vals = Record<string, number>;

export interface Row {
  /** Ключ для сверки с ответом книги. */
  key: string;
  label: Inline[];
  val: number;
  unit: string;
  /** Значащих цифр в ответе (по умолчанию 4). */
  digits?: number;
  /** Вспомогательная строка (не главный ответ). */
  aux?: boolean;
}

export interface Step {
  title: string;
  lines: Inline[][];
  /** Пояснение (показывается при включённых «Подробных пояснениях»). */
  note?: string;
}

export interface Fig {
  /** Содержимое SVG и его viewBox. */
  svg: string;
  viewBox: string;
}

export type Solved = { ok: false; errors: string[] } | { ok: true; steps: Step[]; rows: Row[]; fig: Fig };

export interface Machine {
  id: string;
  /** Название вида машины в списке «Тип задачи». */
  name: string;
  params: Param[];
  solve(v: Vals): Solved;
}

export interface MachinePreset {
  title: string;
  machine: string;
  /** Значения параметров, отличные от умолчаний машины. */
  vals?: Vals;
  /** Ответ книги по ключам строк результата. */
  book?: Record<string, number>;
  relTol?: number;
  note?: string;
}

export interface Catalog {
  /** Раздел-хозяин (поле module в файле проекта). */
  moduleId: string;
  /** Название режима в переключателе вкладки. */
  modeName: string;
  title: string;
  lede: string;
  machines: Machine[];
  presets: Record<string, MachinePreset>;
  /** Ключ готовой задачи по умолчанию. */
  start: string;
}

export const defaults = (m: Machine): Vals => Object.fromEntries(m.params.map((p) => [p.k, p.def]));
