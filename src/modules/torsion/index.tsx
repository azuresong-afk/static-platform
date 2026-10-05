/** Раздел «Кручение» (Антонов, гл. 7): эпюры M_z, τ, φ, диаметр вала; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { TorsionStore, TORSION_MODULE } from './ui/store';
import { TorsionView } from './ui/TorsionView';

const EXPLAIN_KEY = 'statika.explain';

export function createTorsionModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new TorsionStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <TorsionView chrome={chrome} store={store} />;
  }
  return {
    id: TORSION_MODULE,
    tab: 'Кручение',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
  };
}
