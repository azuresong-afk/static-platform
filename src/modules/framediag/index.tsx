/**
 * Раздел «Рамы: эпюры N, Q, M» для рамы из «Балок и рам». Своей схемы у раздела нет — он работает
 * с хранилищем «Балок и рам» (отмена, файлы, название проекта общие), поэтому открывает и их файлы.
 */
import type { Chrome, StatikaModule } from '../../app/module';
import type { ConventionsStore } from '../../shared/conventions';
import type { Store as FramesStore } from '../frames/ui/store';
import { FrameDiagView } from './ui/FrameDiagView';
import { taskEntries } from '../../shared/tasks';
import { FRAME_PRESETS, type FramePresetKey } from './presets';

export function createFrameDiagModule(frames: FramesStore, conv: ConventionsStore): StatikaModule {
  function Screen({ chrome }: { chrome: Chrome }) {
    return <FrameDiagView chrome={chrome} frames={frames} conv={conv} />;
  }
  return {
    id: 'framediag',
    tab: 'Рамы: эпюры N, Q, M',
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
    tasks: taskEntries(FRAME_PRESETS),
    loadTask: (k) => {
      const p = FRAME_PRESETS[k as FramePresetKey];
      frames.loadStructure(p.build(frames.ids), p.title);
    },
  };
}
