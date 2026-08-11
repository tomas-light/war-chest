import { createRoot } from 'react-dom/client';
import { App } from '#/app';
import './app/styles/index.scss';

const rootElement = document.querySelector('#root');

if (rootElement === null) {
  throw new Error('root element was not found.');
}

createRoot(rootElement).render(<App />);
