import { createRoot } from 'react-dom/client';
import { App } from '#/app';
import { initializeI18n } from '#/app/i18n/initializeI18n';
import './app/styles/index.scss';

const rootElement = document.querySelector('#root');

if (rootElement === null) {
  throw new Error('root element was not found.');
}

await initializeI18n();

createRoot(rootElement).render(<App />);
