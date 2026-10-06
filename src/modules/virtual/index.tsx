/**
 * Раздел «Возможные перемещения» (Мещерский §46). Своей схемы у раздела нет — он работает с хранилищем
 * «Балок и рам» (отмена, файлы, название проекта общие), поэтому открывает и их файлы.
 */
import type { Chrome, StatikaModule } from '../../app/module';
import type { Store as FramesStore } from '../frames/ui/store';
import { VirtualView } from './ui/VirtualView';

export function createVirtualModule(frames: FramesStore): StatikaModule {
  function Screen({ chrome }: { chrome: Chrome }) {
    return <VirtualView chrome={chrome} frames={frames} />;
  }
  return {
    id: 'virtual',
    tab: 'Возможные перемещения',
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
  };
}
