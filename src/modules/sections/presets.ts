/**
 * Готовые исходные данные вкладки «Подбор сечения». beam — задача вкладки «Изгиб», которую загрузить вместе с ними.
 */
import { BENDING_PRESETS } from '../bending/presets';
import { DEFAULT_PARAMS, type SectionParams, type SectionsStore } from './ui/store';

export const SECTION_PRESETS = {
  antonov7: {
    title: 'Антонов, задача 2, схема 7 (группа 10): σт = 230 МПа, n = 1,3, [τ] = 70 МПа',
    beam: 'antonov7' as const,
    p: { ...DEFAULT_PARAMS, source: 'beam', sigmaMode: 'yield', sigmaT: 230, n: 1.3, tau: 70, k: 2, overload: 0 } as SectionParams,
  },
  steel: {
    title: 'Сталь: [σ] = 160 МПа, [τ] = 100 МПа (схема не меняется)',
    beam: null,
    p: { ...DEFAULT_PARAMS },
  },
};
export type SectionPresetKey = keyof typeof SECTION_PRESETS;

/** Загрузить данные (и, если указана, балку во вкладку «Балки и рамы»). */
export function loadSectionPreset(store: SectionsStore, k: SectionPresetKey) {
  const sp = SECTION_PRESETS[k];
  const frames = store.frames;
  if (sp.beam) frames.loadStructure(BENDING_PRESETS[sp.beam].build(frames.ids), BENDING_PRESETS[sp.beam].title);
  store.load(sp.p);
}
