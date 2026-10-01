/** Раздел «Геометрия масс» (Мещерский §34; Антонов п. 9.2, 9.5): моменты инерции составных тел; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { InertiaStore, INERTIA_MODULE } from './ui/store';
import { InertiaView } from './ui/InertiaView';

const EXPLAIN_KEY = 'statika.explain';

export function createInertiaModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new InertiaStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <InertiaView chrome={chrome} store={store} />;
  }
  return {
    id: INERTIA_MODULE,
    tab: 'Геометрия масс',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
  };
}
