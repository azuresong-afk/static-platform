/** Раздел «Уравнения Лагранжа второго рода» (Мещерский §48); файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { LagrangeStore, LAGRANGE_MODULE } from './ui/store';
import { LagrangeView } from './ui/LagrangeView';

const EXPLAIN_KEY = 'statika.explain';

export function createLagrangeModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new LagrangeStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <LagrangeView chrome={chrome} store={store} />;
  }
  return {
    id: LAGRANGE_MODULE,
    tab: 'Уравнения Лагранжа',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
  };
}
