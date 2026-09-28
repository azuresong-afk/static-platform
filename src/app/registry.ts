/** Разделы приложения: готовые и запланированные по дорожной карте (README). */
import { createBendingModule } from '../modules/bending';
import { createFramesModule } from '../modules/frames';
import { ConventionsStore } from '../shared/conventions';
import type { PlannedModule, StatikaModule } from './module';

export function createModules(): StatikaModule[] {
  const frames = createFramesModule();
  const conventions = new ConventionsStore();
  return [frames, createBendingModule(frames.store, conventions)];
}

export const PLANNED: PlannedModule[] = [
  { id: 'sections', tab: 'Подбор сечения', stage: 2 },
  { id: 'converging', tab: 'Сходящиеся силы', stage: 3 },
  { id: 'inclined', tab: 'Наклонные балки', stage: 4 },
  { id: 'truss', tab: 'Фермы', stage: 5 },
  { id: 'friction', tab: 'Трение', stage: 6 },
  { id: 'centroid', tab: 'Центр тяжести', stage: 7 },
  { id: 'space', tab: 'Пространственные силы', stage: 8 },
];
