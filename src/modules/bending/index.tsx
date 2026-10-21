/**
 * Раздел «Изгиб»: эпюры Q и M для балки из «Балок и рам». Своей схемы у раздела нет — он работает
 * с хранилищем «Балок и рам» (отмена, файлы, название проекта общие), поэтому открывает и их файлы.
 */
import type { Chrome, StatikaModule } from '../../app/module';
import type { ConventionsStore } from '../../shared/conventions';
import type { Store as FramesStore } from '../frames/ui/store';
import { BendingView } from './ui/BendingView';
import { taskEntries } from '../../shared/tasks';
import { BENDING_PRESETS, type BendingPresetKey } from './presets';

export function createBendingModule(frames: FramesStore, conv: ConventionsStore): StatikaModule {
  function Screen({ chrome }: { chrome: Chrome }) {
    return <BendingView chrome={chrome} frames={frames} conv={conv} />;
  }
  return {
    id: 'bending',
    tab: 'Изгиб: эпюры Q и M',
    accepts: ['frames'],
    store: {
      undo: frames.undo,
      redo: frames.redo,
      exportProject: frames.exportProject,
      importProject: frames.importProject,
      notify: frames.notify,
      projectTitle: frames.projectTitle,
    },
    Screen,
    tasks: taskEntries(BENDING_PRESETS),
    loadTask: (k) => {
      const p = BENDING_PRESETS[k as BendingPresetKey];
      frames.loadStructure(p.build(frames.ids), p.title);
    },
  };
}
