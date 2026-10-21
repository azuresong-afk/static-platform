/** Раздел «Кинетическая энергия» (Мещерский §38; Антонов п. 9.6–9.9): теорема об изменении кинетической энергии системы; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { EnergyStore, ENERGY_MODULE } from './ui/store';
import { EnergyView } from './ui/EnergyView';
import { taskEntries } from '../../shared/tasks';
import { ENERGY_PRESETS, type EnergyPresetKey } from './presets';

const EXPLAIN_KEY = 'statika.explain';

export function createEnergyModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new EnergyStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <EnergyView chrome={chrome} store={store} />;
  }
  return {
    id: ENERGY_MODULE,
    tab: 'Кинетическая энергия',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
    tasks: taskEntries(ENERGY_PRESETS),
    loadTask: (k) => store.loadPreset(k as EnergyPresetKey),
  };
}
