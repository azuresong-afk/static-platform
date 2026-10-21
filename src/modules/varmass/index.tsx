/** Раздел «Переменная масса» (Мещерский §45): уравнение Мещерского, формула Циолковского, многоступенчатые ракеты; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { VmStore, VARMASS_MODULE } from './ui/store';
import { VarView } from './ui/VarView';
import { taskEntries } from '../../shared/tasks';
import { VAR_PRESETS, type VarPresetKey } from './presets';
import { VARMASS_EXTRA_PRESETS, type VarExtraKey } from './extraPresets';

const EXPLAIN_KEY = 'statika.explain';

export function createVarMassModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new VmStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <VarView chrome={chrome} store={store} />;
  }
  return {
    id: VARMASS_MODULE,
    tab: 'Переменная масса',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries({ ...VAR_PRESETS, ...VARMASS_EXTRA_PRESETS }),
    loadTask: (k) => store.loadPreset(k as VarPresetKey | VarExtraKey),
  };
}
