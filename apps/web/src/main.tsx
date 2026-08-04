import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '#/app';
import './app/styles/index.scss';

const rootElement = document.querySelector('#root');

if (rootElement === null) {
  throw new Error('Web application root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
