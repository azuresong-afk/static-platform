/** Раздел «Фермы» (Мещерский §4–5): своя модель, решение методом вырезания узлов и сечений, файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { TrussStore, TRUSS_MODULE } from './ui/store';
import { TrussView } from './ui/TrussView';

const EXPLAIN_KEY = 'statika.explain';

export function createTrussModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new TrussStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <TrussView chrome={chrome} store={store} />;
  }
  return {
    id: TRUSS_MODULE,
    tab: 'Фермы',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
  };
}
