/**
 * Раздел «Подбор сечения»: по M и Q с эпюр балки (или заданным вручную) — прямоугольник, круг и двутавр
 * из условия прочности, сравнение, проверка по касательным напряжениям. Схема — общая с «Балками и рамами».
 */
import type { Chrome, StatikaModule } from '../../app/module';
import type { ConventionsStore } from '../../shared/conventions';
import type { Store as FramesStore } from '../frames/ui/store';
import { SectionsStore, SECTIONS_MODULE } from './ui/store';
import { SectionsView } from './ui/SectionsView';

export function createSectionsModule(frames: FramesStore, conv: ConventionsStore): StatikaModule {
  const store = new SectionsStore(frames);
  function Screen({ chrome }: { chrome: Chrome }) {
    return <SectionsView chrome={chrome} store={store} conv={conv} />;
  }
  return {
    id: SECTIONS_MODULE,
    tab: 'Подбор сечения',
    accepts: ['frames'],
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: frames.notify,
      projectTitle: frames.projectTitle,
    },
    Screen,
  };
}
