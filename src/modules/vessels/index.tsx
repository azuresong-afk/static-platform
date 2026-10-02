/** Раздел «Тонкостенные сосуды» (Антонов, задача 4): эпюры σ_t, σ_m, толщина стенки; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { VesselStore, VESSEL_MODULE } from './ui/store';
import { VesselView } from './ui/VesselView';

const EXPLAIN_KEY = 'statika.explain';

export function createVesselModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new VesselStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <VesselView chrome={chrome} store={store} />;
  }
  return {
    id: VESSEL_MODULE,
    tab: 'Сосуды',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
  };
}
