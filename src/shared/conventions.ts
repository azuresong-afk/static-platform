/**
 * Правила и обозначения, которые различаются между вузами и учебниками. Общие для всех разделов,
 * запоминаются в браузере. По умолчанию — как в пособии Антонова и др. «Прикладная механика» (РХТУ).
 *
 * Знаки Q и M одинаковы почти во всех учебниках и не настраиваются:
 * Q — «+», если слева от сечения сила направлена вверх (справа — вниз);
 * M — «+», если балка изгибается выпуклостью вниз (сжаты верхние волокна).
 */

export interface Conventions {
  /** С какой стороны строится эпюра M: сжатых волокон (машиностроение, «+» вверх) или растянутых (строительная механика, «+» вниз). */
  mSide: 'compressed' | 'tension';
  /** Ось вдоль балки. */
  axis: 'z' | 'x';
  /** Усилия с индексами осей: Q_y, M_x (при оси z) — или просто Q, M. */
  indexed: boolean;
}

export const DEFAULT_CONVENTIONS: Conventions = { mSide: 'compressed', axis: 'z', indexed: false };

const KEY = 'statika.conventions';

function read(): Conventions {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CONVENTIONS;
    const o = JSON.parse(raw) as Partial<Conventions>;
    return {
      mSide: o.mSide === 'tension' ? 'tension' : 'compressed',
      axis: o.axis === 'x' ? 'x' : 'z',
      indexed: o.indexed === true,
    };
  } catch {
    return DEFAULT_CONVENTIONS;
  }
}

/** Хранилище настроек (для useSyncExternalStore). */
export class ConventionsStore {
  private c: Conventions;
  private listeners = new Set<() => void>();
  constructor(initial?: Conventions) {
    this.c = initial ?? (typeof localStorage === 'undefined' ? DEFAULT_CONVENTIONS : read());
  }
  get = (): Conventions => this.c;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  set = (patch: Partial<Conventions>) => {
    this.c = { ...this.c, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.c));
    } catch {
      /* настройка не запомнится */
    }
    this.listeners.forEach((f) => f());
  };
}

/** Обозначения усилий: буква и индекс. */
export function forceNames(c: Conventions): { N: { L: string; S: string }; Q: { L: string; S: string }; M: { L: string; S: string } } {
  if (!c.indexed) return { N: { L: 'N', S: '' }, Q: { L: 'Q', S: '' }, M: { L: 'M', S: '' } };
  // Ось вдоль балки z: поперечная ось y, изгиб вокруг x. Ось вдоль балки x: изгиб вокруг z.
  return { N: { L: 'N', S: c.axis }, Q: { L: 'Q', S: 'y' }, M: { L: 'M', S: c.axis === 'z' ? 'x' : 'z' } };
}
