/** Раздел «Центр тяжести» (Мещерский §9): фигуры с вырезами, линии, тела, грузы; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { CentroidStore, CENTROID_MODULE } from './ui/store';
import { CentroidView } from './ui/CentroidView';

const EXPLAIN_KEY = 'statika.explain';

export function createCentroidModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new CentroidStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <CentroidView chrome={chrome} store={store} />;
  }
  return {
    id: CENTROID_MODULE,
    tab: 'Центр тяжести',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
  };
}
