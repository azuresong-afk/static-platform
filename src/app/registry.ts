/** Разделы приложения: готовые и запланированные по дорожной карте (src/app/roadmap.ts). */
import { createAxialModule } from '../modules/axial';
import { createBendingModule } from '../modules/bending';
import { createCompositeModule } from '../modules/composite';
import { createFramesModule } from '../modules/frames';
import { createSectionsModule } from '../modules/sections';
import { createSpaceModule } from '../modules/space';
import { createBodyModule } from '../modules/spacebody';
import { createCentroidModule } from '../modules/centroid';
import { createConvModule } from '../modules/converging';
import { createTrussModule } from '../modules/truss';
import { ConventionsStore } from '../shared/conventions';
import type { PlannedModule, StatikaModule } from './module';
import { ROADMAP } from './roadmap';

export function createModules(): StatikaModule[] {
  const frames = createFramesModule();
  const conventions = new ConventionsStore();
  return [frames, createTrussModule(), createBodyModule(), createCentroidModule(), createConvModule(), createBendingModule(frames.store, conventions), createSectionsModule(frames.store, conventions), createAxialModule(), createSpaceModule(conventions), createCompositeModule()];
}

export const PLANNED: PlannedModule[] = ROADMAP.flatMap((b) => b.items)
  .filter((i) => i.status !== 'done')
  .map((i) => ({ id: i.id, tab: i.title }));
