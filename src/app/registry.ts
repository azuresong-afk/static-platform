/** Разделы приложения: готовые и запланированные по дорожной карте (README). */
import { createAxialModule } from '../modules/axial';
import { createBendingModule } from '../modules/bending';
import { createCompositeModule } from '../modules/composite';
import { createFramesModule } from '../modules/frames';
import { createSectionsModule } from '../modules/sections';
import { createSpaceModule } from '../modules/space';
import { ConventionsStore } from '../shared/conventions';
import type { PlannedModule, StatikaModule } from './module';

export function createModules(): StatikaModule[] {
  const frames = createFramesModule();
  const conventions = new ConventionsStore();
  return [frames, createBendingModule(frames.store, conventions), createSectionsModule(frames.store, conventions), createAxialModule(), createSpaceModule(conventions), createCompositeModule()];
}

export const PLANNED: PlannedModule[] = [
  { id: 'converging', tab: 'Сходящиеся силы', stage: 3 },
  { id: 'inclined', tab: 'Наклонные балки', stage: 4 },
  { id: 'truss', tab: 'Фермы', stage: 5 },
  { id: 'friction', tab: 'Трение', stage: 6 },
  { id: 'centroid', tab: 'Центр тяжести', stage: 7 },
  { id: 'space', tab: 'Пространственные силы', stage: 8 },
];
