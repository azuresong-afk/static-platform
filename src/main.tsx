import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createModules, PLANNED } from './app/registry';
import { Shell } from './app/Shell';
import './shared/ui/app.css';

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

const modules = createModules();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell modules={modules} planned={PLANNED} />
  </StrictMode>,
);
