/** Загрузка готовой задачи «Балок и рам»: пример прототипа — по ключу, задача Мещерского — с ответом книги. */
import type { PresetKey } from '../model/presets';
import { FRAMES_BOOK, isBookKey } from '../tasks';
import type { Store } from './store';

export function loadFramesTask(store: Store, key: string) {
  if (!isBookKey(key)) return store.loadPreset(key as PresetKey);
  const t = FRAMES_BOOK.find((x) => x.key === key);
  if (!t) return;
  store.loadStructure(t.build(store.ids), t.title);
  store.notify(t.answer, 'ok');
}
