import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { Store } from './ui/store';
import { StoreContext } from './ui/useStore';
import './ui/app.css';

// Плашка ошибок, как в прототипе: текст для разработчика вместо молчаливой поломки.
(function () {
  const show = (msg: string) => {
    const b = document.getElementById('errbar');
    if (!b) return;
    b.hidden = false;
    b.textContent = 'Ошибка на странице — пришлите этот текст разработчику:\n' + msg + '\n' + navigator.userAgent;
  };
  window.addEventListener('error', (e) => show((e.message || '') + ' @' + (e.lineno || '?') + ':' + (e.colno || '?')));
  window.addEventListener('unhandledrejection', (e) => show(String(e.reason)));
})();

function readExplain(): boolean {
  try {
    const v = localStorage.getItem('statika.explain');
    return v == null ? true : v === '1';
  } catch {
    return true;
  }
}

const store = new Store({ explain: readExplain() });
store.subscribe(() => {
  try {
    localStorage.setItem('statika.explain', store.get().explain ? '1' : '0');
  } catch {
    /* хранилище недоступно — настройка не запомнится */
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreContext.Provider value={store}>
      <App />
    </StoreContext.Provider>
  </StrictMode>,
);
