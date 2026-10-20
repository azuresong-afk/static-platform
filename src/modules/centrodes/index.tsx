/** Раздел «Центроиды» (Мещерский §17): неподвижная и подвижная центроиды на механизме или заданном движении тела. */
import type { Chrome, StatikaModule } from '../../app/module';
import { taskEntries } from '../../shared/tasks';
import { CENTRODE_PRESETS, type CentrodePresetKey } from './presets';
import { CENTRODES_MODULE, CentrodesStore } from './ui/store';
import { CentrodesView } from './ui/CentrodesView';

const EXPLAIN_KEY = 'statika.explain';

export function createCentrodesModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new CentrodesStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <CentrodesView chrome={chrome} store={store} />;
  }
  return {
    id: CENTRODES_MODULE,
    tab: 'Центроиды',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries(CENTRODE_PRESETS),
    loadTask: (k) => store.loadPreset(k as CentrodePresetKey),
  };
}
