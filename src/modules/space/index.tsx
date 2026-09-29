/** Раздел «Пространственный брус» (Антонов, задача 3). Своя модель и файл проекта; сторона эпюр M — из общих правил. */
import type { Chrome, StatikaModule } from '../../app/module';
import type { ConventionsStore } from '../../shared/conventions';
import { SpaceStore, SPACE_MODULE } from './ui/store';
import { SpaceView } from './ui/SpaceView';

const EXPLAIN_KEY = 'statika.explain';

export function createSpaceModule(conv: ConventionsStore): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new SpaceStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <SpaceView chrome={chrome} store={store} conv={conv} />;
  }
  return {
    id: SPACE_MODULE,
    tab: 'Пространственный брус',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
  };
}
