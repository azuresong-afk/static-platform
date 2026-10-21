/** Раздел «Графическая статика» (Мещерский §5): диаграмма Кремоны, силовой и верёвочный многоугольники, цепной мост. */
import type { Chrome, StatikaModule } from '../../app/module';
import { taskEntries } from '../../shared/tasks';
import { GRAPH_PRESETS, type GraphPresetKey } from './presets';
import { GRAPHSTAT_MODULE, GraphStore } from './ui/store';
import { GraphStatView } from './ui/GraphStatView';
import './graphstat.css';

const EXPLAIN_KEY = 'statika.explain';

export function createGraphStatModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new GraphStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <GraphStatView chrome={chrome} store={store} />;
  }
  return {
    id: GRAPHSTAT_MODULE,
    tab: 'Графическая статика',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries(GRAPH_PRESETS),
    loadTask: (k) => store.loadPreset(k as GraphPresetKey),
  };
}
