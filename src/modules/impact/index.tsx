/** Раздел «Удар» (Мещерский §44; Яблонский Д.13): соударение тел, удар по телу на оси, теорема Карно; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { ImpStore, IMPACT_MODULE } from './ui/store';
import { ImpactView } from './ui/ImpactView';
import { taskEntries } from '../../shared/tasks';
import { IMP_PRESETS, type ImpPresetKey } from './presets';
import { IMP_EXTRA_PRESETS, type ImpExtraKey } from './extraPresets';

const EXPLAIN_KEY = 'statika.explain';

export function createImpactModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new ImpStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <ImpactView chrome={chrome} store={store} />;
  }
  return {
    id: IMPACT_MODULE,
    tab: 'Удар',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries({ ...IMP_PRESETS, ...IMP_EXTRA_PRESETS }),
    loadTask: (k) => store.loadPreset(k as ImpPresetKey | ImpExtraKey),
  };
}
