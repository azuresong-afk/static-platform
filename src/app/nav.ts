/**
 * Навигация: курсы по задачникам, внутри — блоки, в блоке — разделы (вкладки модулей).
 * Теоретическая механика — по задачнику Мещерского, сопротивление материалов — по пособию Антонова и др.
 * Порядок разделов — как в книгах (по параграфам и главам).
 */

export interface NavBlock {
  id: string;
  title: string;
  /** Короткая подпись для узкого экрана. */
  short: string;
  /** Параграфы или главы книги. */
  refs: string;
  /** Разделы блока (идентификаторы модулей). */
  tabs: string[];
}

export interface NavCourse {
  id: string;
  title: string;
  /** Задачник, по которому построен курс. */
  book: string;
  blocks: NavBlock[];
}

export const NAV: NavCourse[] = [
  {
    id: 'theor',
    title: 'Теоретическая механика',
    book: 'Мещерский',
    blocks: [
      { id: 'statics', title: 'Статика', short: 'Статика', refs: 'Мещерский, §1–9', tabs: ['converging', 'frames', 'truss', 'spacebody', 'centroid'] },
      {
        id: 'kinematics',
        title: 'Кинематика',
        short: 'Кинематика',
        refs: 'Мещерский, §10–25',
        tabs: ['pointkin', 'gears', 'mechanism', 'fixedpoint', 'relative'],
      },
      {
        id: 'dynamics',
        title: 'Динамика',
        short: 'Динамика',
        refs: 'Мещерский, §26–45, 50–51, 53',
        tabs: ['pointdyn', 'oscillation', 'inertia', 'masscenter', 'planebody', 'rotation', 'energy', 'gyro', 'dalembert', 'impact', 'varmass', 'orbit'],
      },
      { id: 'analytic', title: 'Аналитическая механика', short: 'Аналит. механика', refs: 'Мещерский, §46–48, 54', tabs: ['virtual', 'lagrange', 'vibration'] },
    ],
  },
  {
    id: 'strength',
    title: 'Сопротивление материалов',
    book: 'Антонов',
    blocks: [
      {
        id: 'strength',
        title: 'Сопротивление материалов',
        short: 'Сопромат',
        refs: 'Антонов и др., «Прикладная механика»',
        tabs: ['axial', 'rods', 'composite', 'torsion', 'bending', 'framediag', 'sections', 'space3', 'vessels', 'fatigue'],
      },
    ],
  },
];

export const NAV_BLOCKS: NavBlock[] = NAV.flatMap((c) => c.blocks);

/** Блок, в котором находится раздел. */
export function blockOf(tab: string): NavBlock | undefined {
  return NAV_BLOCKS.find((b) => b.tabs.includes(tab));
}
export function courseOf(block: NavBlock): NavCourse {
  return NAV.find((c) => c.blocks.includes(block))!;
}
