/** Разделы приложения: готовые и запланированные по дорожной карте (README). */
import { createFramesModule } from '../modules/frames';
import type { PlannedModule, StatikaModule } from './module';

export function createModules(): StatikaModule[] {
  return [createFramesModule()];
}

export const PLANNED: PlannedModule[] = [
  { id: 'converging', tab: 'Сходящиеся силы', stage: 1 },
  { id: 'inclined', tab: 'Наклонные балки', stage: 2 },
  { id: 'truss', tab: 'Фермы', stage: 3 },
  { id: 'friction', tab: 'Трение', stage: 4 },
  { id: 'centroid', tab: 'Центр тяжести', stage: 5 },
  { id: 'space', tab: 'Пространственные силы', stage: 6 },
];
