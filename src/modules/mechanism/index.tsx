/** Раздел «Плоский механизм» (Мещерский §16, 18): скорости через МЦС, ускорения методом полюса; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { MechStore, MECH_MODULE } from './ui/store';
import { MechView } from './ui/MechView';

const EXPLAIN_KEY = 'statika.explain';

export function createMechModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new MechStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <MechView chrome={chrome} store={store} />;
  }
  return {
    id: MECH_MODULE,
    tab: 'Плоский механизм',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
  };
}
